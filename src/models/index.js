import fs from 'fs'
import path from 'path'
import Sequelize from 'sequelize'

const sequelize = new Sequelize('main', null, null, {
  dialect: 'sqlite',
  storage: './playlist.sqlite'
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

for (let name in models) {
  const model = models[name]
  if (model.associate) {
    models.associate(models)
  }
}

const { Playlist, Song } = models
export { Playlist, Song }
