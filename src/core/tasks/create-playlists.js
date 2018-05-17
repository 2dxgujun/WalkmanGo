import FLAC from 'node-flac'
import mp3duration from 'mp3-duration'
import M3UWriter from '../../utils/m3u-writer'
import fse from 'fs-extra'
import path from 'path'
import Processor from '../../utils/promise-processor'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import StringToStream from 'string-to-stream'
import { Log } from '../../utils/logger'
import { getWalkmanGoPath, getWalkmanRootPath } from '../walkman-path'

const mp3durationAsync = Promise.promisify(mp3duration)

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
  return getWalkmanGoPath()
    .then(walkmanGoPath => {
      return fse.readdir(walkmanGoPath).map(playlistDir => {
        return processor.add(() => {
          Log.d(`Creating playlist: ${playlistDir}`)
          return create(playlistDir).catch(err => {
            Log.e(`Failed to create playlist: ${playlistDir}`, err)
          })
        })
      })
    })
    .then(() => {
      return getWalkmanRootPath().then(walkmanRootPath => {
        return fse
          .readdir(walkmanRootPath)
          .filter(file => {
            return file.endsWith('.m3u')
          })
          .map(playlistFile => {
            return fse.remove(path.resolve(walkmanRootPath, playlistFile))
          })
      })
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function create(name) {
  const writer = new M3UWriter()
  return getWalkmanGoPath().then(walkmanGoPath => {
    const playlistPath = path.resolve(walkmanGoPath, name)
    return fse
      .readdir(playlistPath)
      .map(audiofile => {
        const audiopath = path.resolve(playlistPath, audiofile)
        const title = path.basename(audiopath, path.extname(audiopath))
        const url = `WALKMANGO/${name}/${path.basename(audiopath)}`.normalize() // NOTE: normalize is necessary for mac
        return getAudioDuration(audiopath).then(duration => {
          return writer.file(url, duration, title)
        })
      })
      .then(() => {
        return getWalkmanRootPath().then(walkmanRootPath => {
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
    return getAudioDuration__FLAC(audiopath)
  } else if (path.extname(audiopath) === '.mp3') {
    return getAudioDuration__MP3(audiopath)
  } else {
    throw new Error('Unknown audio format')
  }
}

function getAudioStreamInfo(audiopath) {
  return FLAC.metadata_simple_iterator.new().then(it => {
    return FLAC.metadata_simple_iterator
      .init(it, audiopath, true, false)
      .then(() => {
        function findStreamInfoRecursive(it) {
          return FLAC.metadata_simple_iterator.get_block_type(it).then(type => {
            if (type === FLAC.MetadataType['STREAMINFO']) {
              return FLAC.metadata_simple_iterator.get_block(it)
            }
            return FLAC.metadata_simple_iterator.next(it).then(r => {
              if (r) return findStreamInfoRecursive(it)
              return null
            })
          })
        }
        return findStreamInfoRecursive(it)
      })
  })
}

function getAudioDuration__FLAC(audiopath) {
  return getAudioStreamInfo(audiopath).then(info => {
    if (info) {
      return parseInt(info.data.total_samples / info.data.sample_rate)
    }
    return -1
  })
}

function getAudioDuration__MP3(audiopath) {
  return mp3durationAsync(audiopath).then(duration => {
    return parseInt(duration)
  })
}
