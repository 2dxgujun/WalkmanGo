var ID3v2 = require('node-id3')
var ID3v1 = require('../src/utils/ID3v1')

var audio = '/Users/2dxgujun/Desktop/A-Lin - 分手需要练习的.mp3'

var succeed = ID3v2.removeTags(audio)
console.log('remove ID3v2 tags: ' + succeed)

ID3v1.removeTags(audio).then(() => {
  console.log('remove ID3v1 tags')
}).catch(err => {
  console.error(err)
})
