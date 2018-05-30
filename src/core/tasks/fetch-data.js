import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { User, Album, Artist, Playlist, Song } from '../../models'
import { Log } from '../../utils/logger'
import { retry } from '../../utils/promise-retry'
import _ from 'lodash'
import ApiError from '../../vendor/api-error'

const { WALKMAN_GO_UIN: uin, WALKMAN_GO_PLAYLISTS } = process.env

export default function() {
  Log.d('Start fetch data')
  return addOrRemovePlaylists()
    .then(addOrRemoveAlbums)
    .then(updateAlbums)
    .then(() => Log.d('Done fetch data'))
    .catch(err => {
      Log.e('Error when fetch data: ', err)
    })
}

function addOrRemovePlaylists() {
  return qqmusic
    .getPlaylists(uin)
    .filter(playlist => {
      return WALKMAN_GO_PLAYLISTS.includes(playlist.name)
    })
    .then(playlists => {
      return sequelize.transaction(t => {
        return Promise.map(playlists, playlist => {
          return findThenUpdateOrCreatePlaylist(playlist, {
            transaction: t
          }).spread((instance, created) => {
            if (created) Log.d(`Create playlist: ${instance.name}`)
            return instance
          })
        }).then(playlists => {
          return User.current().then(user => {
            return user.setPlaylists(playlists, { transaction: t })
          })
        })
      })
    })
    .then(addOrRemovePlaylistsSongs)
}

function addOrRemoveAlbums() {
  return qqmusic
    .getAlbums(uin)
    .then(albums => {
      return sequelize.transaction(t => {
        return Promise.map(albums, album => {
          return findOrCreateAlbum(album, {
            transaction: t
          }).spread((instance, created) => {
            if (created) Log.d(`Create album: ${instance.name}`)
            return findOrCreateArtist(album.artist, {
              transaction: t
            })
              .spread((artistInstance, created) => {
                return instance.setArtist(artistInstance, {
                  transaction: t
                })
              })
              .return(instance)
          })
        }).then(albums => {
          return User.current().then(user => {
            return user.setAlbums(albums, { transaction: t })
          })
        })
      })
    })
    .then(addOrRemoveAlbumsSongs)
}

function addOrRemovePlaylistsSongs() {
  return User.current()
    .then(user => user.getPlaylists())
    .mapSeries(playlist => {
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

function updateAlbums() {
  return User.current()
    .then(user =>
      user.getPlaylists({
        include: [
          {
            model: Song,
            as: 'songs',
            required: true,
            include: [
              {
                model: Album,
                as: 'album',
                where: {
                  songCount: {
                    [Sequelize.Op.eq]: null
                  }
                }
              }
            ]
          }
        ]
      })
    )
    .map(playlist => playlist.songs.map(song => song.album))
    .then(_.flatten)
    .then(albums => _.uniqBy(albums, 'id'))
    .mapSeries(instance => {
      return retry(() => qqmusic.getAlbumInfo(instance.mid), {
        max_tries: 4,
        interval: 1000
      })
        .then(album => {
          return sequelize.transaction(t => {
            return instance
              .update(
                {
                  name: album.name,
                  songCount: album.song_cnt,
                  releaseDate: album.release_date,
                  language: album.language,
                  genre: album.genre
                },
                { transaction: t }
              )
              .then(instance => {
                return findOrCreateArtist(album.artist, {
                  transaction: t
                }).spread(artist => {
                  return instance.setArtist(artist, { transaction: t })
                })
              })
              .then(() => {
                return Promise.map(album.songs, song => {
                  return Promise.join(
                    findOrCreateSong(song, { transaction: t }).spread(i => i),
                    findOrCreateArtists(song.artists, { transaction: t }),
                    (song, artists) => {
                      if (artists && artists.length) {
                        return song
                          .setArtists(artists, { transaction: t })
                          .return(song)
                      }
                    }
                  )
                })
              })
              .then(songs => {
                return instance.setSongs(songs, { transaction: t })
              })
          })
        })
        .catch(ApiError, err => {
          Log.e(err)
        })
    })
}

function addOrRemoveAlbumsSongs() {
  return User.current()
    .then(user =>
      user.getAlbums({
        include: [
          {
            model: Song,
            as: 'songs'
          }
        ]
      })
    )
    .filter(album => album.songCount !== album.songs.length)
    .mapSeries(album => {
      Log.d(`Start fetch album info: ${album.name}`)
      return retry(() => qqmusic.getAlbumInfo(album.mid), {
        max_tries: 4,
        interval: 1000
      })
        .then(album => {
          return sequelize.transaction(t => {
            return findThenUpdateOrCreateAlbum(album, {
              transaction: t
            }).spread(instance => {
              return Promise.map(album.songs, song => {
                return Promise.join(
                  findOrCreateSong(song, { transaction: t }).spread(i => i),
                  findOrCreateArtists(song.artists, { transaction: t }),
                  (song, artists) => {
                    if (artists && artists.length) {
                      return song
                        .setArtists(artists, { transaction: t })
                        .return(song)
                    }
                  }
                )
              }).then(songs => {
                return instance.setSongs(songs, { transaction: t })
              })
            })
          })
        })
        .catch(ApiError, err => {
          Log.e(err)
        })
    })
}

function findOrCreateAlbumIfPresent(album, options) {
  if (album.id && album.mid) {
    return findOrCreateAlbum(album, options).spread(i => i)
  }
  return null
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

function findThenUpdateOrCreateAlbum(album, options) {
  return findOrCreateAlbum(album, options).spread((instance, created) => {
    if (created) return [instance, created]
    return instance
      .update(
        {
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
