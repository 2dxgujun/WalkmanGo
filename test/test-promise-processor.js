var Processor = require('../src/utils/promise-processor').default

var processor = new Processor(2)

processor.add(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(2)
      resolve()
    }, 1000)
  })
})

processor.add(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(4)
      reject('fuck')
    }, 3000)
  })
})
processor.add(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(1)
      resolve()
    }, 500)
  })
})
processor.add(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(3)
      resolve()
    }, 2000)
  })
})

processor.on('progress', ({ max, progress }) => {
  console.log(`${progress} / ${max}`)
})

processor.on('error', err => {
  console.error('on error: ' + err)
})

setTimeout(() => {
  processor
    .run()
    .then(() => {
      console.log('ALL DONE')
    })
    .catch(err => {
      console.error(err)
    })
}, 1000)

setTimeout(() => {}, 10000)
