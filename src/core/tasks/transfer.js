import fse from 'fs-extra'
import path from 'path'
import sequelize, {
  User,
  Album,
  Artist,
  Playlist,
  Song,
  Local
} from '../../models'
import Processor from '../../utils/promise-processor'
import ID3v2 from 'node-id3'
import FLAC from 'node-flac'
import mp3duration from 'mp3-duration'
import M3UWriter from '../../utils/m3u-writer'
import StringToStream from 'string-to-stream'
import _ from 'lodash'
import { Log } from '../../utils/logger'
import ora from '../../utils/ora++'
import inquirer from 'inquirer'
import {
  findMountpoints,
  findMountpointsAwait,
  getWalkmanMountpointMusicPath,
  getWalkmanMountpointPlaylistsPath,
  getWalkmanMusicPath,
  getWalkmanPlaylistPath,
  getWalkmanPlaylistsPath,
  getWalkmanPlaylistURLPath,
  getWalkmanPlaylistAudioPath,
  getWalkmanAlbumPath,
  getWalkmanAlbumsPath,
  getWalkmanAlbumAudioPath
} from '../walkman-path'

Promise.promisifyAll(ID3v2)
const mp3durationAsync = Promise.promisify(mp3duration)

class NoMountpointError extends Error {}

export default function() {
  Log.d('Start transfer')
  const spinner = ora(
    'Starting transfer, please turn on USB mass storage'
  ).start()
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
          if (ans.charge) throw new NoMountpointError()
          return findMountpointsAwait(15000).catch(Promise.TimeoutError, () => {
            spinner.fail('No mountpoints since timeout after 15 seconds')
            throw new NoMountpointError()
          })
        })
    })
    .then(syncPlaylists)
    .then(syncAlbums)
    .catch(NoMountpointError, err => {
      Log.e(err)
    })
    .catch(err => {
      Log.e('Uncaught Error when transfer songs', err)
    })
}

function syncPlaylists(mountpoints) {
  return Promise.filter(mountpoints, mountpoint => {
    return getWalkmanPlaylistsPath(mountpoint).then(fse.pathExists)
  })
    .then(mountpoints => {
      if (mountpoints && mountpoints.length > 0) return mountpoints[0]
    })
    .then(mountpoint => {
      if (mountpoint) return mountpoint
      return inquirer.prompt([
        {
          type: 'list',
          name: 'path',
          message: 'Pick a mountpoint for transfer playlists',
          choices: mountpoints.map(mountpoint => mountpoint.path)
        }
      ])
    })
    .then(mountpoint => {
      return getWalkmanPlaylistsPath(mountpoint)
        .then(fse.ensureDir)
        .then(() => addOrRemovePlaylistSongs(mountpoint))
        .then(() => addOrRemovePlaylists(mountpoint))
        .return(mountpoint)
    })
    .return(mountpoints)
}

function syncAlbums(mountpoints) {
  return inquirer
    .prompt([
      {
        type: 'list',
        name: 'path',
        message: 'Pick a mountpoint for transfer albums',
        choices: mountpoints.map(mountpoint => mountpoint.path)
      }
    ])
    .then(mountpoint => {
      return addOrRemoveAlbums(mountpoint)
    })
}

