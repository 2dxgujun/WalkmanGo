const ora = require('../src/utils/ora++').default

const spinner = ora({
  max: 10,
  text:
    'Loading unicorns nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn'
}).start()

//const spinner = ora({ max: 10 }).start()

const texts = ['Loading rainbows', 'Loading unicorns']

var index = 0
setInterval(() => {
  //spinner.text = texts[index++ % 2]
  spinner.progress++
}, 600)

setTimeout(() => {
  spinner.succeed('Fuck you')
}, 10000)
