import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import sharp from 'sharp'
import path from 'path'
import fse from 'fs-extra'
import meter from 'stream-meter'
import Op from './op'
import ProcessQueue from '../../utils/promise-queue-processor'

const { walkman_config_workdir: workdir } = process.env

class DownloadAlbumArt extends Op {
  constructor(album) {
    super('DOWNLOAD_ALBUM_ART')
    this.album = album
  }

  execute() {
    return getAlbumArtPath(this.album).then(artpath => {
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
              .pipe(fse.createWriteStream(temppath))
            source.on('error', reject)
            stream.on('error', reject)
            stream.on('finish', () => {
              resolve(m.bytes)
            })
          })
        })
        .then(bytes => {
          return fse.rename(temppath, artpath).return(bytes)
        })
    })
  }
}

export default function() {
  return prepare().then(run)
}

function prepare() {
  const queue = new ProcessQueue(4)
  return Album.all().map(album => {
    return getAlbumArtPath(album).then(artpath => {
      return fse.pathExists(artpath).then(exists => {
        if (!exists) {
          return queue.enqueue(download(album), (err, bytes) => {
            if (err) {
              Log.e('Download album art error', err)
              return
            }
            Log.d('Download album art succeed ' + album.mid)
            markArt(album, artpath, bytes).catch(err => {
              Log.e(`Mark ${album.mid} failed`, err)
            })
          })
        }
      })
    })
  })
}

function run(queue) {
  return queue.run()
}

function download(album) {
  return () => {
    Log.d('Start downloading album art: ' + album.mid)
    return new DownloadAlbumArt(album).execute()
  }
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

function getAlbumArtPath(album) {
  const artdir = path.resolve(workdir, 'art')
  return fse.ensureDir(artdir).then(() => {
    const artfile = `${album.mid}.jpeg`
    const artpath = path.resolve(artdir, artfile)
    return artpath
  })
}
