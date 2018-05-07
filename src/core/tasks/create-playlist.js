import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import fs from 'fs'
import path from 'path'
import flac from 'node-flac'
import id3 from 'node-id3'
import StringToStream from 'string-to-stream'
import M3UWriter from '../../utils/m3u-writer'

Promise.promisifyAll(fs)

const { walkman_config_workdir: workdir } = process.env

//#EXTM3U
//#EXTINF:Duration,Artist Name - Track Title
//Playlist Name\Artist Name - Song Name.flac

//audio/x-mpegurl

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
      playlist.songs.forEach(song => {
        const audiofile = path.basename(song.audio.path)
        const uri = `${playlist.name}\\${audiofile}`
        const duration = getAudioDuration(song)
        const title = `${song.artists[0].name} - ${song.name}`
        writer.file(uri, duration, title)
      })
    },
    { concurrency: 4 }
  )
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
    return flac.metadata.init(init, song.audio.path, true, false).then(() => {
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
  return id3.readAsync(song.audio.path).then(tags => {
    if (tags.length) {
      return tags.length
    }
    return -1
  })
}

function getM3UPath(playlist) {
  const m3ufile = `${playlist.name}.m3u`
  const m3upath = path.resolve(workdir, m3ufile)
  return m3upath
}
