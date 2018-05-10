import { CronJob } from 'cron'
import queue from './the-queue'
import Logger from '../utils/logger'

var job = null

const Log = new Logger('schedule sync')

function enqueueTasks() {
  const {
    attachAlbumArt,
    fetchPlaylists,
    fetchAudios,
    fetchAlbumArt
  } = require('./tasks')
  
  // TODO Only enqueue if currently not pending
  Log.d('Enqueue tasks')
  //queue.add(fetchPlaylists).catch(err => {
  //  Log.e('Uncaught error when fetch playlists', err)
  //})
  //queue.add(fetchAudios).catch(err => {
  //  Log.e('Uncaught error when fetch audios', err)
  //})
  queue.add(fetchAlbumArt).catch(err => {
    Log.e('Uncaught error when fetch album art', err)
  })
  queue.add(attachAlbumArt).catch(err => {
    Log.e('Uncaught error when attach album art', err)
  })
}

export function schedule() {
  if (job) {
    Log.d('Re schedule')
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
        enqueueTasks,
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
