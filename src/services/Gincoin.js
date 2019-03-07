import fs from 'fs'
import os from 'os'
import jayson from 'jayson/promise'
import config from '../config'
import common from "../common"

export default class Gincoin {
    constructor(config) {
        this.config = config
        this.rpcClient = null
        
        if (!config.rpcuser) {
            throw new Error('no RPC user specified in Gincoin config')
        }
        
        if (!config.rpcpassword) {
            throw new Error('no RPC user specified in Gincoin config')
        }
    }
    
    async test() {
        try {
            const resp = await this.exec('getinfo')
            
            if (!resp.version || resp.version < config.gincoin_min_version) {
                throw new Error(`Gincoin version ${config.gincoin_min_version} is required`)
            }
            
            common.log('connected to Gincoin daemon')
        } catch (e) {
            if ([401, 403].includes(e.code)) {
                throw new Error('invalid RPC credentials for Gincoin daemon')
            } else {
                console.error(e)
                throw new Error('unknown RPC error')
            }
        }
    }
    
    async validateAddress(address) {
        const resp = await this.exec('validateaddress', [address])
        
        if (!resp.isvalid) {
            throw new Error(`address ${address} is not a valid Gincoin address`)
        }
    }
    
    async exec(method, params = []) {
        const result = await this.getRpcClient().request(method, params)
        
        if (result.error) {
            throw new Error(result.error)
        }
        
        return result.result
    }
    
    async isSynced() {
        let status
        
        try {
            status = await this.exec('mnsync', ['status'])
        } catch (e) {
            return false
        }
        
        return status.AssetID === 999
    }
    
    getRpcClient() {
        if (!this.rpcClient) {
            this.rpcClient = jayson.client.http(
                `http://${this.config.rpcuser}:${this.config.rpcpassword}@localhost:${this.config.rpc_port || 10211}`
            )
        }
        
        return this.rpcClient
    }
    
    static parseConfig(configFile) {
        const ret = {}
        const raw = fs.readFileSync(configFile).toString().split(os.EOL).filter(l => l.trim()).map(l => l.split('='))
        
        raw.map(l => {
            ret[l[0]] = l[1]
        })
        
        return ret
    }
}