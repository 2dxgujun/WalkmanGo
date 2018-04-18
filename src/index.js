import { CronJob } from 'cron'
import fetch from 'node-fetch'
import fs from 'fs'
import ini from 'ini'
import Bluebird from 'bluebird'
import program from 'commander'

global.Promise = Bluebird
fetch.Promise = Bluebird

program
  .version('0.0.1')
  .option('-c, --config <path>', 'set config file. defaults to ./walkman.ini')
  .parse(process.argv)

let configPath = program.config
configPath = configPath || './walkman.ini'

Promise.promisify(fs.readFile)(configPath, 'utf-8')
  .then(ini.parse)
  .then(config => {
    const { dbpath, download_dir, uin, playlists } = config.general
    process.env.WALKMAN_CONFIG_DBPATH = dbpath
    process.env.WALKMAN_CONFIG_DOWNLOAD_DIR = download_dir
    process.env.WALKMAN_CONFIG_UIN = uin
    process.env.WALKMAN_CONFIG_PLAYLISTS = playlists

    new CronJob(
      '00 */5 * * * *',
      () => {
        
      },
      null, // onComplete
      true, // start now
      'Asia/Shanghai',
      null, // context
      true // run on init
    )
  })
  .catch(err => {
    console.log(err.message)
    process.exit(1)
  })
