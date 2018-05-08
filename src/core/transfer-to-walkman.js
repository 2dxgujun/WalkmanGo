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
      return promptPickMountpoint()
    } else {
      return mountpoints[0]
    }
  })
}

function resolveMountpoint(mountpoints) {
  return Promise.filter(mountpoints, mountpoint => {
    
  })
}

function getWalkmanGoPath(base) {
  return path.resolve(base, 'MUSIC/WALKMANGO')
}

function promptPickMountpoint(mountpoints) {
  inquirer
    .prompt([
      {
        type: 'list',
        name: 'mountpoint',
        message: 'Pick a mountpoint for transfer playlists',
        choices: mountpoints
      }
    ])
    .then(answers => {
      console.log(answers)
    })
}

function findWalkmanDrives() {
  schedulerId = setInterval(() => {
    getWalkmanDrives()
      //.filter(drive => {
      //  return drive.mountpoints && drive.mountpoints.length > 0
      //})
      .then(drives => {
        if (drives && drives.length > 0) {
          onAdd(null, device)
        }
      })
  }, 3000)
}

function findWalkmanMountpoints() {
  return findWalkmanDrives().then(drives => {
    return Promise.filter(drives, drive => {
      return drive.mountpoints && drive.mountpoints.length > 0
    }).then(drives => {
      const result = []
      drives.forEach(drive => {
        drive.mountpoints.forEach(mountpoint => {
          result.push(mountpoint.path)
        })
      })
      return result
    })
  })
}

function findWalkmanDrives() {
  return drivelist.listAsync().filter(drive => {
    return drive.description.includes('WALKMAN')
  })
}
