import config from './config'
import fs from 'fs'
import path from 'path'

const delay = (duration) =>
    new Promise(resolve => setTimeout(resolve, duration))

const log = (message) =>
    console.log(`[${(new Date()).toISOString()}] ${message}`.replace(/\]\w+\[/g, ']['))

const abort = (message) => {
    console.error(`[error] ${message}`)
    log('aborting')
    process.exit(1)
}

const loadLocalConfig = () => {
    const file = config.config_file

    if (!fs.existsSync(file)) {
        log(`creating config file: ${file}`)

        try {
            const dir = path.dirname(file)

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir)
            }

            fs.writeFileSync(file, JSON.stringify({}) + '\n')
        } catch (e) {
            console.error(e)
            throw new Error(`could not create config file ${file}`)
        }
    } else {
        log(`loading config from ${file}`)
    }

    try {
        return JSON.parse(fs.readFileSync(file))
    } catch (e) {
        throw new Error(`could not parse contents of ${file} as JSON`)
    }
}

const writeLocalConfig = (configToWrite) => {
    fs.writeFileSync(config.config_file, JSON.stringify(configToWrite, null, 4))
}

export default {
    delay,
    log,
    abort,
    loadLocalConfig,
    writeLocalConfig
}