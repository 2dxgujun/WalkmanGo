import * as qqmusic from '../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song } from '../models'
import path from 'path'
import fs from 'fs'

Promise.promisifyAll(fs)

export default function() {
  return Song.all({
    include: [
      {
        model: Artist,
        as: 'artists'
      }
    ]
  }).map(
    song => {
      const audiopath = getAudioPath(song)
      return fs.accessAsync(audiopath).catch(() => {
        return fs.openAsync(audiopath, 'w').then(fd => {
          return qqmusic.getAudioStream(getFilename(song)).then(source => {
            return new Promise((resolve, reject) => {
              const stream = source.pipe(
                fs.createWriteStream(audiopath, { fd })
              )
              source.on('error', reject)
              stream.on('error', reject)
              stream.on('finish', resolve)
            })
          })
        })
      })
    },
    { concurrency: 4 }
  )
}

function getAudioPath(song) {
  const songdir = process.env.walkman_config_songdir
  const audioext = getFilename(song).split('.')[1]
  const songfile = `${song.artists[0].name}-${song.name}.${audioext}`
  const audiopath = path.resolve(songdir, songfile)
  return audiopath
}

function getFilename(song) {
  const bitrate = process.env.walkman_config_bitrate
  if (bitrate === 'flac' && song.sizeflac > 0) {
    return `F000${song.mid}.flac`
  } else if ((bitrate === 'flac' || bitrate === '320') && song.size320 > 0) {
    return `M800${song.mid}.mp3`
  } else if (
    (bitrate === 'flac' || bitrate === '320' || bitrate === '128') &&
    song.size128 > 0
  ) {
    return `M500${song.mid}.mp3`
  } else {
    throw new Error('Unrecognized bitrate')
  }
}
