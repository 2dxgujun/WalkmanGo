import fs from 'fs'
import path from 'path'
import Sequelize from 'sequelize'

const { WALKMAN_GO_WORKDIR: workdir } = process.env

const dbpath = path.resolve(workdir, 'walkman-go.db')

const sequelize = new Sequelize('main', null, null, {
  dialect: 'sqlite',
  storage: dbpath,
  logging: false,
  operatorsAliases: Sequelize.Op
})

export default sequelize

const models = {}

fs
  .readdirSync(__dirname)
  .filter(
    file =>
      file.indexOf('.') !== 0 &&
      file !== path.basename(module.filename) &&
      file.slice(-3) === '.js'
  )
  .forEach(file => {
    const model = sequelize.import(path.join(__dirname, file))
    models[model.name] = model
  })

const {
  Album,
  Artist,
  Playlist,
  Song,
  PlaylistSong,
  ArtistSong,
  SongAudio,
  Local
} = models

Playlist.belongsToMany(Song, {
  through: PlaylistSong,
  as: 'songs'
})
Song.belongsToMany(Playlist, {
  through: PlaylistSong,
  as: 'playlists'
})

Artist.belongsToMany(Song, {
  through: ArtistSong,
  as: 'songs'
})
Song.belongsToMany(Artist, {
  through: ArtistSong,
  as: 'artists'
})

Album.hasMany(Song, {
  as: 'songs'
})
Song.belongsTo(Album, {
  as: 'album'
})
Album.belongsTo(Artist, {
  as: 'artist'
})

Song.belongsToMany(Local, {
  through: SongAudio,
  otherKey: 'audio_id',
  as: 'audios'
})
Album.belongsTo(Local, {
  as: 'artwork'
})

Song.prototype.getTargetBitrate = function() {
  return Promise.try(() => {
    const { WALKMAN_GO_BITRATE: bitrate } = process.env
    if (bitrate === 'flac' && song.sizeflac > 0) {
      return 'flac'
    } else if ((bitrate === 'flac' || bitrate === '320') && song.size320 > 0) {
      return '320'
    } else if (
      (bitrate === 'flac' || bitrate === '320' || bitrate === '128') &&
      song.size128 > 0
    ) {
      return '128'
    } else {
      throw new Error('Unrecognized bitrate')
    }
  })
}

Song.prototype.findTargetAudio = function() {
  return Promise.filter(this.audios, audio => {
    return this.findTargetBitrate().then(bitrate => {
      if (audio.SongAudio.bitrate === bitrate) return true
      return false
    })
  }).then(audios => {
    if (audios && !audios.length) return audios[0]
    return null
  })
}

export { Album, Artist, Playlist, Song, Local }
