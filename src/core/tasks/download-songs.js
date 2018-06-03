import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { User, Artist, Playlist, Song, Local } from '../../models'
import path from 'path'
import fse from 'fs-extra'
import meter from 'stream-meter'
import { Log } from '../../utils/logger'
import Processor from '../../utils/promise-processor'
import sanitize from 'sanitize-filename'
import _ from 'lodash'
import ora from '../../utils/ora++'
import progress from 'progress-stream'

export default function() {
  return prepare().catch(err => {
    return Log.e('Uncaught Error when download song', err)
  })
}

function prepare() {
  const processor = Processor.create()
  const spinner = ora()
  processor.on('finish', progress => {
    spinner.succeed('Download songs, done.')
  })
  processor.on('error', err => {
    spinner.error('Download failed, check error log')
  })
  return Promise.join(
    User.getPlaylists(),
    User.getAlbums(),
    (playlists, albums) => {
      return [
        ..._.flatten(playlists.map(playlist => playlist.songs)),
        ..._.flatten(albums.map(album => album.songs))
      ]
    }
  )
    .then(songs => _.uniqBy(songs, 'id'))
    .filter(song => {
      return song.findTargetAudio().then(audio => !audio)
    })
    .map(song => {
      return enqueue(processor, song, spinner)
    })
    .then(processor.execute)
}

function enqueue(processor, song, spinner) {
  return processor.add(() => {
    return getLocalAudioPath(song).then(audiopath => {
      const tmppath = `${song.mid}.tmp`
      return download(song, tmppath, spinner)
        .then(() => {
          return processor
            .post(() => {
              return getLocalAudioPathNoClash(song).then(audiopath => {
                return fse
                  .rename(tmppath, audiopath)
                  .then(() => addAudio(song, audiopath))
              })
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

function download(song, audiopath, spinner) {
  return song
    .getTargetBitrate()
    .then(bitrate => {
      return qqmusic.getAudioStream(song.mid, bitrate)
    })
    .then(source => {
      return new Promise((resolve, reject) => {
        getRemoteAudioSize(song)
          .then(size => {
            const m = meter()
            const p = progress({ length: size })
            const stream = source
              .pipe(m)
              .pipe(p)
              .pipe(fse.createWriteStream(audiopath))
            p.on('progress', progress => {
              getLocalAudioFile(song).then(audiofile => {
                spinner.piping({ name: audiofile, progress })
              })
            })
            source.on('error', reject)
            stream.on('error', reject)
            stream.on('finish', () => {
              resolve(m.bytes)
            })
          })
          .catch(reject)
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

function getLocalAudioPathNoClash(song, number = 0) {
  return getLocalAudioPath(song, number).then(audiopath => {
    return fse.pathExists(audiopath).then(exists => {
      if (exists) return getLocalAudioPathNoClash(song, ++number)
      return audiopath
    })
  })
}

function getLocalAudioPath(song, number = 0) {
  const { WALKMAN_GO_WORKDIR: workdir } = process.env
  return song.getTargetBitrate().then(bitrate => {
    const audiodir = path.resolve(workdir, 'music', bitrate)
    return fse
      .ensureDir(audiodir)
      .then(() => getLocalAudioFile(song, number))
      .then(audiofile => {
        return path.resolve(audiodir, audiofile)
      })
  })
}

function getLocalAudioFile(song, number = 0) {
  return song.getTargetBitrate().then(bitrate => {
    let extname = '.mp3'
    if (bitrate === 'flac') extname = '.flac'
    let artistName = 'Unknown'
    if (song.artists && song.artists.length > 0) {
      artistName = `${song.artists[0].name}`
    }
    let numbername = ''
    if (number) {
      numbername = ` (${number})`
    }
    return sanitize(`${artistName} - ${song.name}${numbername}${extname}`, {
      replacement: '_'
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
