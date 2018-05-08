import Queue from 'promise-queue'

export default class extends Queue {
  constructor(concurrency) {
    super(0, Infinity)
    this.concurrency = concurrency
    this.push = this.push.bind(this)
    this.process = this.process.bind(this)
  }

  push(generator) {
    return this.add(generator)
  }

  process() {
    this.maxPendingPromises = this.concurrency
    while (this._dequeue()) {}
    return Promise.resolve()
  }
}
