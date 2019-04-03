import { Docker as D } from 'node-docker-api'
import config from "../config"
import common from "../common"

let instance

const log = (msg) => common.log(`[docker] ${msg}`)

export default class Docker {
    constructor(socket) {
        this.client = new D(socket)
    }
    
    async test() {
        try {
            await this.getContainers()
        } catch (e) {
            throw new Error('could not connect to Docker daemon')
        }
    }
    
    async getContainers() {
        return await this.client.container.list({ all: 1 })
    }
    
    async getContainer(name) {
        const list = (await this.getContainers()).filter(c => Docker.getName(c) === name)
        return list.length ? list[0] : null
    }
    
    async run(options) {
        await this.pull(options.Image)

        log(`creating container ${options.name}`)
        const container = await this.client.container.create(options)

        log(`starting container ${options.name}`)
        await container.start()
    }
    
    async rm(name) {
        log(`removing container ${name}`)
        await (await this.getContainer(name)).delete()
    }
    
    async pull(image) {
        log(`pulling image ${image}`)
        
        const imageArr = image.split(':')
        const stream = await this.client.image.create({}, { fromImage: imageArr[0], tag: imageArr[1] || 'latest' })
        await (common.promisifyStream(stream))
        const status = await this.client.image.get('ubuntu').status()
        
        if (!status) {
            throw new Error(`could not pull image ${image}`)
        }
    }
    
    static getName(container) {
        return container.data.Names[0].replace(/\/*/g, '')
    }
    
    static getInstance() {
        if (!instance) {
            instance = new Docker(config.docker_socket)
        }
        
        return instance
    }
}