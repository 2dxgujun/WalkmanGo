import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Artist, Playlist, Song, Local } from '../../models'
import path from 'path'
import fse from 'fs-extra'
import meter from 'stream-meter'
import { Log } from '../../utils/logger'
import Processor from '../../utils/promise-processor'

export default function() {
  Log.d('Start download songs')
  return prepare()
    .then(run)
    .catch(err => {
      return Log.e('Uncaught Error when download song', err)
    })
}

function prepare() {
  const processor = Processor.create()
  return Song.all({
    include: [
      {
        model: Artist,
        as: 'artists'
      },
      {
        model: Local,
        as: 'audios'
      }
    ]
  })
    .map(song => {
      return Promise.filter(song.audios, audio => {
        return audio.SongAudio.bitrate === getTargetBitrate(song)
      }).then(audios => {
        if (audios && !audios.length) {
          return prepareDownload(processor, song)
        }
      })
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function prepareDownload(processor, song) {
  return processor.add(() => {
    return getLocalAudioPath(song).then(audiopath => {
      Log.d(`Downloading: ${audiopath}`)
      return downloadSong(song)
        .then(() => {
          return processor
            .post(() => {
              return addAudio(song, audiopath)
            })
            .catch(err => {
              Log.e(`Add audio failed: ${audiopath}`, err)
            })
        })
        .catch(err => {
          Log.e(`Download failed: ${audiopath}`, err)
        })
    })
  })
}

function addAudio(song, audiopath) {
  return sequelize.transaction(t => {
    return Local.create(
      {
        path: audiopath,
        mimeType: getMimeType(audiopath)
      },
      { transaction: t }
    ).then(audio => {
      return song.addAudio(audio, {
        through: { bitrate: getTargetBitrate(song) },
        transaction: t
      })
    })
  })
}

function downloadSong(song) {
  return getLocalAudioPath(song).then(audiopath => {
    const tmppath = `${audiopath}.tmp`
    return qqmusic
      .getAudioStream(getRemoteAudioFile(song))
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
        if (getRemoteAudioSize(song) != bytes) {
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

function getLocalAudioPath(song) {
  const { WALKMAN_GO_WORKDIR: workdir } = process.env
  const audiodir = path.resolve(workdir, 'music', getTargetBitrate(song))
  return fse.ensureDir(audiodir).then(() => {
    const extname = path.extname(getRemoteAudioFile(song))
    let artistName = 'Unknown'
    if (song.artists && song.artists.length > 0) {
      artistName = `${song.artists[0].name}`
    }
    const songfile = `${artistName} - ${song.name}${extname}`.replace('/', ',')
    return path.resolve(audiodir, songfile)
  })
}

function getRemoteAudioSize(song) {
  switch (getTargetBitrate(song)) {
    case 'flac':
      return song.sizeflac
    case '320':
      return song.size320
    case '128':
      return song.size128
  }
}

function getRemoteAudioFile(song) {
  switch (getTargetBitrate(song)) {
    case 'flac':
      return `F000${song.mid}.flac`
    case '320':
      return `M800${song.mid}.mp3`
    case '128':
      return `M500${song.mid}.mp3`
  }
}

function getTargetBitrate(song) {
  const { WALKMAN_GO_BITRATE: bitrate } = process.env
  if (bitrate === 'flac' && song.sizeflac > 0) {
    return 'flac'
  } else if ((bitrate === 'flac' || bitrate === '320') && song.size320 > 0) {
    return '320'
  } else if (
    (bitrate === 'flac' || bitrate === '320' || bitrate === '128') &&
    song.size128 > 0
  ) {
    return '128'
  } else {
    throw new Error('Unrecognized bitrate')
  }
}
