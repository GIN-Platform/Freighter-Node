import '@babel/polyfill'
import Freighter from './services/Freighter'
import Gincoin from './services/Gincoin'
import Docker from './services/Docker'
import os from 'os'
import fs from 'fs'
import config from './config'
import common from './common'
import io from "socket.io-client"

let server, socket, gincoin, docker, freighter

const localConfig = common.loadLocalConfig()

const checkOs = () => {
    if (os.platform().indexOf('win') === 0) {
        common.abort('win32 support is not yet available')
    }
}

const checkDocker = async () => {
    try {
        docker = Docker.getInstance()
    } catch (e) {
        common.abort(`failed connecting to the Docker daemon`)
    }

    try {
        await docker.test()
    } catch (e) {
        common.abort(e)
    }
}

const checkGincoin = async () => {
    const gincoinConfigFile = localConfig.gincoin_config || config.gincoin_config_file
    
    if (!fs.existsSync(gincoinConfigFile)) {
        common.abort(`Gincoin config file does not exist: ${gincoinConfigFile}`)
    }
    
    common.log(`loading Gincoin configuration from ${gincoinConfigFile}`)
    
    const gincoinConfig = Gincoin.parseConfig(gincoinConfigFile)

    try {
        gincoin = new Gincoin(gincoinConfig)
    } catch (e) {
        common.abort(e)
    }

    try {
        await gincoin.test()
    } catch (e) {
        common.abort(e)
    }

    try {
        await gincoin.exec('masternode', ['status'])
    } catch (e) {
        common.abort(new Error('this is not a masternode'))
    }
}

const startNetwork = async (freighter) => {
    let result

    common.log('finding server with best connection')

    do {
        try {
            result = await findLowestLatencyServer()
        } catch (e) {
            await common.delay(5 * 1000)
        }
    } while (!result)

    common.log(`selecting ${result.server.name} as home server`)

    server = result.server
    socket = result.socket

    socket.on('disconnect', async () => {
        common.log('disconnected')
        
        if (freighter.connected) {
            const ms = Math.ceil(Math.random() * 60 * 1000)
            common.log(`reconnecting after ${Math.floor(ms / 1000)} seconds`)
            setTimeout(() => startNetwork(freighter), ms)
        }
    })

    freighter.boot(socket)
}

const findLowestLatencyServer = async () => {
    let best = null
    const preferred = localConfig.preferred_server
    const serverList = preferred ? config.servers.filter(s => s.name === preferred) : config.servers

    for (let server of serverList) {
        try {
            const result = await getServerLatency(server)

            common.log(`${server.name}: ${result.time}ms`)

            if (!best || best.time > result.time) {
                if (best) {
                    best.socket.close()
                }

                best = result
            }
        } catch (e) {
            common.log(`${server.name}: ${e.message}`)
        }
    }

    if (!best) {
        throw new Error('could not find a valid server')
    }

    return best
}

const getServerLatency = (server) => {
    return new Promise((s, f) => {
        const start = Date.now()
        const socket = io(server.endpoint)
        const timeout = 5 * 1000
        
        const close = (message) => {
            return () => {
                clearTimeout(t)
                socket.close()
                f(new Error(message))
            }
        }

        let t = setTimeout(() => f(new Error('connection timeout - no pong received')), timeout)

        socket.on('connect', () => {
            socket.on('FPong', () => {
                clearTimeout(t)
                s({server, socket, time: Date.now() - start})
            })

            socket.emit('FPing')
        })

        socket.on('connect_error', close('connection error'))
        socket.on('connect_timeout', close('connection timeout'))
    })
}

const boot = async () => {
    checkOs()
    await checkDocker()
    await checkGincoin()
    
    freighter = new Freighter(localConfig, gincoin)
    
    await startNetwork(freighter)
}

boot()