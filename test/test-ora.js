const ora = require('../src/utils/ora++').default

const spinner = ora({ max: 10, text: 'Loading unicorns' }).start()

setInterval(() => {
  spinner.inc()
}, 600)

setTimeout(() => {
  spinner.succeed('Fuck you')
}, 10000)
