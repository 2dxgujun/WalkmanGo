import Queue from 'promise-queue'
import os from 'os'

const numCPUs = os.cpus().length

export default class Processor extends Queue {
  static create() {
    return new Processor()
  }

  constructor(concurrency = numCPUs) {
    super(0, Infinity)
    this.concurrency = concurrency
    this.add = this.add.bind(this)
    this.run = this.run.bind(this)
    this.post = this.post.bind(this)
    this.blockingQueue = new Queue(1 /*max concurrent*/, Infinity)
    this.pending = null
  }

  post(generator) {
    return this.blockingQueue.add(generator)
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
