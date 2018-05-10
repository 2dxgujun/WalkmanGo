import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Artist, Playlist, Song, Local } from '../../models'
import path from 'path'
import fse from 'fs-extra'
import meter from 'stream-meter'
import Logger from '../../utils/logger'
import Processor from '../../utils/promise-processor'

const {
  walkman_config_bitrate: bitrate,
  walkman_config_workdir: workdir
} = process.env

const Log = new Logger('fetch audios')

export default function() {
  return prepare().then(run)
}

function prepare() {
  const processor = Processor.create()
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
            prepareDownloadSong(processor, song)
          } else {
            prepareCheckAudio(processor, song)
          }
        })
      })
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function prepareDownloadSong(processor, song) {
  processor.add(() => {
    return getAudioPath(song).then(audiopath => {
      return downloadSong(song)
        .then(bytes => {
          Log.d('Download song succeed')
          return processor
            .post(() => {
              return createAudio(song, audiopath, bytes)
            })
            .then(() => {
              Log.d('Create audio succeed')
            })
            .catch(err => {
              Log.e('Create audio failed', err)
            })
        })
        .catch(err => {
          Log.e('Download song failed', err)
        })
    })
  })
}

function prepareCheckAudio(processor, song) {
  processor.add(() => {
    return getAudioPath(song).then(audiopath => {
      return fse
        .stat(audiopath)
        .then(stats => {
          return processor.post(() => {
            return createAudioIfNotExists(song, audiopath, stats.size)
          })
        })
        .catch(err => {
          Log.e('Check audio failed', err)
        })
    })
  })
}

function createAudioIfNotExists(song, audiopath, bytes) {
  return Local.findOne({
    where: {
      path: audiopath,
      mimeType: getMimeType(audiopath),
      length: bytes
    }
  }).then(audio => {
    if (!audio) {
      return createAudio(song, audiopath, bytes)
    }
  })
}

function createAudio(song, audiopath, bytes) {
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

function downloadSong(song) {
  Log.d('Start downloading ' + song.name)
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
