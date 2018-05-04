import * as qqmusic from '../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song } from '../models'
import path from 'path'
import fs from 'fs'
import mkdirp from 'mkdirp'
import meter from 'stream-meter'

Promise.promisifyAll(fs)
const mkdirpAsync = Promise.promisify(mkdirp)

const {
  walkman_config_bitrate: bitrate,
  walkman_config_songdir: songdir
} = process.env

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
        return mkdirpAsync(path.dirname(audiopath))
          .then(() => {
            return pipeAudio(song, audiopath)
          })
          .then(bytes => {
            return markAudio(song, audiopath, bytes)
          })
      })
    },
    { concurrency: 4 }
  )
}

function getMimeType(audiopath) {
  const extname = path.extname(audiopath)
  if (extname === '.mp3') {
    return 'audio/mp3'
  } else if (extname === '.flac') {
    return 'audio/flac'
  } else {
    throw new Error('Unrecognized audio type')
  }
}

function markAudio(song, audiopath, bytes) {
  return sequelize.transaction(t => {
    return Local.create(
      {
        path: audiopath,
        mime_type: getMimeType(audiopath),
        length: bytes
      },
      { transaction: t }
    ).then(audio => {
      return song.setAudio(audio, { transaction: t })
    })
  })
}

function pipeAudio(song, audiopath) {
  return qqmusic.getAudioStream(getFilename(song)).then(source => {
    return new Promise((resolve, reject) => {
      const m = meter()
      const stream = source.pipe(m).pipe(fs.createWriteStream(audiopath))
      source.on('error', reject)
      stream.on('error', reject)
      stream.on('finish', () => {
        resolve(m.bytes)
      })
    })
  })
}

function getAudioPath(song) {
  const extname = path.extname(getFilename(song))
  const songfile = `${song.artists[0].name}-${song.name}${extname}`
  const audiopath = path.resolve(songdir, songfile)
  return audiopath
}

function getFilename(song) {
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
