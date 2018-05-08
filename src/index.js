import fse from 'fs-extra'
import ini from 'ini'
import Bluebird from 'bluebird'
import program from 'commander'

import { schedule, unschedule } from './core/schedule-fetch'

global.Promise = Bluebird

// 监听Walkman连接/断开事件
// 当前状态：1. Walkman已连接
//           2. 无Walkman连接
//
// 无Walkman连接时，恢复运行Cron任务
// 有Walkman连接时，1. 当前正在运行Task：等Task运行结束，执行以下操作
//                  2. 当前无Task正在运行：立即执行以下操作
//
// 停止执行Cron任务，开启Walkman同步任务队列
//
// Walkman同步任务：1. 检测Walkman设备挂载点（若有多个挂载点，提示选择）
//                  2. 处理歌单数据（新增/删除歌曲数量，提示确认）
//                  3. 传输或删除歌曲文件
//                  4. 最后传输M3U文件

function init_walkman_detection() {
  const detect = require('./core/detect-walkman').default
  return detect((err, device) => {}, (err, device) => {})
}

function setup(config) {
  const { workdir, bitrate } = config.general
  const { uin, playlists } = config.personal
  process.env.walkman_config_workdir = workdir
  process.env.walkman_config_bitrate = bitrate
  process.env.walkman_config_uin = uin
  process.env.walkman_config_playlists = playlists
  return fse.ensureDir(workdir)
}

program
  .version('0.0.1')
  .option('-c, --config <path>', 'set config file. defaults to ./walkman.ini')
  .parse(process.argv)

fs
  .readFile(program.config || './walkman.ini', 'utf-8')
  .then(ini.parse)
  .then(setup)
  .then(schedule)
  .then(init_walkman_detection)
  .catch(err => {
    console.log(err.message)
    process.exit(1)
  })
