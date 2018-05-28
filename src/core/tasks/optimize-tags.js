import ID3v1 from '../../utils/ID3v1'
import ID3v2 from 'node-id3'
import FLAC from 'node-flac'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import Processor from '../../utils/promise-processor'
import { Log } from '../../utils/logger'
import _ from 'lodash'

Promise.promisifyAll(ID3v2)

export default function() {
  Log.d('Start optimize tags')
  return prepare()
    .then(run)
    .catch(err => {
      return Log.e('Uncaught Error when optimize tags', err)
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
            model: Artist,
            as: 'artists'
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
    .map(song => song.findTargetAudio().then(audio => ({ song, audio })))
    .then(items => _.filter(items, 'audio'))
    .filter(({ song, audio }) => !audio.SongAudio.isOptimized)
    .map(({ song, audio }) => {
      return processor.add(() => {
        Log.d(`Optimizing: ${audio.path}`)
        return optimize(audio, song).catch(err => {
          Log.e(`Optimize failed: ${audio.path}`, err)
        })
      })
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function optimize(audio, song) {
  if (audio.mimeType === 'audio/flac') {
    return optimize__FLAC(audio, song)
  } else if (audio.mimeType === 'audio/mp3') {
    return optimize__MP3(audio, song)
  } else {
    throw new Error('Unknown audio format')
  }
}

function optimize__MP3(audio, song) {
  return ID3v1.removeTagsAsync(audio.path)
    .then(() => {
      return ID3v2.removeTagsAsync(audio.path)
    })
    .then(() => {
      return ID3v2.writeAsync(
        {
          title: song.name,
          artist: song.artists.length ? song.artists[0].name : 'Unknown',
          album: song.album ? song.album.name : 'Unknown'
        },
        audio.path
      )
    })
}

function optimize__FLAC(audio, song) {
  return FLAC.metadata_simple_iterator.new().then(it => {
    return FLAC.metadata_simple_iterator
      .init(it, audio.path, false, false)
      .then(() => {
        return findVorbisComment(it)
          .then(block => {
            if (block) {
              return FLAC.metadata_simple_iterator.delete_block(it, true)
            }
          })
          .then(() => {
            return FLAC.metadata_object.new(FLAC.MetadataType['VORBIS_COMMENT'])
          })
          .then(block => {
            return Promise.all([
              FLAC.metadata_object.vorbiscomment_entry_from_name_value_pair(
                'Title',
                song.name
              ),
              FLAC.metadata_object.vorbiscomment_entry_from_name_value_pair(
                'Artist',
                song.artists.length ? song.artists[0].name : 'Unknown'
              ),
              FLAC.metadata_object.vorbiscomment_entry_from_name_value_pair(
                'Album',
                song.album ? song.album.name : 'Unknown'
              )
            ])
              .mapSeries(entry => {
                return FLAC.metadata_object.vorbiscomment_append_comment(
                  block,
                  entry
                )
              })
              .return(block)
          })
          .then(block => {
            return FLAC.metadata_simple_iterator.insert_block_after(
              it,
              block,
              true
            )
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
