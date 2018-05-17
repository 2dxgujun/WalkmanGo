import fse from 'fs-extra'
import path from 'path'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import Processor from '../../utils/promise-processor'
import { Log } from '../../utils/logger'
import { ID_BITRATE } from '../consts'
import { getWalkmanGoPath } from '../walkman-path'
import ID3v2 from 'node-id3'
import _ from 'lodash'

Promise.promisifyAll(ID3v2)

export default function() {
  Log.d('Start transfer songs')
  return prepare()
    .then(run)
    .catch(err => {
      Log.e('Uncaught Error when transfer songs', err)
    })
}

function prepare() {
  const processor = Processor.create()
  return getWalkmanGoPath()
    .then(() => {
      return Promise.join(
        prepareCopySongs(processor),
        prepareRemoveSongs(processor)
      )
    })
    .return(processor)
}

function run(processor) {
  return processor.run().then(() => {
    return getWalkmanGoPath().then(walkmanGoPath => {
      return fse.readdir(walkmanGoPath).map(playlistDir => {
        const playlistPath = path.resolve(walkmanGoPath, playlistDir)
        return fse.readdir(playlistPath).then(files => {
          // If playlist dir is empty
          if (!files.length) return fse.remove(playlistPath)
        })
      })
    })
  })
}

function prepareCopySongs(processor) {
  return Playlist.all({
    include: [
      {
        model: Song,
        as: 'songs',
        include: [
          {
            model: Local,
            as: 'audios'
          }
        ]
      }
    ]
  }).map(playlist => {
    return Promise.map(playlist.songs, song => song.findTargetAudio())
      .then(audios => _.filter(audios))
      .map(audio => {
        return getWalkmanAudioPath(playlist, audio).then(walkmanAudioPath => {
          return fse
            .pathExists(walkmanAudioPath)
            .then(exists => {
              if (exists) {
                return getAudioBitrate(walkmanAudioPath).then(bitrate => {
                  if (bitrate) {
                    return bitrate !== audio.SongAudio.bitrate
                  } else {
                    throw new Error('No bitrate information')
                  }
                })
              }
              return true
            })
            .then(write => {
              if (write) {
                return processor.add(() => {
                  Log.d(`Copying: ${walkmanAudioPath}`)
                  return fse
                    .ensureDir(path.dirname(walkmanAudioPath))
                    .then(() => {
                      const tmppath = `${walkmanAudioPath}.tmp`
                      return fse.copy(audio.path, tmppath).then(() => {
                        return fse.rename(tmppath, walkmanAudioPath)
                      })
                    })
                    .catch(err => {
                      Log.e(`Failed to copy: ${walkmanAudioPath}`, err)
                    })
                })
              }
            })
        })
      })
  })
}

function prepareRemoveSongs(processor) {
  return Playlist.all({
    include: [
      {
        model: Song,
        as: 'songs',
        include: [
          {
            model: Local,
            as: 'audios'
          }
        ]
      }
    ]
  })
    .map(playlist => {
      return Promise.all(playlist.songs)
        .then(songs => _.uniqBy(songs, 'id'))
        .map(song => song.findTargetAudio())
        .then(_.filter)
        .map(audio => getWalkmanAudioPath(playlist, audio))
    })
    .then(_.flatten)
    .then(walkmanAudioPaths => {
      return getWalkmanGoPath()
        .then(walkmanGoPath =>
          fse
            .readdir(walkmanGoPath)
            .map(file => path.resolve(walkmanGoPath, file))
        )
        .map(playlistPath =>
          fse
            .readdir(playlistPath)
            .map(file => path.resolve(playlistPath, file))
        )
        .then(_.flatten)
        .map(audiopath => audiopath.normalize()) // NOTE: Very important for mac fs
        .map(audiopath => {
          if (!walkmanAudioPaths.includes(audiopath)) {
            return processor.add(() => {
              Log.d(`Removing: ${audiopath}`)
              return fse.remove(audiopath).catch(err => {
                Log.e(`Failed to remove: ${audiopath}`, err)
              })
            })
          }
        })
    })
}

function getAudioBitrate__MP3(audiopath) {
  return ID3v2.readAsync(audiopath).then(tags => {
    const priv = tags['private']
    if (priv instanceof Array) {
      const p = priv.find(p => {
        return p.owner === ID_BITRATE
      })
      if (p) {
        return p.data.toString()
      }
      return false
    } else {
      if (priv.owner === ID_BITRATE) {
        return priv.data.toString()
      }
      return false
    }
  })
}

function getAudioBitrate__FLAC(audiopath) {
  return Promise.resolve('flac')
}

function getAudioBitrate(audiopath) {
  if (path.extname(audiopath) === '.mp3') {
    return getAudioBitrate__MP3(audiopath)
  } else if (path.extname(audiopath) === '.flac') {
    return getAudioBitrate__FLAC(audiopath)
  } else {
    throw new Error('Unknown audio format')
  }
}

function getWalkmanAudioPath(playlist, audio) {
  return getWalkmanGoPath().then(walkmanGoPath => {
    return path.resolve(walkmanGoPath, playlist.name, path.basename(audio.path))
  })
}
