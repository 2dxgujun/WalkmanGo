import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import sharp from 'sharp'
import path from 'path'
import fse from 'fs-extra'
import Processor from '../../utils/promise-processor'
import { Log } from '../../utils/logger'

export default function() {
  Log.d('Start download album artwork')
  return prepare()
    .then(run)
    .catch(err => {
      return Log.e('Uncaught Error when download album artwork', err)
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
  return sequelize.transaction(t => {
    return Local.create(
      {
        path: artworkPath,
        mimeType: getMimeType(artworkPath)
      },
      { transaction: t }
    ).then(artwork => {
      return album.setArtwork(artwork, { transaction: t })
    })
  })
}

function downloadArtwork(album) {
  return getArtworkPath(album).then(artworkPath => {
    const tmppath = `${artworkPath}.tmp`
    return qqmusic
      .getAlbumArtworkStream(album.id)
      .then(source => {
        return new Promise((resolve, reject) => {
          const stream = source
            .pipe(
              sharp()
                .resize(500)
                .jpeg()
            )
            .pipe(fse.createWriteStream(tmppath))
          source.on('error', reject)
          stream.on('error', reject)
          stream.on('finish', resolve)
        })
      })
      .then(() => {
        return fse.rename(tmppath, artworkPath)
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
  const { WALKMAN_GO_WORKDIR: workdir } = process.env
  const artworkDir = path.resolve(workdir, 'artwork')
  return fse.ensureDir(artworkDir).then(() => {
    const artworkFile = `${album.mid}.jpeg`
    const artworkPath = path.resolve(artworkDir, artworkFile)
    return artworkPath
  })
}
