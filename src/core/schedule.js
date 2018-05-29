import { CronJob } from 'cron'
import queue from './the-queue'
import { Log } from '../utils/logger'

var job = null

export function enqueue() {
  queue.add(require('./tasks/fetch-data').default)
  //queue.add(require('./tasks/download-songs').default)
  //queue.add(require('./tasks/download-album-artworks').default)
  //queue.add(require('./tasks/optimize-tags').default)
  //queue.add(require('./tasks/add-album-artworks').default)
}

export function schedule() {
  if (job) {
    Log.d('Re-Schedule')
    return Promise.try(() => {
      job.start()
    })
  }
  Log.d('Schedule')
  job = new CronJob(
    `00 */5 * * * *`,
    () => {
      if (queue.getPendingLength() > 0) {
        return
      }
      enqueue()
    },
    null, // onComplete
    true, // start now
    'Asia/Shanghai',
    null, // context
    true // run on init
  )
  return job
}

export function unschedule() {
  Log.d('Unschedule')
  return Promise.try(() => {
    if (job) job.stop()
  })
}
