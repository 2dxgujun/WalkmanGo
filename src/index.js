import fse from 'fs-extra'
import ini from 'ini'
import Bluebird from 'bluebird'
import program from 'commander'
import untildify from 'untildify'

import { schedule } from './core/schedule'
import initDetection from './core/init-detection'
import pkg from '../package.json'

global.Promise = Bluebird

function setup() {
  const { WALKMAN_GO_WORKDIR: workdir } = process.env
  return fse.ensureDir(workdir).then(() => {
    const sequelize = require('./models').default
    const { User } = require('./models')
    return sequelize
      .authenticate()
      .then(() => sequelize.sync())
      .then(User.ensure)
  })
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
