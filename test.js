var flac = require('flac-bindings')
var fs = require('fs')

var iterator = flac.bindings.metadata1.new()

console.log(flac.bindings.metadata1.status(iterator))

flac.bindings.metadata1.init(
  iterator,
  '/Users/2dxgujun/Desktop/flac.flac',
  false,
  false
)

console.log(flac.bindings.metadata1.status(iterator))

var blockData

while (flac.bindings.metadata1.next(iterator)) {
  var blockType =
    flac.bindings.format.MetadataTypeString[
      flac.bindings.metadata1.get_block_type(iterator)
    ]
  console.log('Block type: ' + blockType)
  if (blockType === 'PICTURE') {
    blockData = flac.bindings.metadata1.get_block(iterator)
    console.log(blockData)
    break
  }
}

var imageData = fs.readFileSync('/Users/2dxgujun/Desktop/test.png')

//console.log(imageData)
//blockData.data.fill(imageData)

//flac.bindings.metadata1.set_block(iterator, blockData, true)

console.log(flac.bindings.metadata1.status(iterator))
