import Queue from 'promise-queue'
import os from 'os'
import Logger from './logger'

const numCPUs = os.cpus().length

const Log = new Logger('Processor')

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
    super
      .add(generator)
      .catch(err => {
        Log.e('Uncaught Error in processor: ', err)
      })
      .then(() => {
        if (this.pending && this.pendingPromises === 0) {
          this.resolve()
        }
      })
    return Promise.resolve()
  }

  run() {
    this.maxPendingPromises = this.concurrency
    while (this._dequeue()) {}
    this.pending = new Promise((resolve, reject) => {
      this.resolve = resolve
    })
    if (this.pendingPromises === 0) {
      return Promise.resolve()
    }
    return this.pending
  }
}
