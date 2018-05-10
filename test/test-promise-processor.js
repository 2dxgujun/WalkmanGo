var Processor = require('../src/utils/promise-processor').default

var processor = new Processor(4)

processor
  .add(() => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log('Running')
        resolve('1')
      }, 1000)
    })
  })
  .then(msg => {
    console.log('Done, result: ' + msg)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log('Timeout after 5 seconds')
        resolve()
      }, 5000)
    })
  })

processor.add(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(2)
      resolve()
    }, 3000)
  })
})
processor.add(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(3)
      resolve()
    }, 500)
  })
})
processor.add(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(4)
      resolve()
    }, 2000)
  })
})

setTimeout(() => {
  processor.run().then(() => {
    console.log('ALL DONE')
  })
}, 1000)

function foo() {
  return Promise.resolve().then(() => {
    processor.add(() => {
      console.log('FOO')
    })
  })
}

foo().then(() => {})

setTimeout(() => {}, 100000)
