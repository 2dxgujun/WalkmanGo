import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { User, Artist, Playlist, Song, Local } from '../../models'
import path from 'path'
import fse from 'fs-extra'
import meter from 'stream-meter'
import { Log } from '../../utils/logger'
import Processor from '../../utils/promise-processor'
import _ from 'lodash'
import ora from '../../utils/ora++'
import progress from 'progress-stream'

export default function() {
  const spinner = ora('Start pipe audios')
  return prepare(spinner)
    .then(run)
    .then(() => {
      spinner.succeed()
    })
    .catch(err => {
      spinner.failed('Failed to download songs')
      return Log.e('Uncaught Error when download song', err)
    })
}

function prepare(spinner) {
  const processor = Processor.create()
  return findUserSongs()
    .map(song => {
      return song.findTargetAudio().then(audio => {
        if (!audio) return enqueueJob(processor, spinner, song)
      })
    })
    .return(processor)
}

function findUserSongs() {
  return User.current()
    .then(user => {
      return Promise.join(
        user.getPlaylists({
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
        }),
        user.getAlbums({
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
        }),
        (playlists, albums) => {
          return [
            ..._.flatten(playlists.map(playlist => playlist.songs)),
            ..._.flatten(albums.map(album => album.songs))
          ]
        }
      )
    })
    .then(songs => _.uniqBy(songs, 'id'))
}

function run(processor) {
  return processor.run()
}

function enqueueJob(processor, spinner, song) {
  return processor.add(() => {
    return getLocalAudioPath(song).then(audiopath => {
      return download(spinner, song)
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

function download(spinner, song) {
  return getLocalAudioPath(song).then(audiopath => {
    const tmppath = `${audiopath}.tmp`
    return getRemoteAudioFile(song)
      .then(qqmusic.getAudioStream)
      .then(source => {
        return new Promise((resolve, reject) => {
          getRemoteAudioSize(song)
            .then(size => {
              const m = meter()
              const p = progress({ length: size })
              const stream = source
                .pipe(m)
                .pipe(p)
                .pipe(fse.createWriteStream(tmppath))
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
  const { WALKMAN_GO_WORKDIR: workdir } = process.env
  return song.getTargetBitrate().then(bitrate => {
    const audiodir = path.resolve(workdir, 'music', bitrate)
    return fse
      .ensureDir(audiodir)
      .then(() => getLocalAudioFile(song))
      .then(audiofile => {
        return path.resolve(audiodir, audiofile)
      })
  })
}

function getLocalAudioFile(song) {
  return song.getTargetBitrate().then(bitrate => {
    let extname = '.mp3'
    if (bitrate === 'flac') extname = '.flac'
    let artistName = 'Unknown'
    if (song.artists && song.artists.length > 0) {
      artistName = `${song.artists[0].name}`
    }
    let audiofile = `${artistName} - ${song.name}${extname}`
    audiofile = audiofile.replace('/', ',')
    return audiofile
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
