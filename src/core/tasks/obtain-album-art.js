import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import mkdirp from 'mkdirp'
import meter from 'stream-meter'

Promise.promisifyAll(fs)
const mkdirpAsync = Promise.promisify(mkdirp)

const { walkman_config_workdir: workdir } = process.env

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
        return mkdirpAsync(path.dirname(artpath))
          .then(() => {
            return pipeArt(album, artpath)
          })
          .then(bytes => {
            return markArt(album, artpath, bytes)
          })
      })
    },
    { concurrency: 4 }
  )
}

function getMimeType(artpath) {
  const extname = path.extname(artpath)
  if (extname === '.jpeg') {
    return 'image/jpeg'
  } else {
    throw new Error('Unrecognized file type')
  }
}

function markArt(album, artpath, bytes) {
  return sequelize.transaction(t => {
    return Local.create(
      {
        path: artpath,
        mimeType: getMimeType(artpath),
        length: bytes
      },
      { transaction: t }
    ).then(art => {
      return album.setArt(art, { transaction: t })
    })
  })
}

function pipeArt(album, artpath) {
  const temppath = `${artpath}.temp`
  return qqmusic
    .getAlbumArtStream(album.id)
    .then(source => {
      return new Promise((resolve, reject) => {
        const m = meter()
        const stream = source
          .pipe(
            sharp()
              .resize(500)
              .jpeg()
          )
          .pipe(m)
          .pipe(fs.createWriteStream(artpath))
        source.on('error', reject)
        stream.on('error', reject)
        stream.on('finish', () => {
          resolve(m.bytes)
        })
      })
    })
    .then(bytes => {
      return fs.renameAsync(temppath, artpath).then(() => {
        return bytes
      })
    })
}

function getAlbumArtPath(album) {
  const artdir = path.resolve(workdir, 'art')
  const artfile = `${album.artist.name} - ${album.name}.jpeg`
  const artpath = path.resolve(artdir, artfile)
  return artpath
}
