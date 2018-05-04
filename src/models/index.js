import fs from 'fs'
import path from 'path'
import Sequelize from 'sequelize'

const sequelize = new Sequelize('main', null, null, {
  dialect: 'sqlite',
  storage: process.env.walkman_config_dbpath,
  logging: false
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

Song.belongsTo(Local, {
  as: 'audio'
})
Album.belongsTo(Local, {
  as: 'cover'
})

export { Album, Artist, Playlist, Song, Local }
