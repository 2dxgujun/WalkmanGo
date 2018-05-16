import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import fse from 'fs-extra'
import FLAC from 'node-flac'
import ID3v2 from 'node-id3'
import sharp from 'sharp'
import Processor from '../../utils/promise-processor'
import { Log } from '../../utils/logger'

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
  return Song.all({
    include: [
      {
        model: Local,
        as: 'audios'
      },
      {
        model: Album,
        as: 'album',
        include: [
          {
            model: Local,
            as: 'artwork'
          }
        ]
      }
    ]
  })
    .map(song => {
      const { WALKMAN_GO_BITRATE: bitrate } = process.env
      if (song.album && song.album.artwork) {
        return Promise.filter(song.audios, audio => {
          return (
            audio.SongAudio.bitrate === bitrate && !isAlbumArtworkAdded(audio)
          )
        }).map(audio => {
          return processor.add(() => {
            return addAlbumArtwork(audio, album).catch(err => {
              Log.e(`Add album artwork failed: ${song.name}`, err)
            })
          })
        })
      }
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function addAlbumArtwork(audio, album) {
  if (song.audio.mimeType === 'audio/flac') {
    return addAlbumArtwork__FLAC(audio, album)
  } else if (song.audio.mimeType === 'audio/mp3') {
    return addAlbumArtwork__MP3(audio, album)
  } else {
    throw new Error('Unknown audio format')
  }
}

function addAlbumArtwork__FLAC(audio, album) {
  return FLAC.metadata_object
    .new(FLAC.format.MetadataType['PICTURE'])
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
          return sharp(album.artwork.path).metadata_simple_iterator()
        })
        .then(metadata_simple_iterator => {
          obj.data.type =
            FLAC.format.StreamMetadata_Picture_Type['Cover (front)']
          obj.data.width = metadata_simple_iterator.width
          obj.data.height = metadata_simple_iterator.height
          obj.data.depth = metadata_simple_iterator.channels * 8 // 8 bit depth
        })
        .then(() => {
          return FLAC.metadata_object.picture_is_legal(obj)
        })
        .return(obj)
    })
    .then(picture => {
      return FLAC.metadata_simple_iterator.new().then(it => {
        return FLAC.metadata_simple_iterator.init(it, audio.path, false, false).then(() => {
          return FLAC.metadata_simple_iterator.insert_block_after(it, picture, true)
        })
      })
    })
}

function addAlbumArtwork_MP3(audio, album) {
  return ID3v2.updateAsync(
    {
      image: album.artwork.path
    },
    audio.path
  )
}

function isAlbumArtworkAdded(audio) {
  if (song.audio.mimeType === 'audio/flac') {
    return isAlbumArtworkAdded__FLAC(audio)
  } else if (song.audio.mimeType === 'audio/mp3') {
    return isAlbumArtworkAdded__MP3(audio)
  } else {
    throw new Error('Unknown audio format')
  }
}

function isAlbumArtworkAdded_MP3(audio) {
  return ID3v2.readAsync(audio.path).then(tags => {
    if (tags['image']) {
      return true
    }
    return false
  })
}

function isAlbumArtworkAdded_FLAC(audio) {
  return FLAC.metadata_simple_iterator.new().then(it => {
    return FLAC.metadata_simple_iterator.init(it, song.audio.path, true, false).then(() => {
      function isPictureBlockExistsRecursive(it) {
        return FLAC.metadata_simple_iterator.get_block_type(it).then(type => {
          if (type === FLAC.format.MetadataType['PICTURE']) {
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
