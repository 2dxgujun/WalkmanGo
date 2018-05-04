import * as qqmusic from '../vendor/qqmusic'
import { CronJob } from 'cron'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song } from '../models'
import Queue from 'promise-queue'
import fs from 'fs'
import path from 'path'

import fetch_data from './fetch-data'
import obtain_album_art from './obtain-album-art'
import obtain_audio from './obtain-audio'

const queue = new Queue(1 /*max concurrent*/, Infinity)

export function schedule() {
  new CronJob(
    `00 */5 * * * *`,
    run,
    null, // onComplete
    true, // start now
    'Asia/Shanghai',
    null, // context
    true // run on init
  )
}

function run() {
  queue.add(fetch_data).catch(err => {
    console.error(err)
  })
  queue.add(obtain_audio).catch(err => {
    console.error(err)
  })
  queue.add(obtain_album_art).catch(err => {
    console.error(err)
  })
}
