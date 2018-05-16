import fse from 'fs-extra'
import ini from 'ini'
import Bluebird from 'bluebird'
import program from 'commander'
import untildify from 'untildify'

import { schedule } from './core/schedule-sync'
import initDetection from './core/init-detection'
import pkg from '../package.json'

global.Promise = Bluebird

function setup() {
  return fse.ensureDir(process.env.WALKMAN_GO_WORKDIR)
}

function parse(data) {
  const cfg = ini.parse(data)
  const { workdir, bitrate } = cfg.general
  const { uin, playlists } = cfg.personal
  process.env.WALKMAN_GO_WORKDIR = untildify(workdir)
  process.env.WALKMAN_GO_BITRATE = bitrate
  process.env.WALKMAN_GO_UIN = uin
  process.env.WALKMAN_GO_PLAYLISTS = playlists
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
  .then(parse)
  .then(setup)
  .then(schedule)
  .then(initDetection)
  .catch(err => {
    console.log(err.message)
    process.exit(1)
  })
