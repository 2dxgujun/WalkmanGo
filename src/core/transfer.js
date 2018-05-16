import queue from './the-queue'

export function transfer() {
  queue.add(require('./tasks/find-walkman-mountpoint').default)
  queue.add(require('./tasks/transfer-songs').default)
  queue.add(require('./tasks/create-playlists').default)
  return queue.add(() => {})
}