function addOrRemovePlaylists(mountpoint, spinner) {
  const processor = Processor.create()
  const spinner = ora('Syncing playlists')
  processor.on('progress', ({ max, progress }) => {
    spinner.progress({
      text: 'Syncing playlists',
      max,
      progress
    })
  })
  processor.on('finish', progress => {
    if (progress) {
      spinner.done()
    } else {
      spinner.succeed('Syncing playlists: Up-to-date')
    }
  })
  processor.on('error', err => {
    spinner.error('Syncing playlists failed, check error log')
  })
  return User.getPlaylists()
    .map(playlist => {
      return getWalkmanPlaylistPath(mountpoint, playlist)
    })
    .then(playlistpaths => {
      return getWalkmanPlaylistsPath(mountpoint)
        .then(playlistspath => {
          return fse.readdir(playlistspath).map(file => {
            return path.resolve(playlistspath, file)
          })
        })
        .map(playlistpath => {
          if (!playlistpaths.includes(playlistpath)) {
            return getWalkmanMusicPath(mountpoint).then(musicpath => {
              return processor.add(() => {
                Log.i(`Removing playlist ${path.basename(playlistpath)}`)
                return Promise.join(
                  fse.remove(playlistpath),
                  fse.remove(
                    // prettier-ignore
                    path.resolve(musicpath,`${path.basename(playlistpath)}.m3u`)
                  )
                )
              })
            })
          } else {
            return processor.add(() => {
              Log.i(`Creating playlist ${path.basename(playlistpath)}`)
              return createPlaylist(mountpoint, playlistpath)
            })
          }
        })
    })
    .then(processor.execute)
}

function addOrRemovePlaylistSongs(mountpoint) {
  return User.getPlaylists().map(playlist => {
    const processor = Processor.create()
    const spinner = ora(`Syncing songs for ${playlist.name}`)
    processor.on('progress', ({ max, progress }) => {
      spinner.progress({
        text: `Syncing songs for ${playlist.name}`,
        max,
        progress
      })
    })
    processor.on('finish', progress => {
      if (progress) {
        spinner.done()
      } else {
        spinner.succeed(`Syncing songs for ${playlist.name}: Up-to-date`)
      }
    })
    processor.on('error', err => {
      spinner.error(
        `Syncing songs for ${playlist.name} failed, check error log`
      )
    })
    return Promise.map(playlist.songs, song => song.findTargetAudio())
      .then(_.filter)
      .filter(audio => {
        return getWalkmanPlaylistAudioPath(mountpoint, playlist, audio).then(
          audiopath => fse.pathExists(audiopath).then(exists => !exists)
        )
      })
      .map(audio => {
        return getWalkmanPlaylistAudioPath(mountpoint, playlist, audio).then(
          audiopath => {
            return processor.add(() => {
              Log.i(`Adding ${path.basename(audiopath)}`)
              return fse.ensureDir(path.dirname(audiopath)).then(() => {
                const tmppath = `${audiopath}.tmp`
                return fse
                  .copy(audio.path, tmppath)
                  .then(() => {
                    return stripTag(tmppath, audio)
                  })
                  .then(() => {
                    return fse.rename(tmppath, audiopath)
                  })
              })
            })
          }
        )
      })
      .then(() => playlist.songs.map(song => song.findTargetAudio()))
      .then(_.filter)
      .map(audio => getWalkmanPlaylistAudioPath(mountpoint, playlist, audio))
      .then(audiopaths => {
        return getWalkmanPlaylistPath(mountpoint, playlist)
          .then(playlistpath => {
            return fse
              .ensureDir(playlistpath)
              .then(() => fse.readdir(playlistpath))
              .map(file => path.resolve(playlistpath, file))
          })
          .map(audiopath => audiopath.normalize()) // NOTE: Very important for mac fs
          .map(audiopath => {
            if (!audiopaths.includes(audiopath)) {
              Log.i(`Removing ${path.basename(audiopath)}`)
              return processor.add(() => fse.remove(audiopath))
            }
          })
      })
      .then(processor.execute)
      .catch(err => {
        Log.e(err)
      })
  })
}

