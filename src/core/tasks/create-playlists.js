import flac from 'node-flac'
import mp3duration from 'mp3-duration'
import M3UWriter from '../../utils/m3u-writer'
import fse from 'fs-extra'
import path from 'path'
import Processor from '../../utils/promise-processor'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import {
  ensureMountpoint,
  getWalkmanGoPath,
  getWalkmanRootPath
} from '../walkman-path'
import StringToStream from 'string-to-stream'
import Logger from '../../utils/logger'

const mp3durationAsync = Promise.promisify(mp3duration)
const Log = new Logger('CREATE_PLAYLISTS')

export default function() {
  Log.d('Start create playlists')
  return prepare()
    .then(run)
    .catch(err => {
      Log.d('Uncaught Error when create playlists', err)
    })
}

function prepare() {
  const processor = Processor.create()
  return ensureMountpoint()
    .then(mountpoint => {
      return getWalkmanGoPath(mountpoint).then(walkmanGoPath => {
        return fse.readdir(walkmanGoPath).map(dir => {
          return processor.add(() => {
            Log.d(`Create playlist ${dir}`)
            return createPlaylist(mountpoint, dir).catch(err => {
              Log.e(`Create playlist failed`, err)
            })
          })
        })
      })
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function createPlaylist(mountpoint, name) {
  const writer = new M3UWriter()
  return getWalkmanGoPath(mountpoint).then(walkmanGoPath => {
    const playlistPath = path.resolve(walkmanGoPath, name)
    return fse
      .readdir()
      .map(audiofile => {
        const audiopath = path.resolve(playlistPath, audiofile)
        const title = path.basename(audiopath, path.extname(audiopath))
        const url = `WALKMANGO/${name}/${path.basename(audiopath)}`
        return getAudioDuration(audiopath).then(duration => {
          return writer.file(url, duration, title)
        })
      })
      .then(() => {
        return getWalkmanRootPath(mountpoint).then(walkmanRootPath => {
          const dest = path.resolve(walkmanRootPath, `${name}.m3u`)
          const tmppath = `${dest}.tmp`
          return new Promise((resolve, reject) => {
            const stream = StringToStream(writer.toString()).pipe(
              fse.createWriteStream(tmppath)
            )
            stream.on('error', reject)
            stream.on('finish', () => {
              fse
                .rename(tmppath, dest)
                .then(resolve)
                .catch(reject)
            })
          })
        })
      })
  })
}

function getAudioDuration(audiopath) {
  if (path.extname(audiopath) === '.flac') {
    return getAudioDurationFlac(audiopath)
  } else if (path.extname(audiopath) === '.mp3') {
    return getAudioDurationMp3(audiopath)
  } else {
    throw new Error('Unknown audio format')
  }
}

function getAudioStreamInfo(audiopath) {
  return flac.metadata.new().then(it => {
    return flac.metadata.init(it, audiopath, true, false).then(() => {
      function findStreamInfoRecursive(it) {
        return flac.metadata.get_block_type(it).then(type => {
          if (type === flac.format.MetadataType['STREAMINFO']) {
            return flac.metadata.get_block(it)
          }
          return flac.metadata.next(it).then(r => {
            if (r) return findStreamInfoRecursive(it)
            return null
          })
        })
      }
      return findStreamInfoRecursive(it)
    })
  })
}

function getAudioDurationFlac(audiopath) {
  return getAudioStreamInfo(audiopath).then(info => {
    if (info) {
      return parseInt(info.data.total_samples / info.data.sample_rate)
    }
    return -1
  })
}

function getAudioDurationMp3(audiopath) {
  return mp3durationAsync(audiopath).then(duration => {
    return parseInt(duration)
  })
}
