import fse from 'fs-extra'
import path from 'path'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import Processor from '../../utils/promise-processor'
import { copy, remove } from './op'
import walkmanPath from '../walkman-path'

export default function() {
  return prepare()
    .then(execute)
    .catch(MountpointNotFoundError, e => {
      console.error(e)
    })
}

function prepare() {
  const processor = new Processor(4)
  return walkmanPath.ensureMountpoint().then(mountpoint => {
    return prepareTasks(processor, mountpoint)
  })
}

function prepareTasks(processor, mountpoint) {
  return prepareCopySongs(processor, mountpoint, err => {
    // TODO
  }).then(() => {
    return prepareRemoveSongs(processor, mountpoint, err => {
      // TODO
    })
  })
}

function execute(processor) {
  return processor.run()
}

function prepareCopySongs(processor, mountpoint, handler) {
  return findAllPlaylists().map(playlist => {
    return Promise.filter(playlist.songs, song => {
      if (song.audio) return fse.pathExists(song.audio.path)
      return false
    }).map(song => {
      return getWalkmanAudioPath(mountpoint, playlist, song).then(
        walkmanAudioPath => {
          return processor.add(copy(song.audio.path, walkmanAudioPath), handler)
        }
      )
    })
  })
}

function prepareRemoveSongs(processor, mountpoint, handler) {
  return findAllPlaylists().then(playlists => {
    return walkmanPath.getWalkmanGoDir(mountpoint).then(walkmanGoDir => {
      return fse.readdir(walkmanGoDir).map(playlistDir => {
        const playlist = playlists.find(playlist => {
          return playlist.name === playlistDir
        })
        if (!playlist) {
          // playlist not found
          return processor.add(
            remove(path.resolve(walkmanGoDir, playlistDir)),
            handler
          )
        } else {
          // playlist found, go inside playlist dir
          return fse
            .readdir(path.resolve(walkmanGoDir, playlistDir))
            .map(audiofile => {
              const song = playlist.songs.find(song => {
                return path.basename(song.audio.path) === audiofile
              })
              if (!song) {
                // song not found
                return processor.add(
                  remove(path.resolve(walkmanGoDir, playlistDir, audiofile)),
                  handler
                )
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

function getWalkmanAudioDir(mountpoint, playlist) {
  return walkmanPath.getWalkmanGoDir(mountpoint).then(walkmanGoDir => {
    return path.resolve(walkmanGoDir, playlist.name)
  })
}

function getWalkmanAudioPath(mountpoint, playlist, song) {
  return walkmanPath.getWalkmanGoDir(mountpoint).then(walkmanGoDir => {
    return getWalkmanAudioDir(walkmanGoDir, playlist).then(walkmanAudioDir => {
      return path.resolve(walkmanAudioDir, path.basename(song.audio.path))
    })
  })
}

function findMountpointRecursive() {
  return findMountpoint().then(mountpoint => {
    if (mountpoint) return mountpoint
    return Promise.delay(1000).then(findMountpointRecursive)
  })
}

function findMountpoint() {
  return findAllWalkmanMountpoints().then(mountpoints => {
    if (!mountpoints || mountpoints.length === 0) {
      return null
    } else if (mountpoints.length > 1) {
      return findDesiredMountpoint(mountpoints).then(mountpoint => {
        if (mountpoint) return mountpoint
        return promptSelectMountpoint(mountpoints)
      })
    } else {
      return mountpoints[0]
    }
  })
}
