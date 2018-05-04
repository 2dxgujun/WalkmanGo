import * as qqmusic from '../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song } from '../models'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

Promise.promisifyAll(fs)

export default function() {
  return Album.all({
    include: [
      {
        model: Artist,
        as: 'artist'
      }
    ]
  }).map(
    album => {
      const artpath = getAlbumArtPath(album)
      return fs.accessAsync(artpath).catch(() => {
        return fs.openAsync(artpath, 'w').then(fd => {
          return qqmusic.getAlbumArtStream(album.id).then(source => {
            return new Promise((resolve, reject) => {
              const stream = source
                .pipe(
                  sharp()
                    .resize(500)
                    .jpeg()
                )
                .pipe(fs.createWriteStream(artpath, { fd }))
              source.on('error', reject)
              stream.on('error', reject)
              stream.on('finish', resolve)
            })
          })
        })
      })
    },
    { concurrency: 4 }
  )
}

function getAlbumArtPath(album) {
  const artdir = process.env.walkman_config_artdir
  const artfile = `${album.artist.name}-${album.name}.jpeg`
  const artpath = path.resolve(artdir, artfile)
  return artpath
}
