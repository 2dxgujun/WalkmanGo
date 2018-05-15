import drivelist from 'drivelist'
import inquirer from 'inquirer'
import fse from 'fs-extra'
import path from 'path'
import { Log } from '../../utils/logger'
import { getWalkmanGoPath } from '../walkman-path'

Promise.promisifyAll(drivelist)

export default function() {
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
          if (ans.charge) return null
          Log.i('No mountpoint found, please turn on USB mass storage')
          return findMountpointAwait(15000).catch(Promise.TimeoutError, () => {
            Log.d('No mountpoint found after 15 seconds')
            return null
          })
        })
    })
    .then(mountpoint => {
      process.env.WALKMAN_GO_MOUNTPOINT = mountpoint
    })
}

function findMountpointAwait(millis) {
  function findMountpointRecursive() {
    return findMountpoint().then(mountpoint => {
      if (mountpoint) return mountpoint
      return Promise.delay(1000).then(findMountpointRecursive)
    })
  }
  return findMountpointRecursive().timeout(millis)
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

function findDesiredMountpoint(mountpoints) {
  return Promise.filter(mountpoints, mountpoint => {
    return getWalkmanGoPath(mountpoint).then(fse.pathExists)
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
