import * as qqmusic from '../vendor/qqmusic'
import sequelize, { Playlist, Song } from '../models'

export default function sync() {
  return sequelize
    .sync({ force: true })
    .fetchPlaylists()
    .then(findThenUpdateOrCreatePlaylists)
    .mapSeries(playlist => {
      return fetchSongs(playlist.id)
        .then(findOrCreateSongs)
        .then(songs => {
          return sequelize.transaction(t => {
            return playlist.setSongs(songs, {
              transaction: t
            })
          })
        })
    })
}

function fetchPlaylists() {
  const uid = process.env.WALKMAN_CONFIG_UIN
  const includes = process.env.WALKMAN_CONFIG_PLAYLISTS.split(',')
  return qqmusic.getPlaylists(uid).filter(playlist => {
    return includes.includes(playlist.name)
  })
}

function fetchSongs(id) {
  return qqmusic.getSongs(id)
}

function findThenUpdateOrCreatePlaylists(playlists) {
  return sequelize.transaction(t => {
    return Promise.map(playlists, playlist => {
      return Playlist.findOrCreate({
        where: {
          id: playlist.id
        },
        defaults: {
          id: playlist.id,
          name: playlist.name,
          songCount: playlist.song_cnt
        },
        transaction: t
      }).spread((instance, created) => {
        if (!created) {
          return instance.update(
            {
              name: playlist.name,
              songCount: playlist.song_cnt
            },
            { transaction: t }
          )
        } else {
          return Promise.resolve(instance)
        }
      })
    })
  })
}

function findOrCreateSongs(songs) {
  return sequelize.transaction(t => {
    return Promise.map(songs, song => {
      return Song.findOrCreate({
        where: {
          id: song.id
        },
        defaults: {
          id: song.id,
          name: song.name,
          mediaId: song.media_id,
          size128: song.size128,
          size320: song.size320,
          sizeflac: song.sizeflac
        },
        transaction: t
      }).spread((instance, created) => {
        return Promise.resolve(instance)
      })
    })
  })
}
