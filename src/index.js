import fs from 'fs'
import ini from 'ini'
import Bluebird from 'bluebird'
import program from 'commander'
import Queue from 'promise-queue'
import { CronJob } from 'cron'

global.Promise = Bluebird

const queue = new Queue(1 /*max concurrent*/, Infinity)

function schedule() {
  const sequelize = require('./models').default
  return sequelize
    .authenticate()
    .then(() => {
      return sequelize.sync()
    })
    .then(() => {
      const enqueue = require('./core/enqueue-tasks')
      new CronJob(
        `00 */5 * * * *`,
        enqueue,
        null, // onComplete
        true, // start now
        'Asia/Shanghai',
        null, // context
        true // run on init
      )
    })
}

function init_walkman_detection() {
  const init = require('./core/init-detection').default
  return init(
    (err, device) => {
      console.log(device)
    },
    (err, device) => {
      console.log(device)
    }
  )
}

program
  .version('0.0.1')
  .option('-c, --config <path>', 'set config file. defaults to ./walkman.ini')
  .parse(process.argv)

Promise.promisify(fs.readFile)(program.config || './walkman.ini', 'utf-8')
  .then(ini.parse)
  .then(config => {
    const { workdir, bitrate } = config.general
    const { uin, playlists } = config.personal
    process.env.walkman_config_workdir = workdir
    process.env.walkman_config_bitrate = bitrate
    process.env.walkman_config_uin = uin
    process.env.walkman_config_playlists = playlists
  })
  .then(schedule)
  .then(init_walkman_detection)
  .catch(err => {
    console.log(err.message)
    process.exit(1)
  })
