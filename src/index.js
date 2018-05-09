import fse from 'fs-extra'
import path from 'path'
import ini from 'ini'
import Bluebird from 'bluebird'
import program from 'commander'
import Logger from './utils/logger'

import { schedule as schedule_sync } from './core/schedule-sync'
import init_detection from './core/init-detection'
import configure_log from './core/configure-log'

global.Promise = Bluebird

function setup(config) {
  let { workdir, logdir } = config.general
  const { bitrate } = config.general
  const { uin, playlists } = config.personal
  if (workdir[0] === '~') {
    workdir = path.join(process.env.HOME, workdir.slice(1))
  }
  if (logdir[0] === '~') {
    logdir = path.join(process.env.HOME, logdir.slice(1))
  }
  process.env.walkman_config_workdir = workdir
  process.env.walkman_config_logdir = logdir
  process.env.walkman_config_bitrate = bitrate
  process.env.walkman_config_uin = uin
  process.env.walkman_config_playlists = playlists
  return Promise.join(fse.ensureDir(workdir), fse.ensureDir(logdir))
}

program
  .version('0.0.1')
  .option('-c, --config <path>', 'set config file. defaults to ./walkman.ini')
  .parse(process.argv)

fse
  .readFile(program.config || './walkman.ini', 'utf-8')
  .then(ini.parse)
  .then(setup)
  .then(configure_log)
  .then(schedule_sync)
  .then(init_detection)
  .catch(err => {
    console.log(err.message)
    process.exit(1)
  })
