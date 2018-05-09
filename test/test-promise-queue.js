var Processor = require('../src/utils/promise-queue-processor').default

var queue = new Processor(4)

queue.enqueue(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(1)
      resolve()
    }, 1000)
  })
})
queue.enqueue(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(2)
      resolve()
    }, 3000)
  })
})
queue.enqueue(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(3)
      resolve()
    }, 500)
  })
})
queue.enqueue(() => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(4)
      resolve()
    }, 2000)
  })
})

setTimeout(() => {
  queue.run().then(() => {
    console.log('NICE')
  })
}, 1000)

setTimeout(() => {}, 100000)
