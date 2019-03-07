import { Docker as D } from 'node-docker-api'

export default class Docker {
    constructor(socket) {
        this.client = new D(socket)
    }
    
    async test() {
        try {
            await this.client.container.list()
        } catch (e) {
            throw new Error('could not connect to Docker daemon')
        }
    }
}