var ID3v2 = require('node-id3')
var ID3v1 = require('../src/utils/ID3v1').default

var audio = '/Users/2dxgujun/Desktop/M8000012nFaQ1YGenK.mp3'

ID3v2.write(
  {
    title: 'Stronger'
  },
  audio
)
