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
    this.execute = this.execute.bind(this)
    this.post = this.post.bind(this)
    this.blockingQueue = new Queue(1 /*max concurrent*/, Infinity)
    this.pending = null
  }

  post(generator) {
    return this.blockingQueue.add(generator)
  }

  add(generator) {
    super
      .add(() => Promise.try(generator))
      .then(() => {
        this.emit('progress', {
          max: this.max,
          progress: ++this.progress
        })
        if (this.pendingPromises === 0) {
          this.resolve()
          this.emit('finish', this.progress)
        }
      })
      .catch(err => {
        this.reject(err)
        this.emit('error', err)
      })
    return Promise.resolve()
  }

  run() {
    this.maxPendingPromises = this.concurrency
    this.max = this.queue.length
    this.progress = 0
    this.pending = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
    while (this._dequeue()) {}
    if (this.pendingPromises === 0) {
      this.resolve()
      this.emit('finish', 0)
    }
    return this.pending
  }

  execute() {
    return this.run()
  }
}
