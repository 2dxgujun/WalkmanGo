import ID3v1 from '../../utils/ID3v1'
import ID3v2 from 'node-id3'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import Processor from '../../utils/promise-processor'
import Logger from '../../utils/logger'

Promise.promisifyAll(ID3v2)

const ID_OPTIMIZED = 'WG_OPT'

const Log = new Logger('OPTIMIZE')

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

  return Song.all({
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
  }).map(song => {
    song.audios
      .filter(audio => {
        return audio.mimeType === 'audio/mp3' && !isOptimized(audio)
      })
      .forEach(audio => {
        prepareOptimize(processor, song, audio)
      })
  })
  .return(processor)
}

function run(processor) {
  return processor.run()
}

function isOptimized(audio) {
  return ID3v2.readAsync(audio.path).then(tags => {
    const priv = tags['private']
    if (priv instanceof Array) {
      const p = private.find(p => {
        return p.owner === ID_OPTIMIZED
      })
      return p ? true : false
    } else {
      if (priv.owner === ID_OPTIMIZED) {
        return true
      }
      return false
    }
  })
}

function prepareOptimize(processor, song, audio) {
  return processor.add(() => {
    Log.d(`Optimizing: ${audio.path}`)
    return clearTags(audio)
      .then(() => {
        return writeTags(song, audio)
      })
      .catch(err => {
        Log.e(`Optimize failed: ${audio.path}`, err)
      })
  })
}

function clearTags(audio) {
  return ID3v1.removeTags(audio.path).then(() => {
    return ID3v2.removeTagsAsync(audio.path)
  })
}

function writeTags(song, audio) {
  return ID3v2.writeAsync(
    {
      title: song.name,
      artist: song.artists[0].name,
      private: {
        owner: ID_OPTIMIZED,
        data: 'true'
      }
    },
    audio.path
  )
}
