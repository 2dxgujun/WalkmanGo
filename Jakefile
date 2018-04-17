#!/usr/bin/env node

var PROJECT = 'walkman'

desc('Test database connection')
task(
  'authenticate',
  {
    async: true
  },
  () => {
    var sequelize = require('./dist/models').default
    sequelize
      .authenticate({
        logging: false
      })
      .then(() => {
        jake.logger.log('Connection has been established successfully.')
        complete()
      })
      .catch(err => {
        jake.logger.error('Unable to connect to the database: ', err)
        fail(err)
      })
  }
)

desc('Sync all models')
task('sync', { async: true }, () => {
  var sequelize = require('./dist/models').default
  sequelize
    .sync()
    .then(() => {
      jake.logger.log('Database synchronization finished successfully.')
      complete()
    })
    .catch(err => {
      jake.logger.error('Unable to sync model structures: ', err)
      fail(err)
    })
})
