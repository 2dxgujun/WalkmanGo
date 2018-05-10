import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import fse from 'fs-extra'
import flac from 'node-flac'
import id3 from 'node-id3'
import sharp from 'sharp'
import Processor from '../../utils/promise-processor'
import Logger from '../../utils/logger'

Promise.promisifyAll(id3)

const Log = new Logger('attach album art')

export default function() {
  return prepare().then(run)
}

function prepare() {
  const processor = new Processor()
  return Song.all({
    include: [
      {
        model: Local,
        as: 'audio'
      },
      {
        model: Album,
        as: 'album',
        required: true,
        include: [
          {
            model: Local,
            as: 'art'
          }
        ]
      }
    ]
  })
    .map(song => {
      if (song.audio && song.album && song.album.art) {
        return isAlbumArtAttached(song).then(attached => {
          if (!attached) {
            prepareAttachAlbumArt(song)
          }
        })
      }
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function prepareAttachAlbumArt(processor, song) {
  processor.add(() => {
    return attachAlbumArt(song)
      .then(() => {
        Log.d('Attach album art succeed')
      })
      .catch(err => {
        Log.e('Attach album art failed', err)
      })
  })
}

function attachAlbumArt(song) {
  if (song.audio.mimeType === 'audio/flac') {
    return attachAlbumArtFlac(song)
  } else if (song.audio.mimeType === 'audio/mp3') {
    return attachAlbumArtMp3(song)
  } else {
    throw new Error('Unknown audio format')
  }
}

function attachAlbumArtFlac(song) {
  return flac.metadata_object
    .new(flac.format.MetadataType['PICTURE'])
    .then(obj => {
      return fse
        .readFile(song.album.art.path)
        .then(data => {
          return Promise.join(
            flac.metadata_object.picture_set_mime_type(
              obj,
              song.album.art.mimeType
            ),
            flac.metadata_object.picture_set_data(obj, data)
          )
        })
        .then(() => {
          return sharp(song.album.art.path).metadata()
        })
        .then(metadata => {
          obj.data.type =
            flac.format.StreamMetadata_Picture_Type['Cover (front)']
          obj.data.width = metadata.width
          obj.data.height = metadata.height
          obj.data.depth = metadata.channels * 8 // 8 bit depth
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

function attachAlbumArtMp3(song) {
  return id3.update(
    {
      image: song.album.art.path
    },
    song.audio.path
  )
}

function isAlbumArtAttached(song) {
  if (song.audio.mimeType === 'audio/flac') {
    return isAlbumArtAttachedFlac(song)
  } else if (song.audio.mimeType === 'audio/mp3') {
    return isAlbumArtAttachedMp3(song)
  } else {
    throw new Error('Unknown audio format')
  }
}

function isAlbumArtAttachedMp3(song) {
  return id3.readAsync(song.audio.path).then(tags => {
    if (tags['image']) {
      return true
    }
    return false
  })
}

function isAlbumArtAttachedFlac(song) {
  return flac.metadata.new().then(it => {
    return flac.metadata.init(it, song.audio.path, true, false).then(() => {
      function isPictureBlockExistsRecursive(it) {
        return flac.metadata.get_block_type(it).then(type => {
          if (type === flac.format.MetadataType['PICTURE']) {
            return true
          }
          return flac.metadata.next(it).then(r => {
            if (r) return isPictureBlockExistsRecursive(it)
            return false
          })
        })
      }
      return isPictureBlockExistsRecursive(it)
    })
  })
}
