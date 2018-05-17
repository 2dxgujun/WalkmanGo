var mp3duration = require('mp3-duration')
var fs = require('fs')
var path = require('path')
var Promise = require('bluebird')

var mp3durationAsync = Promise.promisify(mp3duration)

var dir = '/Volumes/WALKMAN 1/MUSIC/WALKMANGO/Mon'
fs.readdir(dir, (err, files) => {
  files.map(file => {
    mp3durationAsync(path.resolve(dir, file)).then(duration => {
      console.log(duration)
    })
  })
})
