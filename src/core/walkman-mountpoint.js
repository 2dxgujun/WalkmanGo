import drivelist from 'drivelist'
import inquirer from 'inquirer'
import fse from 'fs-extra'
import path from 'path'
import { Log } from '../utils/logger'

Promise.promisifyAll(drivelist)

export class NoMountpointFoundError extends Error {}

export function getWalkmanMountpoints() {
  return findMountpoints()
    .then(mountpoints => {
      if (mountpoints && mountpoints.length) return mountpoints
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
          if (ans.charge)
            throw new NoMountpointFoundError(
              'No mountpoints since connect for charge'
            )
          Log.i('No mountpoint found, please turn on USB mass storage')
          return findMountpointsAwait(15000).catch(Promise.TimeoutError, () => {
            throw new NoMountpointFoundError(
              'No mountpoints since timeout after 15 seconds'
            )
          })
        })
    })
    .catch(err => {
      throw new NoMountpointFoundError(err)
    })
}

function findMountpointsAwait(millis) {
  function findMountpointsRecursive() {
    return findMountpoints().then(mountpoints => {
      if (mountpoints && mountpoints.length) return mountpoints
      return Promise.delay(1000).then(findMountpointsRecursive)
    })
  }
  return findMountpointsRecursive().timeout(millis)
}

function findMountpoints() {
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
