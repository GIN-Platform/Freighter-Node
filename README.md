# GIN Freighter

The GIN Freigther software is the node.js implementation of the [GEA Protocol](https://docs.gincoin.io/whitepaper) created by the GIN Platform for the distribution of masternode deployments as Cargo.

**This software is experimental and may cause unexpected behaviour.**

## Requirements

* Linux OS, Ubuntu 18.04 is recommended
* Docker, latest version is recommended ([install guide](https://docs.docker.com/install/linux/docker-ce/ubuntu/)); your user should be in the `docker` group and be allowed to execute docker commands; test this with `docker ps` which should not return an error
* Node.js >= 8

## Setup

Register a domain or point a subdomain of an existing domain to your Gincoin masternode IP.

Setup `config.json` with the newly configured domain as per the instructions  

```bash
git clone https://github.com/GIN-Platform/Freighter-Node.git freighter
cd freighter
npm install

#launch freighter in dev mode
node ./node_modules/@babel/node/bin/babel-node.js src/

## Build and run as daemon
npm install -g forever
npm run build
forever start dist/
```

## Configuration

The configuration file defaults to `~/.freighter/config.json` and can be overridden by the env var `FREIGHTER_CONFIG_PATH`.

**Configuration options**

| Key | Value | Default |
|-----|-------|---------|
| gincoin_config | Path to gincoin.conf | ~/.gincoincore/gincoin.conf |
| domain | DNS name that resolves to the GIN masternode IPv4 address | null |
| id | ID of the Freighter obtained from DAM after FRegister | null |
| secret | Secret used by the Freighter to authenticate itself, obtained from DAM after FRegister | null |

The starter configuration could look like this:

```json
{
  "gincoin_config": "/home/myuser/.gincoincore/gincoin.conf",
  "domain": "my-freighter.a-domain-i-own.com"
}
```

After a successful FRegister call the freighter software will save the ID and Secret received from the DAM in `config.json`.