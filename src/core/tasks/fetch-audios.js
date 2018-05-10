import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Artist, Playlist, Song, Local } from '../../models'
import path from 'path'
import fse from 'fs-extra'
import meter from 'stream-meter'
import Op from './op'
import Logger from '../../utils/logger'
import Processor from '../../utils/promise-processor'

const {
  walkman_config_bitrate: bitrate,
  walkman_config_workdir: workdir
} = process.env

const Log = new Logger('fetch audios')

class DownloadSong extends Op {
  constructor(song) {
    super('DOWNLOAD_SONG')
    this.song = song
  }

  execute() {
    return getAudioPath(this.song).then(audiopath => {
      const tmppath = `${audiopath}.tmp`
      return qqmusic
        .getAudioStream(getTargetName(this.song))
        .then(source => {
          return new Promise((resolve, reject) => {
            const m = meter()
            const stream = source.pipe(m).pipe(fse.createWriteStream(tmppath))
            source.on('error', reject)
            stream.on('error', reject)
            stream.on('finish', () => {
              resolve(m.bytes)
            })
          })
        })
        .then(bytes => {
          if (getTargetSize(this.song) != bytes) {
            throw new Error('Not match target audio size')
          }
          return fse.rename(tmppath, audiopath).return(bytes)
        })
    })
  }
}

export default function() {
  return prepare().then(run)
}

function prepare() {
  const processor = new Processor()
  return Song.all({
    include: [
      {
        model: Artist,
        as: 'artists'
      }
    ]
  })
    .map(song => {
      return getAudioPath(song).then(audiopath => {
        return fse.pathExists(audiopath).then(exists => {
          if (!exists) {
            processor
              .add(download(song))
              .then(bytes => {
                Log.d('Download succeed ' + song.name)
                markAudio(song, audiopath, bytes).catch(err => {
                  Log.e(`Mark ${song.name} failed`, err)
                })
              })
              .catch(err => {
                Log.e('Download error', err)
              })
          } else {
            // TODO Check mark
          }
        })
      })
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function download(song) {
  return () => {
    Log.d('Start downloading ' + song.name)
    return new DownloadSong(song).execute()
  }
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
  // TODO No transaction since concurrency
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
    songfile = songfile.replace('/', ',')
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
