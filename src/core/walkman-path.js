import drivelist from 'drivelist'
import inquirer from 'inquirer'
import fse from 'fs-extra'
import path from 'path'

class MountpointNotFoundError extends Error {}

Promise.promisifyAll(drivelist)

export default {
  ensureMountpoint,
  getWalkmanGoDir,
  getWalkmanRootPath
}

function ensureMountpoint() {
  return findMountpoint().then(mountpoint => {
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
        if (ans.charge) throw new MountpointNotFoundError('Connect for charge')
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
}

function getWalkmanGoDir(mountpoint) {
  return Promise.resolve(path.resolve(mountpoint.path, 'MUSIC/WALKMANGO'))
}

function getWalkmanRootPath(mountpoint) {
  return Promise.resolve(path.resolve(mountpoint.path, 'MUSIC'))
}

function findDesiredMountpoint(mountpoints) {
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

function promptSelectMountpoint(mountpoints) {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'path',
      message: 'Pick a mountpoint to transfer playlists',
      choices: mountpoints.map(mountpoint => mountpoint.path)
    }
  ])
}

function findAllWalkmanMountpoints() {
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
