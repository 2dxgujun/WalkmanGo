import flac from 'node-flac'
import mp3duration from 'mp3-duration'
import M3UWriter from '../../utils/m3u-writer'
import fse from 'fs-extra'
import path from 'path'
import Op from './op'
import Processor from '../../utils/promise-processor'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import walkmanPath from '../walkman-path'
import StringToStream from 'string-to-stream'

const mp3durationAsync = Promise.promisify(mp3duration)

class CreatePlaylist extends Op {
  constructor(path, name) {
    super('CREATE_PLAYLIST')
    this.path = path
    this.name = name
  }

  execute() {
    const { path, name } = this
    const writer = new M3UWriter()
    return fse
      .readdir(this.path)
      .map(audiofile => {
        const audiopath = path.resolve(this.path, audiofile)
        const title = path.basename(audiopath, path.extname(audiopath))
        const url = `WALKMANGO/${path.basename(this.path)}/${path.basename(
          audiopath
        )}`
        return getAudioDuration(audiopath).then(duration => {
          writer.file(url, duration, title)
        })
      })
      .then(() => {
        return walkmanPath.getWalkmanRootPath(walkmanRootPath => {
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
  }
}

export default function() {
  return prepare().then(execute)
}

function prepare() {
  const processor = new Processor(4)
  return walkmanPath.ensureMountpoint().then(mountpoint => {
    return walkmanPath.getWalkmanGoDir(mountpoint).then(walkmanGoDir => {
      return fse.readdir(walkmanGoDir).map(playlistDir => {
        return processor.add(() => {
          return new CreatePlaylist(
            path.resolve(walkmanGoDir, playlistDir),
            playlistDir
          ).execute()
        }, handler)
      })
    })
  })
}

function execute(processor) {
  return processor.run()
}

function getWalkmanPlaylistPath(mountpoint, playlist) {
  return walkmanPath.getWalkmanGoDir(mountpoint).then(walkmanGoDir => {
    return path.resolve(walkmanGoDir, `${playlist.name}.m3u`)
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
