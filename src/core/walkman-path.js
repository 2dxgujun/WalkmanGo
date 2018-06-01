import drivelist from 'drivelist'
import inquirer from 'inquirer'
import fse from 'fs-extra'
import path from 'path'
import { Log } from '../utils/logger'

Promise.promisifyAll(drivelist)

function findWalkmanDrives() {
  return drivelist.listAsync().filter(drive => {
    return drive.description.includes('WALKMAN')
  })
}

export function findMountpointsAwait(millis) {
  function findMountpointsRecursive() {
    return findMountpoints().then(mountpoints => {
      if (mountpoints && mountpoints.length) return mountpoints
      return Promise.delay(1000).then(findMountpointsRecursive)
    })
  }
  return findMountpointsRecursive().timeout(millis)
}

export function findMountpoints() {
  return findWalkmanDrives().then(drives => {
    return Promise.filter(drives, drive => {
      return drive.mountpoints && drive.mountpoints.length > 0
    }).then(drives => {
      const mountpoints = []
      drives.forEach(drive => {
        mountpoints.push(...drive.mountpoints)
      })
      return mountpoints
    })
  })
}

export function getWalkmanMusicPath(mountpoint) {
  return Promise.resolve(path.resolve(mountpoint.path, 'MUSIC'))
}

export function getWalkmanPlaylistsPath(mountpoint) {
  return getWalkmanMusicPath(mountpoint).then(musicPath => {
    return path.resolve(musicPath, 'PLAYLISTS')
  })
}

export function getWalkmanPlaylistPath(mountpoint, playlist) {
  return getWalkmanPlaylistsPath(mountpoint).then(playlistsPath => {
    return path.resolve(playlistsPath, playlist.name)
  })
}

export function getWalkmanPlaylistURLPath(mountpoint, playlist) {
  return getWalkmanMusicPath(mountpoint).then(musicPath => {
    return path.resolve(musicPath, `${playlist.name}.m3u`)
  })
}

export function getWalkmanPlaylistAudioPath(mountpoint, playlist, audio) {
  return getWalkmanPlaylistPath(mountpoint, playlist).then(playlistPath => {
    return path.resolve(playlistPath, path.basename(audio.path))
  })
}

export function getWalkmanAlbumPath(mountpoint, album) {
  return getWalkmanMusicPath(mountpoint).then(musicPath => {
    return path.resolve(musicPath, `${album.artist.name} - ${album.name}`)
  })
}

export function getWalkmanAlbumAudioPath(mountpoint, album, audio) {
  return getWalkmanAlbumPath(mountpoint, album).then(albumPath => {
    return path.resolve(albumPath, path.basename(audio.path))
  })
}
