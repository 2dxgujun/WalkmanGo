import fs from 'fs'
import path from 'path'
import Sequelize from 'sequelize'

const sequelize = new Sequelize('main', null, null, {
  dialect: 'sqlite',
  storage: process.env.WALKMAN_CONFIG_DBPATH
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

const { Playlist, Song, PlaylistSong } = models

Playlist.belongsToMany(Song, {
  through: PlaylistSong
})
Song.belongsToMany(Playlist, {
  through: PlaylistSong
})

export { Playlist, Song }
