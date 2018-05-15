import path from 'path'

export function getWalkmanRootPath(mountpoint) {
  return Promise.resolve(path.resolve(mountpoint, 'MUSIC'))
}

export function getWalkmanGoPath(mountpoint) {
  return getWalkmanRootPath(mountpoint).then(walkmanRootPath => {
    return path.resolve(walkmanRootPath, 'WALKMANGO')
  })
}
