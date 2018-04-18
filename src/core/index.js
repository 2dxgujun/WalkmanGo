import * as qqmusic from '../vendor/qqmusic'
import { CronJob } from 'cron'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song } from '../models'
import Queue from 'promise-queue'
import fs from 'fs'
import path from 'path'

const queue = new Queue(1 /*max concurrent*/, Infinity)

export function schedule() {
  new CronJob(
    `00 */${process.env.walkman_config_period} * * * *`,
    run,
    null, // onComplete
    true, // start now
    'Asia/Shanghai',
    null, // context
    true // run on init
  )
}

function run() {
  //queue.add(FetchAndPersistPlaylists).catch(err => {
  //  console.error(err)
  //})
  //queue.add(FetchAndPersistSongs).catch(err => {
  //  console.error(err)
  //})
  queue.add(DownloadSongs).catch(err => {
    console.error(err)
  })
}

function FetchAndPersistPlaylists() {
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
            return findThenUpdateOrCreatePlaylist(playlist, { transaction: t })
          })
        })
      })
    })
}

function FetchAndPersistSongs() {
  return Playlist.all().mapSeries(playlist => {
    return sequelize.transaction(t => {
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
              (song, album, artists) => {
                return Promise.join(
                  album.addSong(song, { transaction: t }),
                  song.setArtists(artists, { transaction: t }),
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
    if (created) return instance
    return instance.update(
      {
        name: playlist.name,
        songCount: playlist.song_cnt
      },
      ...options
    )
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
  return sequelize.transaction(t => {
    return Album.findOrCreate({
      where: {
        id: album.id
      },
      defaults: {
        id: album.id,
        mid: album.id,
        name: album.name,
        songCount: album.song_cnt,
        releaseDate: album.release_date,
        language: album.language,
        genre: album.genre
      },
      ...options
    })
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

function DownloadSongs() {
  return Song.all({
    include: [
      {
        model: Artist,
        as: 'artists'
      }
    ]
  }).map(
    song => {
      const songdir = process.env.walkman_config_songdir
      const songfile = `${song.artists[0].name}-${song.name}.${ext(song)}`
      const songpath = path.resolve(songdir, songfile)
      return Promise.promisify(fs.access)(songpath).catch(err => {
        return Promise.promisify(fs.open)(songpath, 'w').then(fd => {
          const dest = fs.createWriteStream(songpath, {
            fd: fd,
            autoClose: true
          })
          dest.on('close', () => {
            console.log('dest on close')
          })
          dest.on('finish', () => {
            console.log('dest on finish')
          })
          return qqmusic.getAudioStream(getFilename(song)).then(source => {
            source.pipe(dest)
            source.on('end', () => {
              console.log('source on end')
            })
          })
        })
      })
    },
    { concurrency: 4 }
  )
}

function ext(song) {
  const quality = process.env.walkman_config_quality
  if (quality === 'lossless' && song.sizeflac > 0) {
    return 'flac'
  } else {
    return 'mp3'
  }
}

function getFilename(song) {
  const quality = process.env.walkman_config_quality
  if (quality === 'lossless' && song.sizeflac > 0) {
    return `F000${song.mid}.flac`
  } else if (quality === 'high' && song.size320 > 0) {
    return `M800${song.mid}.mp3`
  } else if (quality === 'low' && song.size128 > 0) {
    return `M500${song.mid}.mp3`
  } else {
    throw new Error('')
  }
}
