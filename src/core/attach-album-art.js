import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../models'
import fs from 'fs'
import flac from 'node-flac'
import id3 from 'node-id3'

Promise.promisifyAll(fs)
Promise.promisifyAll(id3)

export default function() {
  return Song.all({
    include: [
      {
        model: Local,
        as: 'audio'
      },
      {
        model: Album,
        as: 'album',
        include: [
          {
            model: Local,
            as: 'cover'
          }
        ]
      }
    ]
  }).map(
    song => {
      return isAlbumArtAttached(song).then(attached => {
        if (!attached) {
          return attach(song)
        }
      })
    },
    { concurrency: 4 }
  )
}

function attach(song) {
  if (song.audio.mimeType === 'audio/flac') {
    return attach_flac(song)
  } else if (song.audio.mimeType === 'audio/mp3') {
    return attach_mp3(song)
  } else {
    throw new Error('Unknown audio format')
  }
}

function attach_flac(song) {
  return flac.metadata_object
    .new(flac.format.MetadataType['PICTURE'])
    .then(obj => {
      return fs
        .readFileAsync(song.album.cover.path)
        .then(data => {
          return Promise.join(
            flac.metadata_object.picture_set_mime_type(
              obj,
              song.audio.mimeType
            ),
            flac.metadata_object.picture_set_data(obj, data)
          )
        })
        .then(() => {
          return flac.metadata_object.picture_is_legal(obj).then(() => {
            return obj
          })
        })
    })
    .then(picture => {
      return flac.metadata.new().then(it => {
        return flac.metadata
          .init(it, song.audio.path, false, false)
          .then(() => {
            return flac.metadata.insert_block_after(it, picture, true)
          })
      })
    })
}

function attach_mp3(song) {
  return id3.update(
    {
      image: song.album.cover.path
    },
    song.audio.path
  )
}

function isAlbumArtAttached(song) {
  if (song.audio.mimeType === 'audio/flac') {
    return isAlbumArtAttached_flac(song)
  } else if (song.audio.mimeType === 'audio/mp3') {
    return isAlbumArtAttached_mp3(song)
  } else {
    throw new Error('Unknown audio format')
  }
}

function isAlbumArtAttached_mp3(song) {
  return id3.readAsync(song.audio.path).then(tags => {
    if (tags['image']) {
      return true
    }
    return false
  })
}

function isAlbumArtAttached_flac(song) {
  return flac.metadata.new().then(it => {
    return flac.metadata.init(it, song.audio.path, true, false).then(() => {
      function findPictureRecursive(it) {
        return flac.metadata.get_block_type(it).then(type => {
          if (type === flac.format.MetadataType['PICTURE']) {
            return true
          }
          return flac.metadata.next(it).then(r => {
            if (r) return findPictureRecursive(it)
            return false
          })
        })
      }
      return findPictureRecursive(it)
    })
  })
}
