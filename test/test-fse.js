var fse = require('fs-extra')

fse.readdir('/Users/2dxgujun/Workspace', (err, items) => {
  console.log(items)
})
