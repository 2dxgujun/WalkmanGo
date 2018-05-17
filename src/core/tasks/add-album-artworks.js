import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import fse from 'fs-extra'
import FLAC from 'node-flac'
import ID3v2 from 'node-id3'
import sharp from 'sharp'
import Processor from '../../utils/promise-processor'
import { Log } from '../../utils/logger'
import { isOptimized } from '../helper'
import _ from 'lodash'

Promise.promisifyAll(ID3v2)

export default function() {
  Log.d('Start add album artworks')
  return prepare()
    .then(run)
    .catch(err => {
      return Log.e('Uncaught Error when add album artworks', err)
    })
}

function prepare() {
  const processor = Processor.create()
  return Playlist.all({
    include: [
      {
        model: Song,
        as: 'songs',
        include: [
          {
            model: Album,
            as: 'album',
            include: [
              {
                model: Local,
                as: 'artwork'
              }
            ]
          },
          {
            model: Local,
            as: 'audios'
          }
        ]
      }
    ]
  })
    .map(playlist => playlist.songs)
    .then(_.flatten)
    .then(songs => _.uniqBy(songs, 'id'))
    .then(songs => _.filter(songs, 'album'))
    .then(songs => _.filter(songs, 'album.artwork'))
    .map(song => song.findTargetAudio().then(audio => ({ song, audio })))
    .then(items => _.filter(items, 'audio'))
    .filter(({ song, audio }) => {
      return isOptimized(audio).then(optimized => {
        if (optimized) {
          return isAlbumArtworkAdded(audio).then(added => !added)
        }
        return false
      })
    })
    .map(({ song, audio }) => {
      return processor.add(() => {
        Log.d(`Adding: ${song.name}`)
        return addAlbumArtwork(audio, song.album).catch(err => {
          Log.e(`Add album artwork failed: ${song.name}`, err)
        })
      })
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function addAlbumArtwork(audio, album) {
  if (audio.mimeType === 'audio/flac') {
    return addAlbumArtwork__FLAC(audio, album)
  } else if (audio.mimeType === 'audio/mp3') {
    return addAlbumArtwork__MP3(audio, album)
  } else {
    throw new Error('Unknown audio format')
  }
}

function addAlbumArtwork__FLAC(audio, album) {
  return FLAC.metadata_object
    .new(FLAC.MetadataType['PICTURE'])
    .then(obj => {
      return fse
        .readFile(album.artwork.path)
        .then(data => {
          return Promise.join(
            FLAC.metadata_object.picture_set_mime_type(
              obj,
              album.artwork.mimeType
            ),
            FLAC.metadata_object.picture_set_data(obj, data)
          )
        })
        .then(() => {
          return sharp(album.artwork.path).metadata()
        })
        .then(metadata => {
          obj.data.type = FLAC.StreamMetadata_Picture_Type['Cover (front)']
          obj.data.width = metadata.width
          obj.data.height = metadata.height
          obj.data.depth = metadata.channels * 8 // 8 bit depth
        })
        .then(() => {
          return FLAC.metadata_object.picture_is_legal(obj)
        })
        .return(obj)
    })
    .then(picture => {
      return FLAC.metadata_simple_iterator.new().then(it => {
        return FLAC.metadata_simple_iterator
          .init(it, audio.path, false, false)
          .then(() => {
            return FLAC.metadata_simple_iterator.insert_block_after(
              it,
              picture,
              true
            )
          })
      })
    })
}

function addAlbumArtwork__MP3(audio, album) {
  return ID3v2.updateAsync(
    {
      image: album.artwork.path
    },
    audio.path
  )
}

function isAlbumArtworkAdded(audio) {
  if (audio.mimeType === 'audio/flac') {
    return isAlbumArtworkAdded__FLAC(audio)
  } else if (audio.mimeType === 'audio/mp3') {
    return isAlbumArtworkAdded__MP3(audio)
  } else {
    throw new Error('Unknown audio format')
  }
}

function isAlbumArtworkAdded__MP3(audio) {
  return ID3v2.readAsync(audio.path).then(tags => {
    if (tags['image']) {
      return true
    }
    return false
  })
}

function isAlbumArtworkAdded__FLAC(audio) {
  return FLAC.metadata_simple_iterator.new().then(it => {
    return FLAC.metadata_simple_iterator
      .init(it, audio.path, true, false)
      .then(() => {
        function isPictureBlockExistsRecursive(it) {
          return FLAC.metadata_simple_iterator.get_block_type(it).then(type => {
            if (type === FLAC.MetadataType['PICTURE']) {
              return true
            }
            return FLAC.metadata_simple_iterator.next(it).then(r => {
              if (r) return isPictureBlockExistsRecursive(it)
              return false
            })
          })
        }
        return isPictureBlockExistsRecursive(it)
      })
  })
}
