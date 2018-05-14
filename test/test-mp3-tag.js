var ID3v2 = require('node-id3')
var ID3v1 = require('../src/utils/ID3v1')

var audio = '/Users/2dxgujun/Desktop/A-Lin - 分手需要练习的.mp3'

ID3v2.write(
  {
    private: {
      owner: 'WALKMANGO_BITRATE',
      data: '320'
    }
  },
  audio
)

let tags = ID3v2.read(audio)
console.log(tags)
