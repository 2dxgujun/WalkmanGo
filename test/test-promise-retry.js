import { retry } from '../src/utils/promise-retry'

function logFail() {
  console.log(new Date().toISOString())
  //throw new Error('bail')
  return 'succeed'
}

retry(logFail, { max_tries: 4, interval: 1000 })
  .then(res => {
    console.log(res)
    console.log('fuck')
  })
  .catch(err => {
    console.log(err)
  })
