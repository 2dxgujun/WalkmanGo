import queue from './the-queue'

export default function() {
  return queue.add(require('./tasks/transfer').default).then(() => {
    console.log('Finished')
  })
}
