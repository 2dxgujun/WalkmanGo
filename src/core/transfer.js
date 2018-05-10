import queue from './the-queue'

var isCanceled = false

export function transfer() {
  isCanceled = false
  return queue.add(run)
}

export function cancelTransfer() {
  isCanceled = true
  return Promise.resolve()
}

function run() {
  if (isCanceled) {
    return Promise.resolve()
  } else {
    const { transferSongs, createPlaylists } = require('./tasks')
    return transferSongs().then(createPlaylists)
  }
}
