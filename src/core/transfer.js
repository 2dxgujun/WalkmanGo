import queue from './the-queue'

var isCanceled = false

export function transfer() {
  isCanceled = false
  return queue.add(run)
}

export function cancel() {
  isCanceled = true
  return Promise.resolve()
}

function run() {
  if (isCanceled) {
    return Promise.resolve()
  } else {
    const { transfer_playlists } = require('./tasks')
    return transfer_playlists()
  }
}
