import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song } from '../../models'

export default function() {
  return fetchPlaylists().then(fetchSongs)
}

function fetchPlaylists() {
  const uid = process.env.walkman_config_uin
  const includes = process.env.walkman_config_playlists.split(',')

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
// TODO delay fetch album info
function fetchSongs() {
  return Playlist.all().mapSeries(playlist => {
    return sequelize.transaction(t => { // TODO transaction only contain sql operation
      return qqmusic
        .getPlaylistSongs(playlist.id)
        .mapSeries(song => {
          return qqmusic.getAlbumInfo(song.album_mid).then(album => {
            return Promise.join(
              findOrCreateSong(song, { transaction: t }).spread(i => i),
              findOrCreateAlbum(album, { transaction: t }).spread(i => i),
              findOrCreateArtists(song.artists, { transaction: t }).map(
                i => i[0]
              ),
              findOrCreateArtist(album.artist, { transaction: t }).spread(
                i => i
              ),
              (song, album, songArtists, albumArtist) => {
                return Promise.join(
                  album.addSong(song, { transaction: t }),
                  song.setArtists(songArtists, { transaction: t }),
                  album.setArtist(albumArtist, { transaction: t }),
                  () => {
                    return song
                  }
                )
              }
            )
          })
        })
        .then(songs => {
          return playlist.setSongs(songs, {
            transaction: t
          })
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
    return findOrCreateArtist(artist, options)
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
