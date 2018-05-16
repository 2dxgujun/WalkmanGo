import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song } from '../../models'
import { Log } from '../../utils/logger'

export default function() {
  Log.d('Start fetch playlists')
  return fetchPlaylists()
    .then(fetchSongs)
    .then(fetchAlbums)
    .catch(err => {
      Log.e('Uncaught Error when fetch playlists: ', err)
    })
}

function fetchPlaylists() {
  const { WALKMAN_GO_UIN, WALKMAN_GO_PLAYLISTS } = process.env
  return qqmusic
    .getPlaylists(WALKMAN_GO_UIN)
    .filter(playlist => {
      return WALKMAN_GO_PLAYLISTS.includes(playlist.name)
    })
    .then(playlists => {
      return Playlist.findAll({
        where: {
          id: {
            [Sequelize.Op.notIn]: playlists.map(it => it.id)
          }
        }
      })
        .map(playlist => {
          return playlist.destroy().then(() => {
            Log.d(`Playlist ${playlist.name} removed`)
          })
        })
        .return(playlists)
    })
    .then(playlists => {
      return sequelize.transaction(t => {
        return Promise.map(playlists, playlist => {
          return findThenUpdateOrCreatePlaylist(playlist, {
            transaction: t
          }).spread((playlist, created) => {
            Log.d(
              `Playlist ${playlist.name} ${created ? 'created' : 'updated'}`
            )
          })
        })
      })
    })
}

function fetchSongs() {
  return Playlist.all().mapSeries(playlist => {
    return qqmusic.getPlaylistSongs(playlist.id).then(songs => {
      return sequelize.transaction(t => {
        return Promise.map(songs, song => {
          return Promise.join(
            findOrCreateSong(song, { transaction: t }).spread(i => i),
            findOrCreateAlbumIfPresent(song.album, { transaction: t }),
            findOrCreateArtists(song.artists, { transaction: t }),
            (song, album, artists) => {
              return Promise.resolve(album)
                .then(album => {
                  if (album) {
                    return album.addSong(song, { transaction: t })
                  }
                })
                .then(() => {
                  if (artists && artists.length) {
                    return song.setArtists(artists, { transaction: t })
                  }
                })
                .return(song)
            }
          )
        }).then(songs => {
          return playlist.setSongs(songs, { transaction: t })
        })
      })
    })
  })
}

function findOrCreateAlbumIfPresent(album, options) {
  if (album.id && album.mid) {
    return findOrCreateAlbum(album, options).spread(i => i)
  }
  return null
}

function fetchAlbums() {
  return Album.all({
    where: {
      name: {
        [Sequelize.Op.eq]: null
      }
    }
  })
    .reduce((accumulator, album, i) => {
      if (i < 10) {
        accumulator.push(album)
      }
      return accumulator
    }, [])
    .mapSeries(album => {
      return qqmusic.getAlbumInfo(album.mid).then(album => {
        return sequelize.transaction(t => {
          return Promise.join(
            findThenUpdateOrCreateAlbum(album, { transaction: t }).spread(
              i => i
            ),
            findOrCreateArtist(album.artist, { transaction: t }).spread(i => i),
            (album, artist) => {
              return album.setArtist(artist, { transaction: t })
            }
          )
        })
      })
    })
}

function findOrCreateSong(song, options) {
  return Song.findOrCreate({
    where: {
      id: song.id
    },
    defaults: {
      id: song.id,
      mid: song.mid,
      albumMid: song.album_mid,
      name: song.name,
      size128: song.size128,
      size320: song.size320,
      sizeflac: song.sizeflac
    },
    ...options
  })
}

function findOrCreateAlbum(album, options) {
  return Album.findOrCreate({
    where: {
      id: album.id
    },
    defaults: {
      id: album.id,
      mid: album.mid,
      name: album.name,
      songCount: album.song_cnt,
      releaseDate: album.release_date,
      language: album.language,
      genre: album.genre
    },
    ...options
  })
}

function findThenUpdateOrCreateAlbum(album, options) {
  return findOrCreateAlbum(album, options).spread((instance, created) => {
    if (created) return [instance, created]
    return instance
      .update(
        {
          name: album.name,
          songCount: album.song_cnt,
          releaseDate: album.release_date,
          language: album.language,
          genre: album.genre
        },
        options
      )
      .then(instance => [instance, created])
  })
}

function findOrCreateArtist(artist, options) {
  return Artist.findOrCreate({
    where: {
      id: artist.id
    },
    defaults: {
      id: artist.id,
      mid: artist.mid,
      name: artist.name
    },
    ...options
  })
}

function findOrCreateArtists(artists, options) {
  return Promise.map(artists, artist => {
    return findOrCreateArtist(artist, options).spread(i => i)
  })
}

function findOrCreatePlaylist(playlist, options) {
  return Playlist.findOrCreate({
    where: {
      id: playlist.id
    },
    defaults: {
      id: playlist.id,
      name: playlist.name,
      songCount: playlist.song_cnt
    },
    ...options
  })
}

function findThenUpdateOrCreatePlaylist(playlist, options) {
  return findOrCreatePlaylist(playlist, options).spread((instance, created) => {
    if (created) return [instance, created]
    return instance
      .update(
        {
          name: playlist.name,
          songCount: playlist.song_cnt
        },
        options
      )
      .then(instance => [instance, created])
  })
}
