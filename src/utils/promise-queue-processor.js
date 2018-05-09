import Queue from 'promise-queue'

export default class extends Queue {
  constructor(concurrency) {
    super(0, Infinity)
    this.concurrency = concurrency
    this.push = this.push.bind(this)
    this.process = this.process.bind(this)
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
    return Promise.resolve()
  }

  run() {
    this.maxPendingPromises = this.concurrency
    while (this._dequeue()) {}
    return Promise.resolve()
  }
}
