import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import fs from 'fs'
import path from 'path'
import flac from 'node-flac'
import mp3duration from 'mp3-duration'
import StringToStream from 'string-to-stream'
import M3UWriter from '../../utils/m3u-writer'
import meter from 'meter'

Promise.promisifyAll(fs)
const mp3durationAsync = Promise.promisify(mp3duration)

const { walkman_config_workdir: workdir } = process.env

export default function() {
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
  }).map(
    playlist => {
      const writer = new M3UWriter()
      return Promise.each(playlist.songs, song => {
        const audiofile = path.basename(song.audio.path)
        const url = `${playlist.name}/${audiofile}`
        const title = `${song.artists[0].name} - ${song.name}`
        return getAudioDuration(song).then(duration => {
          writer.file(url, duration, title)
        })
      })
        .then(() => {
          return writer.toString()
        })
        .then(m3u=> {
          return pipe(playlist, m3u).then(bytes => {
            return mark(playlist, bytes)
          })
        })
    },
    { concurrency: 4 }
  )
}

function mark(playlist, bytes) {
  return sequelize.transaction(t => {
    return getPlaylistUrlPath(playlist).then(m3upath => {
      return Local.create(
        {
          path: m3upath,
          mimeType: 'audio/x-mpegurl',
          length: bytes
        },
        {
          transaction: t
        }
      ).then(m3u => {
        return playlist.setUrl(m3u, { transaction: t })
      })
    })
  })
}

function pipe(playlist, m3u) {
  return getPlaylistUrlPath(playlist).then(m3upath => {
    const temppath = `${m3upath}.temp`
    return new Promise((resolve, reject) => {
      const m = meter()
      const stream = StringToStream(m3u)
        .pipe(m)
        .pipe(fs.createWriteStream(temppath))
      stream.on('error', reject)
      stream.on('finish', () => {
        resolve(m.bytes)
      })
    }).then(bytes => {
      return fs.renameAsync(temppath, m3upath).then(() => {
        return bytes
      })
    })
  })
}

function getAudioDuration(song) {
  if (song.audio.mimeType === 'audio/flac') {
    return getAudioDuration_flac(song)
  } else if (song.audio.mimeType === 'audio/mp3') {
    return getAudioDuration_mp3(song)
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

function getAudioDuration_flac(song) {
  return getAudioStreamInfo(song).then(info => {
    if (info) {
      return parseInt(info.data.total_samples / info.data.sample_rate)
    }
    return -1
  })
}

function getAudioDuration_mp3(song) {
  return mp3durationAsync(song.audio.path).then(duration => {
    return parseInt(duration)
  })
}

function getPlaylistUrlPath(playlist) {
  const m3ufile = `${playlist.name}.m3u`
  const m3upath = path.resolve(workdir, m3ufile)
  return Promise.resolve(m3upath)
}
