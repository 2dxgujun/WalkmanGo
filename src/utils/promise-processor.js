import Queue from 'promise-queue'
import os from 'os'
import Logger from './logger'
import EventEmitter from 'events'
import { inherits } from 'util'

const numCPUs = os.cpus().length

inherits(Queue, EventEmitter)
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
      .add(() => {
        return Promise.try(() => {
          this.emit('progress', {
            length: this.length,
            index: this.index++
          })
          return generator()
        })
      })
      .then(() => {
        if (this.pendingPromises === 0) {
          this.resolve()
        }
      })
      .catch(err => {
        this.reject(err)
      })
    return Promise.resolve()
  }

  run() {
    this.maxPendingPromises = this.concurrency
    this.length = this.queue.length
    this.index = 0
    this.pending = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
    while (this._dequeue()) {}
    if (this.pendingPromises === 0) {
      this.resolve()
    }
    return this.pending
  }

  execute() {
    return run()
  }
}
