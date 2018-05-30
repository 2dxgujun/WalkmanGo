import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { User, Artist, Playlist, Song, Local } from '../../models'
import path from 'path'
import fse from 'fs-extra'
import meter from 'stream-meter'
import { Log } from '../../utils/logger'
import Processor from '../../utils/promise-processor'
import _ from 'lodash'

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
  return User.current()
    .then(user => {
      return user.getPlaylists({
        include: [
          {
            model: Song,
            as: 'songs',
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
          }
        ]
      })
    })
    .map(playlist => playlist.songs)
    .then(_.flatten)
    .then(songs => _.uniqBy(songs, 'id'))
    .map(song => {
      return song.findTargetAudio().then(audio => {
        if (!audio) return prepareDownload(processor, song)
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
      return song.getTargetBitrate().then(bitrate => {
        return song.addAudio(audio, {
          through: { bitrate },
          transaction: t
        })
      })
    })
  })
}

function downloadSong(song) {
  return getLocalAudioPath(song).then(audiopath => {
    const tmppath = `${audiopath}.tmp`
    return getRemoteAudioFile(song)
      .then(qqmusic.getAudioStream)
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
        return getRemoteAudioSize(song).then(size => {
          if (size != bytes) {
            throw new Error('Not match target audio size')
          }
          return fse.rename(tmppath, audiopath)
        })
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
  const { WALKMAN_GO_WORKDIR } = process.env
  return song.getTargetBitrate().then(bitrate => {
    const audiodir = path.resolve(WALKMAN_GO_WORKDIR, 'music', bitrate)
    return fse.ensureDir(audiodir).then(() => {
      return getRemoteAudioFile(song)
        .then(path.extname)
        .then(audioext => {
          let artistName = 'Unknown'
          if (song.artists && song.artists.length > 0) {
            artistName = `${song.artists[0].name}`
          }
          const audiofile = `${artistName} - ${song.name}${audioext}`.replace(
            '/',
            ','
          )
          return path.resolve(audiodir, audiofile)
        })
    })
  })
}

function getRemoteAudioSize(song) {
  return song.getTargetBitrate().then(bitrate => {
    switch (bitrate) {
      case 'flac':
        return song.sizeflac
      case '320':
        return song.size320
      case '128':
        return song.size128
    }
  })
}

function getRemoteAudioFile(song) {
  return song.getTargetBitrate().then(bitrate => {
    switch (bitrate) {
      case 'flac':
        return `F000${song.mid}.flac`
      case '320':
        return `M800${song.mid}.mp3`
      case '128':
        return `M500${song.mid}.mp3`
    }
  })
}
