import Sequelize from 'sequelize'
import sequelize, {
  User,
  Album,
  Artist,
  Playlist,
  Song,
  Local
} from '../../models'
import fse from 'fs-extra'
import FLAC from 'node-flac'
import ID3v2 from 'node-id3'
import sharp from 'sharp'
import Processor from '../../utils/promise-processor'
import { Log } from '../../utils/logger'
import ora from '../../utils/ora++'
import path from 'path'
import _ from 'lodash'

Promise.promisifyAll(ID3v2)

export default function() {
  const spinner = ora('Start add album artworks')
  Log.d('Start add album artworks')
  return prepare(spinner)
    .then(run)
    .then(() => {
      spinner.succeed('Add album artwork done.')
    })
    .catch(err => {
      Log.e('Uncaught Error when add album artworks', err)
      spinner.fail('Add album artwork failed. Please check error log')
    })
}

function prepare(spinner) {
  const processor = Processor.create()
  return Promise.join(
    User.getPlaylists(),
    User.getAlbums(),
    (playlists, albums) => {
      return [
        ..._.flatten(playlists.map(playlist => playlist.songs)),
        ..._.flatten(albums.map(album => album.songs))
      ]
    }
  )
    .then(songs => _.uniqBy(songs, 'id'))
    .then(songs => _.filter(songs, 'album'))
    .then(songs => _.filter(songs, 'album.artwork'))
    .map(song => song.findTargetAudio().then(audio => ({ song, audio })))
    .then(items => _.filter(items, 'audio'))
    .then(items => _.filter(items, 'audio.SongAudio.isOptimized'))
    .then(items => _.filter(items, ['audio.SongAudio.hasArtwork', false]))
    .map(({ song, audio }) => {
      return processor.add(() => {
        Log.d(`Adding: ${song.name}`)
        spinner.plain(`Adding album artwork for ${path.basename(audio.path)}`)
        return addAlbumArtwork(audio, song.album)
          .then(() => {
            return audio.SongAudio.update({
              hasArtwork: true
            })
          })
          .catch(err => {
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
