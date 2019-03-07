import Freighter from './freighter'

for (let i = 0; i < 100; i++) {
    setTimeout(() => {
        const freighter = new Freighter()
        freighter.boot()
    }, Math.random() * 5 * 1000)
}

