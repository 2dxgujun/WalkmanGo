import queue from './the-queue'
import drivelist from 'drivelist'
import inquirer from 'inquirer'
import fse from 'fs-extra'
import path from 'path'

import { transfer_playlists } from './tasks'

Promise.promisifyAll(drivelist)

export default function() {}

function prepareTransfer() {
  return findWalkmanMountpoints().then(mountpoints => {
    if (!mountpoints || mountpoints.length === 0) {
      // prompt no mountpoints found
    } else if (mountpoints.length > 1) {
      return findTargetMountpoint(mountpoints).then(mountpoint => {
        if (mountpoint) return mountpoint
        return pickMountpoint(mountpoints)
      })
    } else {
      return mountpoints[0]
    }
  })
}

function getWalkmanGoPath(base) {
  return path.resolve(base, 'MUSIC/WALKMANGO')
}

function findTargetMountpoint(mountpoints) {
  return Promise.filter(mountpoints, mountpoint => {
    return fse.pathExists(getWalkmanGoPath(mountpoint.path))
  }).then(mountpoints => {
    if (mountpoints && mountpoints.length === 1) {
      return mountpoints[0]
    } else {
      return null
    }
  })
}

function pickMountpoint(mountpoints) {
  return inquirer
    .prompt([
      {
        type: 'list',
        name: 'mountpoint',
        message: 'Pick a mountpoint to transfer playlists',
        choices: mountpoints.map(mountpoint => mountpoint.path)
      }
    ])
    .then(answers => {
      console.log(answers)
    })
}

function findWalkmanMountpoints() {
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
