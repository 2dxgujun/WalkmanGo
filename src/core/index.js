import * as qqmusic from '../vendor/qqmusic'
import { CronJob } from 'cron'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song } from '../models'
import Queue from 'promise-queue'
import fs from 'fs'
import path from 'path'

import fetch_data from './fetch-data'
import obtain_album_art from './obtain-album-art'

const queue = new Queue(1 /*max concurrent*/, Infinity)

export function schedule() {
  new CronJob(
    `00 */${process.env.walkman_config_period} * * * *`,
    run,
    null, // onComplete
    true, // start now
    'Asia/Shanghai',
    null, // context
    true // run on init
  )
}

function run() {
  queue.add(obtain_album_art).catch(err => {
    console.error(err)
  })
  //queue.add(FetchAndPersistSongs).catch(err => {
  //  console.error(err)
  //})
  //queue.add(DownloadSongs).catch(err => {
  //  console.error(err)
  //})
}

function DownloadSongs() {
  return Song.all({
    include: [
      {
        model: Artist,
        as: 'artists'
      }
    ]
  }).map(
    song => {
      const songdir = process.env.walkman_config_songdir
      const songfile = `${song.artists[0].name}-${song.name}.${ext(song)}`
      const songpath = path.resolve(songdir, songfile)
      return Promise.promisify(fs.access)(songpath).catch(err => {
        return Promise.promisify(fs.open)(songpath, 'w').then(fd => {
          const dest = fs.createWriteStream(songpath, {
            fd: fd,
            autoClose: true
          })
          return qqmusic.getAudioStream(getFilename(song)).then(source => {
            return new Promise((resolve, reject) => {
              source.pipe(dest)
              source.on('error', reject)
              dest.on('error', reject)
              dest.on('finish', resolve)
            })
          })
        })
      })
    },
    { concurrency: 4 }
  )
}

function ext(song) {
  const quality = process.env.walkman_config_quality
  if (quality === 'lossless' && song.sizeflac > 0) {
    return 'flac'
  } else {
    return 'mp3'
  }
}

function getFilename(song) {
  const quality = process.env.walkman_config_quality
  if (quality === 'lossless' && song.sizeflac > 0) {
    return `F000${song.mid}.flac`
  } else if (quality === 'high' && song.size320 > 0) {
    return `M800${song.mid}.mp3`
  } else if (quality === 'low' && song.size128 > 0) {
    return `M500${song.mid}.mp3`
  } else {
    throw new Error('')
  }
}