function addOrRemoveAlbums(mountpoint) {
  const processor = Processor.create()
  const spinner = ora()
  processor.on('progress', ({ max, progress }) => {
    spinner.progress({
      text: 'Syncing albums',
      max,
      progress
    })
  })
  processor.on('finish', progress => {
    if (progress) spinner.done()
    else spinner.succeed('Syncing albums: Up-to-date')
  })
  processor.on('error', err => {
    spinner.error('Syncing albums failed, check error log')
  })
  return User.getAlbums()
    .then(albums => {
      return Promise.filter(albums, album => {
        return getWalkmanAlbumPath(mountpoint, album).then(albumpath => {
          return fse.pathExists(albumpath).then(exists => !exists)
        })
      })
        .map(album => {
          return processor.add(() => {
            return getWalkmanAlbumPath(mountpoint, album)
              .then(albumpath => {
                Log.i(`Add ${path.basename(albumpath)}`)
                return fse.ensureDir(albumpath)
              })
              .then(() => album.songs.map(song => song.findTargetAudio()))
              .map(audio => {
                return getWalkmanAlbumAudioPath(mountpoint, album, audio).then(
                  audiopath => {
                    const tmppath = `${audiopath}.tmp`
                    return fse.copy(audio.path, tmppath).then(() => {
                      return fse.rename(tmppath, audiopath)
                    })
                  }
                )
              })
          })
        })
        .return(albums)
    })
    .map(album => getWalkmanAlbumPath(mountpoint, album))
    .then(albumpaths => {
      return getWalkmanAlbumsPath(mountpoint).then(albumspath =>
        fse
          .readdir(albumspath)
          .map(file => path.resolve(albumspath, file))
          .map(albumpath => albumpath.normalize()) // NOTE: Very important
          .map(albumpath => {
            if (!albumpaths.includes(albumpath)) {
              Log.i(`Removing ${path.basename(albumpath)}`)
              return processor.add(() => fse.remove(albumpath))
            }
          })
      )
    })
    .then(processor.execute)
}

function createPlaylist(mountpoint, playlistpath) {
  const writer = new M3UWriter()
  return fse
    .readdir(playlistpath)
    .map(file => path.resolve(playlistpath, file))
    .map(audiopath => {
      return Promise.join(
        getWalkmanMusicPath(mountpoint).then(musicpath => {
          return path.relative(musicpath, audiopath)
        }),
        getAudioDuration(audiopath),
        (url, duration) => {
          const title = path.basename(audiopath, path.extname(audiopath))
          return writer.file(url, duration, title)
        }
      ).then(() => {
        return getWalkmanMusicPath(mountpoint).then(musicpath => {
          return new Promise((resolve, reject) => {
            const name = path.basename(playlistpath)
            const stream = StringToStream(writer.toString()).pipe(
              fse.createWriteStream(path.resolve(musicpath, `${name}.m3u`))
            )
            stream.on('error', reject)
            stream.on('finish', resolve)
          })
        })
      })
    })
}

function stripTag(audiopath, audio) {
  const { bitrate } = audio.SongAudio
  if (bitrate === 'flac') {
    return stripTag__FLAC(audiopath)
  } else if (bitrate === '128' || bitrate === '320') {
    return stripTag__MP3(audiopath)
  } else {
    throw new Error('Unknown audio format')
  }
}

function stripTag__MP3(audiopath) {
  return ID3v2.writeAsync(
    {
      album: 'Unknown'
    },
    audiopath
  )
}

function stripTag__FLAC(audio, song) {
  return FLAC.metadata_simple_iterator.new().then(it => {
    return FLAC.metadata_simple_iterator
      .init(it, audio.path, false, false)
      .then(() => {
        return findVorbisComment(it).then(block => {
          if (!block) return
          return FLAC.metadata_object
            .vorbiscomment_remove_entries_matching(block, 'Album')
            .then(() => {
              return FLAC.metadata_simple_iterator.set_block(it, block, true)
            })
        })
      })
  })
}

function findVorbisComment(it) {
  return FLAC.metadata_simple_iterator.get_block_type(it).then(type => {
    if (type === FLAC.MetadataType['VORBIS_COMMENT']) {
      return FLAC.metadata_simple_iterator.get_block(it)
    }
    return FLAC.metadata_simple_iterator.next(it).then(r => {
      if (r) return findVorbisComment(it)
      return null
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
