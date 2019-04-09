import os from 'os'

export default {
    config_path: process.env.FREIGHTER_CONFIG_PATH || os.homedir() + '/.freighter',
    gincoin_config_file: process.env.GINCOIN_CONFIG_PATH || os.homedir() + '/.gincoincore/gincoin.conf',
    gincoin_min_version: 1020000,
    gincoin_target_masternode_status: 'Masternode successfully started',
    docker_socket: process.env.DOCKER_SOCKET || null,
    servers: [
        {name: 'eu1', endpoint: 'https://eu1.fleet.ginplatform.io'},
        {name: 'dev1', endpoint: 'http://localhost:9080'},
    ],
    status_interval: process.env.FREIGHTER_STATUS_INTERVAL || 300 * 1000,
    garbage_collector_interval: process.env.FREIGHTER_GARBAGE_COLLECTOR_INTERVAL || 60 * 1000,
    dam_prefix: process.env.DAM_PREFIX || 'gp_',
}