import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { User, Album, Artist, Playlist, Song } from '../../models'
import { Log } from '../../utils/logger'
import { retry } from '../../utils/promise-retry'
import _ from 'lodash'
import ApiError from '../../vendor/api-error'
import ora from '../../utils/ora++'

const { WALKMAN_GO_UIN: uin, WALKMAN_GO_PLAYLISTS } = process.env

export default function() {
  return addOrRemovePlaylists()
    .then(addOrRemoveAlbums)
    .catch(err => {
      Log.e('Error when fetch data: ', err)
    })
}

function addOrRemovePlaylists() {
  const spinner = ora()
  return qqmusic
    .getPlaylists(uin)
    .filter(playlist => {
      return WALKMAN_GO_PLAYLISTS.split(',').includes(playlist.name)
    })
    .mapSeries((playlist, index, length) => {
      spinner.progress({
        text: 'Updating playlists',
        max: length,
        progress: index + 1
      })
      return sequelize.transaction(t => {
        return findThenUpdateOrCreatePlaylist(playlist, {
          transaction: t
        }).spread((instance, created) => {
          return addOrRemovePlaylistSongs(instance, {
            transaction: t
          }).return(instance)
        })
      })
    })
    .then(playlists => {
      return User.current().then(user => {
        return user.setPlaylists(playlists)
      })
    })
    .then(() => {
      spinner.succeed()
    })
    .catch(err => {
      spinner.fail('Failed to update playlists')
      Log.e(err)
    })
}

function addOrRemoveAlbums() {
  const spinner = ora()
  return qqmusic
    .getAlbums(uin)
    .filter(album => {
      // Filter albums for develop, not intent to use to production
      if (process.env.WALKMAN_GO_ALBUMS) {
        return process.env.WALKMAN_GO_ALBUMS.split(',').includes(album.name)
      }
      return true
    })
    .mapSeries((album, index, length) => {
      spinner.progress({
        text: 'Updating albums',
        max: length,
        progress: index + 1
      })
      return sequelize.transaction(t => {
        return Promise.join(
          findOrCreateAlbum(album, { transaction: t }).spread(i => i),
          findOrCreateArtist(album.artist, { transaction: t }).spread(i => i),
          (album, artist) => {
            return album
              .setArtist(artist, { transaction: t })
              .then(() => album.getSongs())
              .then(songs => {
                if (album.songCount != songs.length) {
                  return addOrRemoveAlbumSongs(album, { transaction: t })
                }
              })
              .return(album)
          }
        )
      })
    })
    .then(albums => {
      return User.current().then(user => {
        return user.setAlbums(albums)
      })
    })
    .then(() => {
      spinner.succeed()
    })
    .catch(err => {
      spinner.fail('Failed to update albums')
      Log.e(err)
    })
}

function addOrRemovePlaylistSongs(playlist, options) {
  return qqmusic.getPlaylistSongs(playlist.id).then(songs => {
    return Promise.map(songs, song => {
      return Promise.join(
        findOrCreateSong(song, options).spread(i => i),
        findOrCreateAlbumIfPresent(song.album, options),
        findOrCreateArtists(song.artists, options),
        (song, album, artists) => {
          return Promise.resolve(album)
            .then(album => {
              if (album) {
                return album.addSong(song, options)
              }
            })
            .then(() => {
              if (artists && artists.length) {
                return song.setArtists(artists, options)
              }
            })
            .return(song)
        }
      )
    }).then(songs => {
      return playlist.setSongs(songs, options)
    })
  })
}

function addOrRemoveAlbumSongs(album, options) {
  return retry(() => qqmusic.getAlbumInfo(album.mid), {
    max_tries: 4,
    interval: 1000
  })
    .then(albuminfo => {
      return album
        .update(
          {
            songCount: albuminfo.song_cnt,
            releaseDate: albuminfo.release_date,
            language: albuminfo.language,
            genre: albuminfo.genre
          },
          options
        )
        .then(album => {
          return Promise.map(albuminfo.songs, song => {
            return Promise.join(
              findOrCreateSong(song, options).spread(i => i),
              findOrCreateArtists(song.artists, options),
              (song, artists) => {
                if (artists && artists.length) {
                  return song.setArtists(artists, options).return(song)
                }
              }
            )
          }).then(songs => {
            return album.setSongs(songs, options)
          })
        })
    })
    .catch(ApiError, err => {
      if (err.code === 404) Log.w(err)
      else throw err
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
