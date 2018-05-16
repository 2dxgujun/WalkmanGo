import path from 'path'

var walkmanMountpoint = null

export function setWalkmanMountpoint(mountpoint) {
  walkmanMountpoint = mountpoint
}

export function getWalkmanMountpoint() {
  return walkmanMountpoint
}

export function getWalkmanRootPath(mountpoint = getWalkmanMountpoint()) {
  if (mountpoint) {
    return Promise.resolve(path.resolve(mountpoint.path, 'MUSIC'))
  }
  return Promise.reject('Walkman mountpoint not found')
}

export function getWalkmanGoPath(mountpoint = getWalkmanMountpoint()) {
  if (mountpoint) {
    return getWalkmanRootPath(mountpoint).then(walkmanRootPath => {
      return path.resolve(walkmanRootPath, 'WALKMANGO')
    })
  }
  return Promise.reject('Walkman mountpoint not found')
}
