import { CronJob } from 'cron'
import queue from './the-queue'
import {
  attach_album_art,
  fetch_playlists,
  fetch_audios,
  fetch_album_art,
  create_m3u
} from './tasks'

var job = null

function enqueue(queue) {
  //queue.add(fetch_data).catch(err => {
  //  console.error(err)
  //})
  //queue.add(fetch_audio).catch(err => {
  //  console.error(err)
  //})
  //queue.add(fetch_album_art).catch(err => {
  //  console.error(err)
  //})
  //queue.add(attach_album_art).catch(err => {
  //  console.error(err)
  //})
  //queue.add(create_m3u).catch(err => {
  //  console.error(err)
  //})
}

function schedule() {
  if (job) {
    return Promise.try(() => {
      job.start()
    })
  }

  const sequelize = require('./models').default
  return sequelize
    .authenticate()
    .then(() => {
      return sequelize.sync()
    })
    .then(() => {
      job = new CronJob(
        `00 */5 * * * *`,
        () => {
          return enqueue(queue)
        },
        null, // onComplete
        true, // start now
        'Asia/Shanghai',
        null, // context
        true // run on init
      )
      return job
    })
}

function unschedule() {
  return Promise.try(() => {
    if (job) job.stop()
  })
}

export default {
  schedule,
  unschedule
}
