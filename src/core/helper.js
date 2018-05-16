import ID3v1 from '../utils/ID3v1'
import ID3v2 from 'node-id3'
import FLAC from 'node-flac'
import { ID_OPTIMIZED } from './consts'

function isOptimized(audio) {
  if (audio.mimeType === 'audio/flac') {
    return isOptimized__FLAC(audio)
  } else if (audio.mimeType === 'audio/mp3') {
    return isOptimized__MP3(audio)
  } else {
    throw new Error('Unknown audio format')
  }
}

function isOptimized__FLAC(audio) {
  return FLAC.metadata_simple_iterator.new().then(it => {
    return FLAC.metadata_simple_iterator
      .init(it, audio.path, true, false)
      .then(() => {
        return findVorbisComment(it).then(block => {
          if (!block) return false
          const optimized = block.data.comments.find(comment => {
            return comment.includes(ID_OPTIMIZED)
          })
          if (optimized) return true
          else return false
        })
      })
  })
}

function isOptimized__MP3(audio) {
  return ID3v2.readAsync(audio.path).then(tags => {
    const priv = tags['private']
    if (priv instanceof Array) {
      const p = priv.find(p => {
        return p.owner === ID_OPTIMIZED
      })
      return p ? true : false
    } else {
      if (priv && priv.owner === ID_OPTIMIZED) {
        return true
      }
      return false
    }
  })
}
