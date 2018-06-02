import * as qqmusic from '../../vendor/qqmusic'
import Sequelize from 'sequelize'
import sequelize, {
  User,
  Album,
  Artist,
  Playlist,
  Song,
  Local
} from '../../models'
import sharp from 'sharp'
import path from 'path'
import fse from 'fs-extra'
import Processor from '../../utils/promise-processor'
import { Log } from '../../utils/logger'
import ora from '../../utils/ora++'
import progress from 'progress-stream'
import _ from 'lodash'

export default function() {
  Log.d('Start download album artwork')
  const spinner = ora()
  return prepare(spinner)
    .then(run)
    .then(() => {
      spinner.succeed()
    })
    .catch(err => {
      return Log.e('Uncaught Error when download album artwork', err)
    })
}

function prepare(spinner) {
  const processor = Processor.create()
  return findUserAlbums()
    .map(album => {
      if (!album.artwork) {
        return enqueueJob(processor, spinner, album)
      }
    })
    .return(processor)
}

function findUserAlbums() {
  return User.current()
    .then(user => {
      return Promise.join(
        user.getPlaylists({
          include: [
            {
              model: Song,
              as: 'songs',
              include: [
                {
                  model: Album,
                  as: 'album',
                  include: [
                    {
                      model: Local,
                      as: 'artwork'
                    }
                  ]
                }
              ]
            }
          ]
        }),
        user.getAlbums({
          include: [
            {
              model: Local,
              as: 'artwork'
            }
          ]
        }),
        (playlists, albums) => {
          return [
            ..._.flatten(
              playlists.map(playlist => playlist.songs.map(song => song.album))
            ),
            ...albums
          ]
        }
      )
    })
    .then(_.filter)
    .then(albums => _.uniqBy(albums, 'id'))
}

function run(processor) {
  return processor.run()
}

function enqueueJob(processor, spinner, album) {
  return processor.add(() => {
    return getArtworkPath(album).then(artworkPath => {
      return download(spinner, album)
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

function download(spinner, album) {
  return getArtworkPath(album).then(artworkPath => {
    const tmppath = `${artworkPath}.tmp`
    return qqmusic
      .getAlbumArtworkStream(album.id)
      .then(source => {
        return new Promise((resolve, reject) => {
          const p = progress()
          // prettier-ignore
          const stream = source
            .pipe(p)
            .pipe(sharp().resize(500).jpeg())
            .pipe(fse.createWriteStream(tmppath))
          p.on('progress', progress => {
            getArtworkFile(album).then(artworkfile => {
              spinner.piping({ name: artworkfile, progress })
            })
          })
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
  return fse
    .ensureDir(artworkDir)
    .then(() => getArtworkFile(album))
    .then(artworkFile => {
      return path.resolve(artworkDir, artworkFile)
    })
}

function getArtworkFile(album) {
  return Promise.resolve(`${album.mid}.jpeg`)
}
