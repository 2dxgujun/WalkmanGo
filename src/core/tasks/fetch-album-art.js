import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import sharp from 'sharp'
import path from 'path'
import fse from 'fs-extra'
import meter from 'stream-meter'
import Processor from '../../utils/promise-processor'
import Logger from '../../utils/logger'

const { walkman_config_workdir: workdir } = process.env

const Log = new Logger('fetch album art')

export default function() {
  return prepare().then(run)
}

function prepare() {
  const processor = new Processor()
  return Album.all()
    .map(album => {
      return getAlbumArtPath(album).then(artpath => {
        return fse.pathExists(artpath).then(exists => {
          if (!exists) {
            prepareDownloadAlbumArt(processor, album)
          } else {
            prepareCheckAlbumArt(processor, album)
          }
        })
      })
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function prepareDownloadAlbumArt(processor, album) {
  processor.add(() => {
    return getAlbumArtPath(album).then(artpath => {
      return downloadAlbumArt(album)
        .then(bytes => {
          Log.d('Download album art succeed')
          return processor
            .post(() => {
              return createAlbumArt(album, artpath, bytes)
            })
            .then(() => {
              Log.d('Create album art succeed')
            })
            .catch(err => {
              Log.e('Create album art failed', err)
            })
        })
        .catch(err => {
          Log.e('Download album art failed', err)
        })
    })
  })
}

function prepareCheckAlbumArt(processor, album) {
  processor.add(() => {
    return getAlbumArtPath(album).then(artpath => {
      return fse
        .stat(artpath)
        .then(stats => {
          return processor.post(() => {
            return createAlbumArtIfNotExists(album, artpath, stats.size)
          })
        })
        .catch(err => {
          Log.e('Check album art failed', err)
        })
    })
  })
}

function createAlbumArtIfNotExists(album, artpath, bytes) {
  return Local.findOne({
    where: {
      path: artpath,
      mimeType: getMimeType(artpath),
      length: bytes
    }
  }).then(art => {
    if (!art) {
      return createAlbumArt(album, artpath, bytes)
    }
  })
}

function createAlbumArt(album, artpath, bytes) {
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

function downloadAlbumArt(album) {
  return getAlbumArtPath(this.album).then(artpath => {
    const tmppath = `${artpath}.tmp`
    return qqmusic
      .getAlbumArtStream(this.album.id)
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
            .pipe(fse.createWriteStream(tmppath))
          source.on('error', reject)
          stream.on('error', reject)
          stream.on('finish', () => {
            resolve(m.bytes)
          })
        })
      })
      .then(bytes => {
        return fse.rename(tmppath, artpath).return(bytes)
      })
  })
}

function getMimeType(artpath) {
  const extname = path.extname(artpath)
  if (extname === '.jpeg') {
    return 'image/jpeg'
  } else {
    throw new Error('Unrecognized file type')
  }
}

function getAlbumArtPath(album) {
  const artdir = path.resolve(workdir, 'art')
  return fse.ensureDir(artdir).then(() => {
    const artfile = `${album.mid}.jpeg`
    const artpath = path.resolve(artdir, artfile)
    return artpath
  })
}
