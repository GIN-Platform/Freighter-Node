import domainValidator from 'is-valid-domain'
import os from 'os'
import diskusage from 'diskusage'
import config from '../config'
import common from '../common'

export default class Freighter {
    constructor(localConfig, gincoin) {
        this.localConfig = localConfig
        this.statusInterval = null
        this.gincoin = gincoin
    }
    
    boot(socket) {
        this.connected = false
        this.socket = socket
        
        this.resetStatusInterval()
        this.listenForEvents()
        this.connectOrRegister()
    }
    
    listenForEvents() {
        const events = ['ACK', 'FID', 'FQoS', 'FError', 'CDeploy', 'CRenew', 'CDrop', 'CReplace']
        
        for (let event of events) {
            this.socket.on(event, (data) => {
                const logData = Object.assign({}, data)
                
                if (logData.hasOwnProperty('secret')) {
                    logData.secret = '[redacted]'
                }
                
                common.log(`[>] ${event} data=${JSON.stringify(logData)}`)
                
                if (typeof this[`receive${event}`] === 'function') {
                    this[`receive${event}`](data)
                } else {
                    common.log(`unimplemented event: ${event}`)
                }
            })
        }
        
        this.socket.on('disconnect', () => this.resetStatusInterval())
    }
    
    connectOrRegister() {
        if (!this.localConfig.id) {
            this.FRegistration()
        } else {
            this.FConnect()
        }
    }
    
    handlePostConnect() {
        this.connected = true
        this.FCordon()
        this.FStatus()
    }
    
    //protocol methods
    async FRegistration() {
        const domain = this.localConfig.domain
        
        if (!domain) {
            common.abort('config error: no domain')
        } else if(!domainValidator(domain)) {
            common.abort(`config error: invalid domain ${domain}`)
        }
        
        let synced = false

        do {
            common.log('waiting for Gincoin daemon to sync')
            synced = await this.gincoin.isSynced()
            
            !synced && await common.delay(5000)
        } while (!synced)

        let masternodeStatus

        try {
            masternodeStatus = await this.gincoin.exec('masternode', ['status'])
        } catch (e) {
            common.abort('could not execute "masternode status" on Gincoin daemon')
        }
        
        if (masternodeStatus.status !== config.gincoin_target_masternode_status) {
            common.abort(`invalid masternode status: ${masternodeStatus.status}`)
        }
        
        const outpoint = masternodeStatus.outpoint.split('-')
        let rawtx

        try {
            rawtx = await this.gincoin.exec('getrawtransaction', [outpoint[0], 1])
        } catch (e) {
            common.abort(`fatal: could not execute "getrawtransaction ${outpoint[0]} 1"`)
        }
        
        const address = rawtx.vout[outpoint[1]].scriptPubKey.addresses[0]
        const ipv4 = masternodeStatus.service.split(':').shift()
        
        if (!address) {
            common.abort('could not find collateral address for this masternode')
        }
        
        if (!ipv4) {
            common.abort('could not find IPv4 in the masternode status')
        }
        
        this.send('FRegistration', { domain, address, tx: masternodeStatus.outpoint, ipv4 })
    }
    
    FConnect() {
        if (!this.localConfig.id) {
            common.abort('config error: no freighter ID')
        }
        
        if (!this.localConfig.secret) {
            common.abort('config error: no freighter secret')
        }
        
        this.send('FConnect', {
            id: this.localConfig.id,
            secret: this.localConfig.secret
        })
    }
    
    FCordon() {
        this.send('FCordon', { cordoned_status: !!this.localConfig.cordoned_status })
    }
    
    async FStatus() {
        const disk = diskusage.checkSync('/')
        const getinfo = await this.gincoin.exec('getinfo')
        const blockHash = await this.gincoin.exec('getbestblockhash')
        const block = await this.gincoin.exec('getblock', [blockHash])
        const mnsyncStatus = await this.gincoin.exec('mnsync', ['status'])
        
        let masternodeStatus

        try {
            masternodeStatus = await this.gincoin.exec('masternode', ['status'])
        } catch (e) {
            masternodeStatus = -1
        }
        
        this.send('FStatus', {
            n_proc: os.cpus().length,
            mem: {
                total: os.totalmem(),
                free: os.freemem(),
            },
            load: os.loadavg(),
            disk: {
                total: disk.total,
                free: disk.free
            },
            daemon: {
                version: getinfo.version,
                block_height: block.height,
                block_hash: block.hash,
                asset_id: mnsyncStatus.AssetID,
                masternode_status: masternodeStatus.status
            },
            cargo: []
        })
        
        if (!this.statusInterval) {
            this.statusInterval = setInterval(() => this.FStatus(), config.status_interval)
        }
    }
    
    receiveFID(data) {
        if (!this.localConfig.id) {
            //first time after FRegistration
            this.localConfig.id = data.id
            this.localConfig.secret = data.secret
            
            common.writeLocalConfig(this.localConfig)
            
            this.FConnect()
        } else if (data.id !== this.localConfig.id) {
            //somehow got a diff ID
            common.log(`received wrong ID from server: ${data.id}`)
        } else if (data.secret !== this.localConfig.secret) {
            //server initiated secret change
            this.localConfig.secret = data.secret
            
            common.writeLocalConfig(this.localConfig)
        }
        
        if (!this.connected) {
            this.handlePostConnect()
        }
    }
    
    receiveACK() {
        //do nothing
    }
    
    receiveFError(data) {
        if (data.type === 410) {
            common.abort('another connection detected')
        }
    }
    
    send(event, data) {
        common.log(`[<] ${event}`)
        this.socket.emit(event, data)
    }
    
    resetStatusInterval() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval)
            this.statusInterval = null
        }
    }
}