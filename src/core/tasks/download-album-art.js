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

const Log = new Logger('DOWNLOAD')

export default function() {
  Log.d('Start download album art')
  return prepare()
    .then(run)
    .then(() => {
      Log.d('Done download album art')
    })
    .catch(err => {
      return Log.e('Uncaught Error when download album art', err)
    })
}

function prepare() {
  const processor = Processor.create()
  return Album.all()
    .map(album => {
      return getAlbumArtPath(album).then(artpath => {
        return fse.pathExists(artpath).then(exists => {
          if (!exists) {
            return prepareDownloadAlbumArt(processor, album)
          } else {
            return prepareCheckAlbumArt(processor, album)
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
  return processor.add(() => {
    Log.d(`Downloading: ${album.id}`)
    return getAlbumArtPath(album).then(artpath => {
      return downloadAlbumArt(album)
        .then(() => {
          return processor
            .post(() => {
              return createAlbumArt(album, artpath)
            })
            .catch(err => {
              Log.e(`Create album art failed: ${artpath}`, err)
            })
        })
        .catch(err => {
          Log.e(`Download album art failed: ${album.id}`, err)
        })
    })
  })
}

function prepareCheckAlbumArt(processor, album) {
  return processor.add(() => {
    return getAlbumArtPath(album).then(artpath => {
      return processor
        .post(() => {
          return createAlbumArtIfNotExists(album, artpath)
        })
        .catch(err => {
          Log.e(`Check album art failed: ${artpath}`, err)
        })
    })
  })
}

function createAlbumArtIfNotExists(album, artpath) {
  return Local.findOne({
    where: {
      path: artpath
    }
  }).then(art => {
    if (!art) {
      return createAlbumArt(album, artpath)
    }
  })
}

function createAlbumArt(album, artpath) {
  return fse.stat(artpath).then(stats => {
    return sequelize.transaction(t => {
      return Local.create(
        {
          path: artpath,
          mimeType: getMimeType(artpath),
          length: stats.size
        },
        { transaction: t }
      ).then(art => {
        return album.setArt(art, { transaction: t })
      })
    })
  })
}

function downloadAlbumArt(album) {
  return getAlbumArtPath(album).then(artpath => {
    const tmppath = `${artpath}.tmp`
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
