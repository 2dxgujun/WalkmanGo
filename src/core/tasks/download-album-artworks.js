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
    .catch(err => {
      return Log.e('Uncaught Error when download album art', err)
    })
}

function prepare() {
  const processor = Processor.create()
  return Album.all({
    include: [
      {
        model: Local,
        as: 'artwork'
      }
    ]
  })
    .map(album => {
      if (!album.artwork) {
        return prepareDownload(processor, album)
      }
    })
    .return(processor)
}

function run(processor) {
  return processor.run()
}

function prepareDownload(processor, album) {
  return processor.add(() => {
    return getArtworkPath(album).then(artworkPath => {
      Log.d(`Downloading: ${artworkPath}`)
      return downloadArtwork(album)
        .then(() => {
          return processor
            .post(() => {
              return addArtwork(album, artworkPath)
            })
            .catch(err => {
              Log.e(`Create artwork failed: ${artworkPath}`, err)
            })
        })
        .catch(err => {
          Log.e(`Download failed: ${artworkPath}`, err)
        })
    })
  })
}

function addArtwork(album, artworkPath) {
  return fse.stat(artworkPath).then(stats => {
    return sequelize.transaction(t => {
      return Local.create(
        {
          path: artworkPath,
          mimeType: getMimeType(artworkPath),
          length: stats.size
        },
        { transaction: t }
      ).then(artwork => {
        return album.setArtwork(artwork, { transaction: t })
      })
    })
  })
}

function downloadAlbumArt(album) {
  return getArtworkPath(album).then(artworkPath => {
    const tmppath = `${artworkPath}.tmp`
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
        return fse.rename(tmppath, artworkPath).return(bytes)
      })
  })
}

function getMimeType(artworkPath) {
  const extname = path.extname(artworkPath)
  if (extname === '.jpeg') {
    return 'image/jpeg'
  } else {
    throw new Error('Unrecognized file type')
  }
}

function getArtworkPath(album) {
  const artdir = path.resolve(workdir, 'art')
  return fse.ensureDir(artdir).then(() => {
    const artfile = `${album.mid}.jpeg`
    const artworkPath = path.resolve(artdir, artfile)
    return artworkPath
  })
}
