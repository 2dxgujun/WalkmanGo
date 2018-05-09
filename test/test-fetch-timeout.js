var fetch = require('node-fetch')

fetch('https://httpstat.us/200?sleep=60000')
  .then(res => {
    console.log(res)
  })
  .catch(err => {
    console.error(err)
  })

setTimeout(() => {}, 1000000)
