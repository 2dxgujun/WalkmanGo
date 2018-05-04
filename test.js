import mkdirp from 'mkdirp'
import Bluebird from 'bluebird'
import path from 'path'

const mkdirpAsync = Bluebird.promisify(mkdirp)

mkdirpAsync(path.resolve('hello/fuck/you'))
  .then(() => {
    console.log('ok')
  })
  .catch(err => {
    console.error(err)
  })
