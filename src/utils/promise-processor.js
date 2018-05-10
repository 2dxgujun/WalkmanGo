import Queue from 'promise-queue'
import os from 'os'

const numCPUs = os.cpus().length

export default class extends Queue {
  constructor(concurrency = numCPUs) {
    super(0, Infinity)
    this.concurrency = concurrency
    this.add = this.add.bind(this)
    this.run = this.run.bind(this)
    this.pending = null
  }

  add(generator) {
    return new Promise((resolve, reject) => {
      super
        .add(() => {
          return Promise.try(() => {
            const value = generator()
            if (value && typeof value.then === 'function') {
              return value
            }
            return Promise.resolve(value)
          })
            .then(resolve)
            .catch(reject)
        })
        .then(() => {
          // this.add will always fulfilled
          if (this.pending && this.pendingPromises == 0) {
            this.resolve()
          }
        })
    })
  }

  run() {
    this.maxPendingPromises = this.concurrency
    while (this._dequeue()) {}
    this.pending = new Promise((resolve, reject) => {
      this.resolve = resolve
    })
    return this.pending
  }
}
