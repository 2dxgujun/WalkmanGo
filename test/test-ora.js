// const ora = require('../src/utils/ora++').default

import ora from '../src/utils/ora++'

const spinner = ora()

//spinner.piping({
//  text: '夏璃夜 - なんでもないや (没什么大不了) (女声翻唱remix).mp3',
//  progress: {
//    percentage: 9.05,
//    eta: 42,
//    speed: 949624
//  }
//})

spinner.progress({
  text: 'Updating playlists',
  max: 7,
  progress: 1
})

//const spinners = [
//  ora({ text: 'Loading rainbows\n', max: 10 }).start(),
//  ora({ text: 'Loading unicorns', max: 10 }).start()
//]
//
//var index = 0
//setInterval(() => {
//  spinners[index++ % 2].progress++
//}, 600)
//
//setTimeout(() => {
//  spinners[0].succeed('Nice')
//  spinners[1].fail("I'm sorry")
//}, 10000)
