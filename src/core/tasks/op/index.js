import fse from 'fs-extra'

export function copy(src, dest) {
  return () => {
    return new Copy(src, dest).execute()
  }
}

export function remove(path) {
  return () => {
    return new Remove(path).execute()
  }
}

export default class Op {
  constructor(type) {
    if (this.constructor === Op) {
      throw new TypeError('Can not construct abstract class.')
    }
    this.type = type
  }
}

class Copy extends Op {
  constructor(src, dest) {
    super('COPY')
    this.src = src
    this.dest = dest
  }

  execute() {
    const { src, dest } = this
    const tmppath = `${dest}.tmp`
    return fse.copy(src, tmppath).then(() => {
      return fse.rename(tmppath, dest)
    })
  }
}

class Remove extends Op {
  constructor(path) {
    super('REMOVE')
    this.path = path
  }

  execute() {
    const { path } = this
    return fse.remove(path)
  }
}
