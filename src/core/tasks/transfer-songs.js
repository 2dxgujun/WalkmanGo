import fse from 'fs-extra'
import path from 'path'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import Processor from '../../utils/promise-processor'
import Logger from '../../utils/logger'
import { ensureMountpoint, getWalkmanGoPath } from '../walkman-path'

const Log = new Logger('TRANSFER_SONGS')

export default function() {
  Log.d('Start transfer songs')
  return prepare()
    .then(run)
    .then(() => {
      Log.d('Done transfer songs')
    })
    .catch(err => {
      Log.e('Uncaught Error when transfer songs', err)
    })
}

function prepare() {
  const processor = Processor.create()
  return ensureMountpoint()
    .then(mountpoint => {
      return getWalkmanGoPath(mountpoint)
        .then(fse.ensureDir)
        .then(() => {
          return Promise.join(
            prepareCopySongs(processor, mountpoint),
            prepareRemoveSongs(processor, mountpoint)
          )
        })
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function prepareCopySongs(processor, mountpoint) {
  return findAllPlaylists().map(playlist => {
    return Promise.filter(playlist.songs, song => {
      if (song.audio) {
        return fse.pathExists(song.audio.path).then(exists => !exists)
      }
      return false
    }).map(song => {
      return processor.add(() => {
        Log.d(`Copy song ${song.name}`)
        return getWalkmanAudioPath(mountpoint, playlist, song)
          .then(walkmanAudioPath => {
            return fse.ensureDir(path.dirname(walkmanAudioPath)).then(() => {
              return copy(song.audio.path, walkmanAudioPath)
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
  return findAllPlaylists().then(playlists => {
    return getWalkmanGoPath(mountpoint).then(walkmanGoPath => {
      return fse.readdir(walkmanGoPath).map(playlistDir => {
        const playlist = playlists.find(playlist => {
          return playlist.name === playlistDir
        })
        if (!playlist) {
          // playlist not found
          return processor.add(() => {
            Log.d(`Remove playlist dir ${playlistDir}`)
            return fse
              .remove(path.resolve(walkmanGoPath, playlistDir))
              .catch(err => {
                Log.e(`Remove playlist dir failed: ${playlistDir}`, err)
              })
          })
        } else {
          // playlist found, go inside playlist dir
          return fse
            .readdir(path.resolve(walkmanGoPath, playlistDir))
            .map(audiofile => {
              const song = playlist.songs.find(song => {
                return path.basename(song.audio.path) === audiofile
              })
              if (!song) {
                // song not found
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
        }
      })
    })
  })
}

function findAllPlaylists() {
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
            as: 'audio'
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

function getWalkmanAudioPath(mountpoint, playlist, song) {
  return getWalkmanGoPath(mountpoint).then(walkmanGoPath => {
    return path.resolve(
      walkmanGoPath,
      playlist.name,
      path.basename(song.audio.path)
    )
  })
}
