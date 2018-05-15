import { CronJob } from 'cron'
import queue from './the-queue'
import Logger from '../utils/logger'

var job = null

const Log = new Logger('Schedule')

function enqueue() {
  if (queue.getPendingLength() > 0) {
    return
  }
  queue.add(require('./tasks/fetch-playlists'))
  queue.add(require('./tasks/download-songs'))
  queue.add(require('./tasks/download-album-artworks'))
  queue.add(require('./tasks/optimize-tags'))
  queue.add(require('./tasks/add-album-artworks'))
}

export function schedule() {
  if (job) {
    Log.d('Re-Schedule')
    return Promise.try(() => {
      job.start()
    })
  }
  Log.d('Schedule')

  const sequelize = require('../models').default
  return sequelize
    .authenticate()
    .then(() => {
      return sequelize.sync()
    })
    .then(() => {
      job = new CronJob(
        `00 */5 * * * *`,
        enqueue,
        null, // onComplete
        true, // start now
        'Asia/Shanghai',
        null, // context
        true // run on init
      )
      return job
    })
}

export function unschedule() {
  Log.d('Unschedule')
  return Promise.try(() => {
    if (job) job.stop()
  })
}
