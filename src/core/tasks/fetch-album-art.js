import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import sharp from 'sharp'
import path from 'path'
import fse from 'fs-extra'
import meter from 'stream-meter'

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
      return getAlbumArtPath(album).then(artpath => {
        return fse.access(artpath).catch(() => {
          return pipeArt(album, artpath).then(bytes => {
            return markArt(album, artpath, bytes)
          })
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
          .pipe(fse.createWriteStream(temppath))
        source.on('error', reject)
        stream.on('error', reject)
        stream.on('finish', () => {
          resolve(m.bytes)
        })
      })
    })
    .then(bytes => {
      return fse.rename(temppath, artpath).then(() => {
        return bytes
      })
    })
}

function getAlbumArtPath(album) {
  const artdir = path.resolve(workdir, 'art')
  return fse.ensureDir(artdir).then(() => {
    const artfile = `${album.artist.name} - ${album.name}.jpeg`
    const artpath = path.resolve(artdir, artfile)
    return artpath
  })
}
