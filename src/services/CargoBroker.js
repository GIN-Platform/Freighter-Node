import Docker from "./Docker"
import common from "../common"
import config from "../config"
import moment from "moment"

const docker = Docker.getInstance()
let instance

//container naming:
//gp_$type_$id_$expires

const isCargoContainer = (containerName) => {
    return (new RegExp(`^${config.dam_prefix}(job|daemon)_[^_]+_\\d+`)).test(containerName)
}

const getContainerName = (type, id, expires_at) => {
    return config.dam_prefix + [type, id, moment(expires_at).unix()].join('_')
}

const getName = (c) => Docker.getName(c)

const extractWorkload = (containerName) => {
    const arr = containerName.substr(config.dam_prefix.length).split('_')
    
    return {
        type: arr[0],
        id: arr[1],
        expires_at: (new Date(arr[2] * 1000)).toISOString()
    }
}

export default class CargoBroker {
    async list() {
        return (await docker.getContainers()).filter(c => isCargoContainer(getName(c))).map(c => extractWorkload(getName(c)))
    }
    
    async has(id) {
        return (await this.list()).filter(c => c.id === id).length > 0
    }
    
    async get(id) {
        return (await this.list()).filter(c => c.id === id)[0]
    }
    
    async deploy(cargo) {
        try {
            if (await this.has(cargo.id)) {
                throw new Error(`cargo container already running: ${cargo.id}`)
            }
            
            const options = {
                Image: cargo.image,
                name: getContainerName(cargo.type, cargo.id, cargo.expires_at)
            }

            if (cargo.command) {
                options.Cmd = cargo.command.split(' ')
            }
            
            await docker.run(options)
        } catch (e) {
            console.error(e)
            common.log(`could not launch docker container for ${cargo.id}`)
        }
    }
    
    async hasOrDeploy(data) {
        if (!(await this.has(data.id))) {
            common.log(`deploying ${data.type} ${data.id}`)
            await this.deploy(data)
        } else {
            common.log(`cargo ${data.id} is already deployed`)
        }
    }
    
    async garbageCollect() {
        for (let cargo of (await this.list())) {
            let status, container
            const containerName = getContainerName(cargo.type, cargo.id, cargo.expires_at)
            
            try {
                container = await docker.getContainer(containerName)
                status = (await container.status()).data.State
            } catch (e) {
                console.error(e)
                log(`can not get status for ${containerName}`)
                continue
            }
            
            if (status.Status === 'exited' && !status.Restarting) {
                try {
                    await docker.rm(containerName)
                } catch (e) {
                    console.error(e)
                    log(`can not remove container for ${containerName}`)
                }
                
                this.resultCallback && this.resultCallback({
                    id: cargo.id,
                    exit_code: status.ExitCode,
                    error: status.Error,
                    oom: status.OOMKilled,
                    run_seconds: moment(status.FinishedAt).diff(moment(status.StartedAt), 'seconds')
                })
            }
        }
    }
    
    setResultCallback(callback) {
        this.resultCallback = callback
    }

    static getInstance() {
        if (!instance) {
            instance = new CargoBroker()
        }

        return instance
    }
}