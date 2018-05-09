import drivelist from 'drivelist'
import inquirer from 'inquirer'
import fse from 'fs-extra'
import path from 'path'
import flac from 'node-flac'
import mp3duration from 'mp3-duration'
import StringToStream from 'string-to-stream'
import M3UWriter from '../../utils/m3u-writer'
import meter from 'stream-meter'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import OpQueue from '../../utils/promise-queue-processor'

Promise.promisifyAll(drivelist)
const mp3durationAsync = Promise.promisify(mp3duration)

class MountpointNotFoundError extends Error {}

const queue = new OpQueue(4)

export default function() {
  return prepare()
    .then(transfer)
    .catch(MountpointNotFoundError, e => {
      console.error(e)
    })
}

function ensureMountpoint() {
  return findMountpoint().then(mountpoint => {
    if (mountpoint) return mountpoint
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
        if (ans.charge) throw new MountpointNotFoundError('Connect for charge')
        console.log('No mountpoint found, please turn on USB mass storage')
        return findMountpointRecursive()
          .timeout(15000)
          .catch(Promise.TimeoutError, () => {
            throw new MountpointNotFoundError(
              'No mountpoint found after 15 seconds, please try again later'
            )
          })
      })
  })
}

class Op {
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
    const tmp = `${dest}.tmp`
    return fse.copy(src, tmp).then(() => {
      return fse.rename(tmp, dest)
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

class Write extends Op {
  constructor(content, dest) {
    super('WRITE')
    this.content = content
    this.dest = dest
  }

  execute() {
    const { content, dest } = this
    const tmp = `${dest}.tmp`
    return new Promise((resolve, reject) => {
      const stream = StringToStream(content).pipe(fse.createWriteStream(tmp))
      stream.on('error', reject)
      stream.on('finish', () => {
        fse
          .rename(tmp, dest)
          .then(resolve)
          .catch(reject)
      })
    })
  }
}

function enqueueOp(op, callback) {
  return queue.enqueue(() => {
    return op.execute()
  }, callback)
}

function prepareCopySongs(mountpoint) {
  return findAllPlaylists().map(playlist => {
    return Promise.filter(playlist.songs, song => {
      if (song.audio) return fse.pathExists(song.audio.path)
      return false
    }).map(song => {
      return getWalkmanAudioPath(mountpoint, playlist, song).then(
        walkmanAudioPath => {
          return enqueueOp(new Copy(song.audio.path, walkmanAudioPath), err => {
            // TODO
          })
        }
      )
    })
  })
}

function prepareRemoveSongs(mountpoint) {
  return findAllPlaylists().then(playlists => {
    return getWalkmanGoDir(mountpoint).then(walkmanGoDir => {
      return fs.readdir(walkmanGoDir).map(playlistDir => {
        const playlist = playlists.find(playlist => {
          return playlist.name === playlistDir
        })
        if (!playlist) {
          // playlist not found
          return enqueueOp(
            new Remove(path.resolve(walkmanGoDir, playlistDir)),
            err => {
              // TODO
            }
          )
        } else {
          // playlist found, go inside playlist dir
          return fs
            .readdir(path.resolve(walkmanGoDir, playlistDir))
            .map(audiofile => {
              const song = playlist.songs.find(song => {
                return path.basename(song.audio.path) === audiofile
              })
              if (!song) {
                // song not found
                return enqueueOp(
                  new Remove(
                    path.resolve(walkmanGoDir, playlistDir, audiofile)
                  ),
                  err => {
                    // TODO
                  }
                )
              }
            })
        }
      })
    })
  })
}

function findAllPlaylists() {
  return Playlist.all({
    include: [
      {
        model: Song,
        as: 'songs',
        include: [
          {
            model: Artist,
            as: 'artists'
          },
          {
            model: Local,
            as: 'audio'
          }
        ]
      }
    ]
  })
}

function transfer(walkmanGoDir) {
  return transferAudios(walkmanGoDir)
    .then(() => {
      return transferPlaylists(walkmanGoDir)
    })
    .then(() => {
      return trim(walkmanGoDir)
    })
}

function trim(walkmanGoDir) {
  return Promise.resolve()
}

function transferAudios(walkmanGoDir) {
  return Playlist.all({
    include: [
      {
        model: Song,
        as: 'songs',
        include: [
          {
            model: Local,
            as: 'audio'
          }
        ]
      }
    ]
  })
    .map(playlist => {
      return Promise.filter(playlist.songs, song => {
        return getWalkmanAudioPath(walkmanGoDir, playlist, song).then(dest => {
          return fse.pathExists(dest).then(exists => {
            return !exists
          })
        })
      }).map(song => {
        return getWalkmanAudioPath(walkmanGoDir, playlist, song).then(dest => {
          return fse.ensureDir(path.dirname(dest)).then(() => {
            return {
              src: song.audio.path,
              dest
            }
          })
        })
      })
    })
    .reduce((acc, tasks) => {
      return acc.concat(tasks)
    })
    .map(copyFile, { concurrency: 4 })
}

function getWalkmanAudioDir(walkmanGoDir, playlist) {
  return Promise.resolve(path.resolve(walkmanGoDir, playlist.name))
}

function getWalkmanAudioPath(mountpoint, playlist, song) {
  return getWalkmanGoDir(mountpoint).then(walkmanGoDir => {
    return getWalkmanAudioDir(walkmanGoDir, playlist).then(walkmanAudioDir => {
      return path.resolve(walkmanAudioDir, path.basename(song.audio.path))
    })
  })
}

function findMountpointRecursive() {
  return findMountpoint().then(mountpoint => {
    if (mountpoint) return mountpoint
    return Promise.delay(1000).then(findMountpointRecursive)
  })
}

function findMountpoint() {
  return allWalkmanMountpoints().then(mountpoints => {
    if (!mountpoints || mountpoints.length === 0) {
      return null
    } else if (mountpoints.length > 1) {
      return desiredMountpoint(mountpoints).then(mountpoint => {
        if (mountpoint) return mountpoint
        return promptPickMountpoint(mountpoints)
      })
    } else {
      return mountpoints[0]
    }
  })
}

function getWalkmanGoDir(mountpoint) {
  return Promise.resolve(path.resolve(mountpoint.path, 'MUSIC/WALKMANGO'))
}

function desiredMountpoint(mountpoints) {
  return Promise.filter(mountpoints, mountpoint => {
    return getWalkmanGoDir(mountpoint).then(fse.pathExists)
  }).then(mountpoints => {
    if (mountpoints && mountpoints.length === 1) {
      return mountpoints[0]
    } else {
      return null
    }
  })
}

function promptPickMountpoint(mountpoints) {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'path',
      message: 'Pick a mountpoint to transfer playlists',
      choices: mountpoints.map(mountpoint => mountpoint.path)
    }
  ])
}

