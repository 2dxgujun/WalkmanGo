import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Artist, Playlist, Song, Local } from '../../models'
import path from 'path'
import fse from 'fs-extra'
import meter from 'stream-meter'

const {
  walkman_config_bitrate: bitrate,
  walkman_config_workdir: workdir
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
      return getAudioPath(song).then(audiopath => {
        return fse.pathExists(audiopath).then(exists => {
          if (!exists) {
            return pipeAudio(song, audiopath).then(bytes => {
              return markAudio(song, audiopath, bytes)
            })
          }
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
        mimeType: getMimeType(audiopath),
        length: bytes
      },
      { transaction: t }
    ).then(audio => {
      return song.setAudio(audio, { transaction: t })
    })
  })
}

function pipeAudio(song, audiopath) {
  const temppath = `${audiopath}.temp`
  console.log(song.name)
  return qqmusic
    .getAudioStream(getTargetName(song))
    .then(source => {
      return new Promise((resolve, reject) => {
        const m = meter()
        const stream = source.pipe(m).pipe(fse.createWriteStream(temppath))
        source.on('error', reject)
        stream.on('error', reject)
        stream.on('finish', () => {
          resolve(m.bytes)
        })
      })
    })
    .then(bytes => {
      if (getTargetSize(song) != bytes) {
        throw new Error('Not match target audio size')
      }
      return fse.rename(temppath, audiopath).then(() => {
        return bytes
      })
    })
}

// TODO name contain /
function getAudioPath(song) {
  const audiodir = path.resolve(workdir, 'music')
  return fse.ensureDir(audiodir).then(() => {
    const extname = path.extname(getTargetName(song))
    let songfile
    if (song.artists && song.artists.length > 0) {
      songfile = `${song.artists[0].name} - ${song.name}${extname}`
    } else {
      songfile = `${song.name}${extname}`
    }
    const audiopath = path.resolve(audiodir, songfile)
    return audiopath
  })
}

function getTargetSize(song) {
  if (bitrate === 'flac' && song.sizeflac > 0) {
    return song.sizeflac
  } else if ((bitrate === 'flac' || bitrate === '320') && song.size320 > 0) {
    return song.size320
  } else if (
    (bitrate === 'flac' || bitrate === '320' || bitrate === '128') &&
    song.size128 > 0
  ) {
    return song.size128
  } else {
    throw new Error('Unrecognized bitrate')
  }
}

function getTargetName(song) {
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
