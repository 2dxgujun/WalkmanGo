import fs from 'fs'
import path from 'path'
import Sequelize from 'sequelize'

const { walkman_config_workdir: workdir } = process.env

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
  as: 'audios'
})
Album.belongsTo(Local, {
  as: 'art'
})

export { Album, Artist, Playlist, Song, Local }
