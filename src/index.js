import fse from 'fs-extra'
import path from 'path'
import ini from 'ini'
import Bluebird from 'bluebird'
import program from 'commander'
import Logger from './utils/logger'
import untildify from 'untildify'

import { schedule as scheduleSync } from './core/schedule-sync'
import initDetection from './core/init-detection'
import pkg from '../package.json'

global.Promise = Bluebird

function setup(config) {
  const { workdir, bitrate } = config.general
  const { uin, playlists } = config.personal
  process.env.walkman_config_workdir = untildify(workdir)
  process.env.walkman_config_bitrate = bitrate
  process.env.walkman_config_uin = uin
  process.env.walkman_config_playlists = playlists
  const configure = require('./core/configure-logger').default
  return Promise.join(
    fse.ensureDir(process.env.walkman_config_workdir),
    configure()
  )
}

program
  .version(pkg.version)
  .option(
    '-c, --config <path>',
    'set config file. defaults to ./walkman-go.ini'
  )
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
