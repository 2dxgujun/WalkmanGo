import drivelist from 'drivelist'
import inquirer from 'inquirer'
import fse from 'fs-extra'
import path from 'path'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'

Promise.promisifyAll(drivelist)

class MountpointNotFoundError extends Error {}

export default function() {
  return prepare()
    .then(transfer)
    .catch(MountpointNotFoundError, e => {
      console.error(e)
    })
}

function prepare() {
  return findMountpoint()
    .then(mountpoint => {
      if (mountpoint) return mountpoint
      return inquirer
        .prompt([
          {
            type: 'confirm',
            name: 'charge',
            message: 'Connect usb for charge?',
            default: 'false'
          }
        ])
        .then(ans => {
          if (ans.charge) throw new MountpointNotFoundError()
          console.log('No mountpoint found, please turn on USB mass storage')
          return findMountpointRecursive()
            .timeout(15000)
            .catch(Promise.TimeoutError, () => {
              throw new MountpointNotFoundError(
                'No mountpoint found after 15 seconds, please try again later'
              )
            })
        })
    })
    .then(getWalkmanGoDir)
    .then(dir => {
      return fse.ensureDir(dir).then(() => dir)
    })
}

function transfer(walkmanGoDir) {
  return transferAudios(walkmanGoDir)
    .then(() => {
      return transferM3Us(walkmanGoDir)
    })
    .then(() => {
      return trim(walkmanGoDir)
    })
}

function trim(walkmanGoDir) {
  return Promise.resolve()
}

function transferAudios(walkmanGoDir) {
  return Playlist.all({
    include: [
      {
        model: Song,
        as: 'songs',
        include: [
          {
            model: Local,
            as: 'audio'
          }
        ]
      }
    ]
  })
    .map(playlist => {
      return Promise.filter(playlist.songs, song => {
        return getWalkmanAudioPath(walkmanGoDir, playlist, song).then(dest => {
          return fse.pathExists(dest).then(exists => {
            return !exists
          })
        })
      }).map(song => {
        return getWalkmanAudioPath(walkmanGoDir, playlist, song).then(dest => {
          return fse.ensureDir(path.dirname(dest)).then(() => {
            return {
              src: song.audio.path,
              dest
            }
          })
        })
      })
    })
    .reduce((acc, tasks) => {
      return acc.concat(tasks)
    })
    .map(copyFile, { concurrency: 4 })
}

function transferM3Us(walkmanGoDir) {
  return Playlist.all({
    include: [
      {
        model: Local,
        as: 'url'
      }
    ]
  })
    .map(playlist => {
      return getWalkmanPlaylistUrlPath(walkmanGoDir, playlist).then(dest => {
        return {
          src: playlist.url.path,
          dest
        }
      })
    })
    .map(copyFile, { concurrency: 4 })
}

function copyFile(options) {
  const { src, dest } = task
  const temppath = `${dest}.temp`
  return fse.copy(src, temppath).then(() => {
    return fse.rename(temppath, dest)
  })
}

function getWalkmanPlaylistUrlPath(walkmanGoDir, playlist) {
  return Promise.resolve(
    path.resolve(walkmanGoDir, path.basename(playlist.url.path))
  )
}

function getWalkmanAudioDir(walkmanGoDir, playlist) {
  return Promise.resolve(path.resolve(walkmanGoDir, playlist.name))
}

function getWalkmanAudioPath(walkmanGoDir, playlist, song) {
  return getWalkmanAudioDir(walkmanGoDir, playlist).then(dir => {
    return path.resolve(dir, path.basename(song.audio.path))
  })
}

function findMountpointRecursive() {
  return findMountpoint().then(mountpoint => {
    if (mountpoint) return mountpoint
    return Promise.delay(1000).then(findMountpointRecursive)
  })
}

function findMountpoint() {
  return allWalkmanMountpoints().then(mountpoints => {
    if (!mountpoints || mountpoints.length === 0) {
      return null
    } else if (mountpoints.length > 1) {
      return desiredMountpoint(mountpoints).then(mountpoint => {
        if (mountpoint) return mountpoint
        return promptPickMountpoint(mountpoints)
      })
    } else {
      return mountpoints[0]
    }
  })
}

function getWalkmanGoDir(mountpoint) {
  return Promise.resolve(path.resolve(mountpoint.path, 'MUSIC/WALKMANGO'))
}

function desiredMountpoint(mountpoints) {
  return Promise.filter(mountpoints, mountpoint => {
    return getWalkmanGoDir(mountpoint).then(fse.pathExists)
  }).then(mountpoints => {
    if (mountpoints && mountpoints.length === 1) {
      return mountpoints[0]
    } else {
      return null
    }
  })
}

function promptPickMountpoint(mountpoints) {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'path',
      message: 'Pick a mountpoint to transfer playlists',
      choices: mountpoints.map(mountpoint => mountpoint.path)
    }
  ])
}

function allWalkmanMountpoints() {
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

function findWalkmanDrives() {
  return drivelist.listAsync().filter(drive => {
    return drive.description.includes('WALKMAN')
  })
}