function allWalkmanMountpoints() {
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

function transferPlaylists(playlist) {
  return Playlist.all({
    include: [
      {
        model: Song,
        as: 'songs',
        include: [
          {
            model: Artist,
            as: 'artists'
          },
          {
            model: Local,
            as: 'audio'
          }
        ]
      }
    ]
  }).map(playlist => {
    const m3uWriter = new M3UWriter()
  })
  return getPlaylistUrlPath(playlist).then(m3upath => {
    const temppath = `${m3upath}.temp`
    return new Promise((resolve, reject) => {
      const m = meter()
      const stream = StringToStream(m3u)
        .pipe(m)
        .pipe(fse.createWriteStream(temppath))
      stream.on('error', reject)
      stream.on('finish', () => {
        resolve(m.bytes)
      })
    }).then(bytes => {
      return fse.rename(temppath, m3upath).then(() => {
        return bytes
      })
    })
  })
}

function createM3UStream(playlist) {
  return Promise.each(playlist.songs, song => {
    const audiofile = path.basename(song.audio)
  })
}

function getAudioDuration(song) {
  if (song.audio.mimeType === 'audio/flac') {
    return getAudioDurationFlac(song)
  } else if (song.audio.mimeType === 'audio/mp3') {
    return getAudioDurationMp3(song)
  } else {
    throw new Error('Unknown audio format')
  }
}

function getAudioStreamInfo(song) {
  return flac.metadata.new().then(it => {
    return flac.metadata.init(it, song.audio.path, true, false).then(() => {
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

function getAudioDurationFlac(song) {
  return getAudioStreamInfo(song).then(info => {
    if (info) {
      return parseInt(info.data.total_samples / info.data.sample_rate)
    }
    return -1
  })
}

function getAudioDurationMp3(song) {
  return mp3durationAsync(song.audio.path).then(duration => {
    return parseInt(duration)
  })
}

function getWalkmanPlaylistPath(mountpoint, playlist) {
  return getWalkmanGoDir(mountpoint).then(walkmanGoDir => {
    const m3ufile = `${playlist.name}.m3u`
    return path.resolve(walkmanGoDir, m3ufile)
  })
}
