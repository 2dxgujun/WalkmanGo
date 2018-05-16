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

Promise.any([]).then(v => {
  console.log(v)
})

function foo() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve('HELLO')
    }, 2000)
  })
}

async function main() {
  let res = await foo()
  console.log(res)
}

main()
