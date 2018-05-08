import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song } from '../../models'

const {
  walkman_config_uin: uin,
  walkman_config_playlists: playlists
} = process.env

const includes = playlists.split(',')

export default function() {
  return updatePlaylists()
    .then(fetchSongs)
    .then(fetchAlbums)
}

function updatePlaylists() {
  return qqmusic
    .getPlaylists(uid)
    .filter(playlist => {
      return includes.includes(playlist.name)
    })
    .then(playlists => {
      return sequelize.transaction(t => {
        return Playlist.destroy({
          where: {
            id: {
              [Sequelize.Op.notIn]: playlists.map(it => it.id)
            }
          },
          transaction: t
        }).then(() => {
          return Promise.map(playlists, playlist => {
            return findThenCreateOrUpdatePlaylist(playlist, { transaction: t })
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
            findOrCreateArtists(song.artists, { transaction: t }),
            (song, artists) => {
              if (artists && artists.length > 0) {
                return song.setArtists(artists, { transaction: t })
              }
              return song
            }
          )
        }).then(songs => {
          return playlist.setSongs(songs, { transaction: t })
        })
      })
    })
  })
}

function fetchAlbums() {
  return Song.all()
    .filter(song => {
      return !song.hasAlbum() && song.albumMid
    })
    .reduce((accumulator, song, i, length) => {
      if (length < 10) {
        accumulator.push(song)
      }
      return accumulator
    }, [])
    .map(song => {
      return qqmusic.getAlbumInfo(song.albumMid).then(album => {
        return sequelize.transaction(t => {
          return Promise.join(
            findOrCreateAlbum(album, { transaction: t }).spread(i => i),
            findOrCreateArtist(album.artist, { transaction: t }.spread(i => i)),
            (album, artist) => {
              return Promise.join(
                album.addSong(song, { transaction: t }),
                album.setArtist(artist, { transaction: t })
              )
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

function findThenCreateOrUpdatePlaylist(playlist, options) {
  return findOrCreatePlaylist(playlist, options).spread((instance, created) => {
    if (created) return instance
    return instance.update(
      {
        name: playlist.name,
        songCount: playlist.song_cnt
      },
      options
    )
  })
}
