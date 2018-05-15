import fse from 'fs-extra'
import path from 'path'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import Processor from '../../utils/promise-processor'
import { Log } from '../../utils/logger'
import { ID_BITRATE } from '../consts'
import { getWalkmanGoPath } from '../walkman-path'
import ID3v2 from 'node-id3'

Promise.promisifyAll(ID3v2)

const { WALKMAN_GO_BITRATE } = process.env

export default function() {
  const { WALKMAN_GO_MOUNTPOINT: mountpoint } = process.env
  if (mountpoint) {
    Log.d('Start transfer songs')
    return prepare(mountpoint)
      .then(run)
      .catch(err => {
        Log.e('Uncaught Error when transfer songs', err)
      })
  } else {
    Log.w("No mountpoint, can't transfer songs")
  }
}

function prepare(mountpoint) {
  const processor = Processor.create()
  return getWalkmanGoPath(mountpoint)
    .then(fse.ensureDir)
    .then(() => {
      return Promise.join(
        prepareCopySongs(processor, mountpoint),
        prepareRemoveSongs(processor, mountpoint)
      )
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function prepareCopySongs(processor, mountpoint) {
  return allPlaylists().map(playlist => {
    return Promise.map(playlist.songs, song => {
      return Promise.filter(song.audios, audio => {
        return audio.SongAudio.bitrate === WALKMAN_GO_BITRATE
      }).any()
    }).map(audio => {
      return processor.add(() => {
        return getWalkmanAudioPath(mountpoint, playlist, audio)
          .then(walkmanAudioPath => {
            return fse
              .pathExists(walkmanAudioPath)
              .then(exists => {
                if (exists) {
                  return getAudioBitrate(walkmanAudioPath).then(bitrate => {
                    if (bitrate) {
                      return bitrate !== WALKMAN_GO_BITRATE
                    } else {
                      throw new Error('No bitrate information')
                    }
                  })
                }
                return true
              })
              .then(write => {
                if (write) {
                  return fse
                    .ensureDir(path.dirname(walkmanAudioPath))
                    .then(() => {
                      return copy(audio.path, walkmanAudioPath)
                    })
                }
              })
          })
          .catch(err => {
            Log.e(`Copy failed: ${song.name}`, err)
          })
      })
    })
  })
}

function prepareRemoveSongs(processor, mountpoint) {
  return allPlaylists().then(playlists => {
    return getWalkmanGoPath(mountpoint).then(walkmanGoPath => {
      return fse.readdir(walkmanGoPath).map(playlistDir => {
        const playlist = playlists.find(playlist => {
          return playlist.name === playlistDir
        })
        if (!playlist) {
          return processor.add(() => {
            Log.d(`Remove playlist dir ${playlistDir}`)
            return fse
              .remove(path.resolve(walkmanGoPath, playlistDir))
              .catch(err => {
                Log.e(`Remove playlist dir failed: ${playlistDir}`, err)
              })
          })
        }
        return fse
          .readdir(path.resolve(walkmanGoPath, playlistDir))
          .map(audiofile => {
            const song = playlist.songs.find(song => {
              const audio = song.audios.find(audio => {
                return audio.SongAudio.bitrate === WALKMAN_GO_BITRATE
              })
              if (audio) {
                return path.basename(audio.path) === audiofile
              } else {
                return false
              }
            })
            if (!song) {
              return processor.add(() => {
                Log.d(`Remove song ${song.name}`)
                return fse
                  .remove(path.resolve(walkmanGoPath, playlistDir, audiofile))
                  .catch(err => {
                    Log.e(`Remove song failed: ${song.name}`, err)
                  })
              })
            }
          })
      })
    })
  })
}

function allPlaylists() {
  return Playlist.all({
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
}

function copy(src, dest) {
  const tmppath = `${dest}.tmp`
  return fse.copy(src, tmppath).then(() => {
    return fse.rename(tmppath, dest)
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

function getAudioBitrate(audiopath) {
  if (path.extname(audiopath) === '.mp3') {
    return getAudioBitrate__MP3(audiopath)
  } else if (path.extname(audiopath) === '.flac') {
    return 'flac'
  } else {
    throw new Error('Unknown audio format')
  }
}

function getWalkmanAudioPath(mountpoint, playlist, audio) {
  return getWalkmanGoPath(mountpoint).then(walkmanGoPath => {
    return path.resolve(walkmanGoPath, playlist.name, path.basename(audio.path))
  })
}
