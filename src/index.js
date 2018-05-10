import fse from 'fs-extra'
import path from 'path'
import ini from 'ini'
import Bluebird from 'bluebird'
import program from 'commander'
import Logger from './utils/logger'
import untildify from 'untildify'

import { schedule as scheduleSync } from './core/schedule-sync'
import initDetection from './core/init-detection'
import configureLogger from './core/configure-logger'

global.Promise = Bluebird

function setup(config) {
  const { workdir, logdir, bitrate } = config.general
  const { uin, playlists } = config.personal
  process.env.walkman_config_workdir = untildify(workdir)
  process.env.walkman_config_logdir = untildify(logdir)
  process.env.walkman_config_bitrate = bitrate
  process.env.walkman_config_uin = uin
  process.env.walkman_config_playlists = playlists
  return Promise.join(
    fse.ensureDir(workdir),
    fse.ensureDir(logdir),
    configureLogger()
  )
}

program
  .version('0.0.1')
  .option('-c, --config <path>', 'set config file. defaults to ./walkman-go.ini')
  .parse(process.argv)

fse
  .readFile(program.config || './walkman-go.ini', 'utf-8')
  .then(ini.parse)
  .then(setup)
  .then(scheduleSync)
  .then(initDetection)
  .catch(err => {
    console.log(err.message)
    process.exit(1)
  })
