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

const Log = new Logger('DOWNLOAD')

export default function() {
  Log.d('Start download songs')
  return prepare()
    .then(run)
    .catch(err => {
      Log.e('Uncaught Error when download songs', err)
    })
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
            return prepareDownloadSong(processor, song)
          } else {
            return prepareCheckAudio(processor, song)
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
  return processor.add(() => {
    Log.d(`Downloading: ${toString(song)}`)
    return getAudioPath(song).then(audiopath => {
      return downloadSong(song)
        .then(() => {
          return processor
            .post(() => {
              return createAudio(song, audiopath)
            })
            .catch(err => {
              Log.e(`Create audio failed: ${audiopath}`, err)
            })
        })
        .catch(err => {
          Log.e(`Download failed: ${toString(song)}`, err)
        })
    })
  })
}

function prepareCheckAudio(processor, song) {
  return processor.add(() => {
    return getAudioPath(song).then(audiopath => {
      return processor
        .post(() => {
          return createAudioIfNotExists(song, audiopath)
        })
        .catch(err => {
          Log.e(`Check audio failed: ${audiopath}`, err)
        })
    })
  })
}

function createAudioIfNotExists(song, audiopath) {
  return Local.findOne({
    where: {
      path: audiopath
    }
  }).then(audio => {
    if (!audio) {
      return createAudio(song, audiopath)
    }
  })
}

function createAudio(song, audiopath) {
  return fse.stat(audiopath).then(stats => {
    return sequelize.transaction(t => {
      return Local.create(
        {
          path: audiopath,
          mimeType: getMimeType(audiopath),
          length: stats.size
        },
        { transaction: t }
      ).then(audio => {
        return song.setAudio(audio, { transaction: t })
      })
    })
  })
}

function downloadSong(song) {
  return getAudioPath(song).then(audiopath => {
    const tmppath = `${audiopath}.tmp`
    return qqmusic
      .getAudioStream(getTargetName(song))
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
        if (getTargetSize(song) != bytes) {
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

function toString(song) {
  let result
  if (song.artists && song.artists.length > 0) {
    result = `${song.artists[0].name} - ${song.name}${extname}`
  } else {
    result = `${song.name}${extname}`
  }
  result = result + ` (${getTargetSize(song)})`
  return result
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
