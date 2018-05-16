import fse from 'fs-extra'

function removeTagsAsync(filepath) {
  return fse.readFile(filepath).then(data => {
    const tagPosition = data.lastIndexOf('TAG')
    const tagLength = data.length - tagPosition
    if (tagPosition !== -1 && tagLength === 128) {
      return fse
        .writeFile(filepath, data.slice(0, tagPosition), {
          encoding: 'binary'
        })
        .then(() => true)
    } else {
      return false
    }
  })
}

export default {
  removeTagsAsync
}
