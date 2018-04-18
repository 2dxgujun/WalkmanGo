import fs from 'fs'
import ini from 'ini'
import Bluebird from 'bluebird'
import program from 'commander'

global.Promise = Bluebird

program
  .version('0.0.1')
  .option('-c, --config <path>', 'set config file. defaults to ./walkman.ini')
  .parse(process.argv)

Promise.promisify(fs.readFile)(program.config || './walkman.ini', 'utf-8')
  .then(ini.parse)
  .then(config => {
    const { dbpath, songdir, quality, period, uin, playlists } = config.general
    process.env.walkman_config_dbpath = dbpath
    process.env.walkman_config_songdir = songdir
    process.env.walkman_config_period = period
    process.env.walkman_config_uin = uin
    process.env.walkman_config_playlists = playlists
    process.env.walkman_config_quality = quality

    const core = require('./core')
    core.schedule()
  })
  .catch(err => {
    console.log(err.message)
    process.exit(1)
  })
