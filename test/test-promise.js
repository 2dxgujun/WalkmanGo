var Promise = require('bluebird')

new Promise((resolve, reject) => {
  resolve('Hello')
  console.log('Hey')
})
  .then(r => {
    console.log(r)
    return r
  })
  .finally(() => {
    console.log('finally')
  })
  .then(r => {
    console.log(r)
  })
