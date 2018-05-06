var Writer = require('../src/utils/m3u-writer').default

var writer = new Writer()

writer.file('Sun\\Jay - Song.flac', 200, 'Jay - Song')
console.log(writer.toString())
