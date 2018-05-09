import Queue from 'promise-queue'

export default class extends Queue {
  constructor(concurrency) {
    super(0, Infinity)
    this.concurrency = concurrency
    this.enqueue = this.enqueue.bind(this)
    this.run = this.run.bind(this)
    this.pending = null
  }

  enqueue(generator, callback) {
    this.add(generator)
      .then(() => {
        if (callback) {
          callback(null, arguments)
        }
      })
      .catch(err => {
        if (callback) {
          callback(err)
        }
      })
      .then(() => {
        if (this.pending && this.pendingPromises == 0) {
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
    return this.pending
  }
}
