import ora from 'ora'
import bitrate from 'bitrate'
import stripAnsi from 'strip-ansi'
import wcwidth from 'wcwidth'
import align from 'wide-align'
import truncate from 'cli-truncate'
import _ from 'lodash'

// Piping 夏璃夜 - なんでもないや (没什么大不了) (女声翻唱remix).mp3         3.18 Mbps 29% 3.7s
function pipingText(options) {
  const { name, progress: { speed, percentage, eta } } = options
  const mbps = _.round(bitrate(speed, 1, 'mbps'), 2)
  // 3.18 Mbps 29% 3s
  const progress = `${mbps} Mbps ${_.round(percentage)}% ${eta}s`
  const columns = process.stderr.columns || 80
  const padEnd = 4
  let widthRemain = columns
  widthRemain -= wcwidth(`--Piping--${progress}`)
  if (widthRemain >= wcwidth(name) + padEnd) {
    return `Piping ${align.left(name, widthRemain)} ${progress}`
  } else {
    return `Piping ${align.left(
      truncate(name, widthRemain - padEnd),
      widthRemain
    )} ${progress}`
  }
}

// Updating playlists: 100% (52/52)
// Updating playlists: 100% (52/52), done.
function progressText(options) {
  const { text, progress, max } = options
  const percentage = _.round(progress / max * 100)
  return `${text}: ${percentage}% (${progress}/${max})`
}

export default function(options) {
  const instance = ora(options)

  instance.__proto__.plain = function(text) {
    this.text = text
    return instance.start()
  }

  instance.__proto__.piping = function(options) {
    this.type = 'piping'
    this.text = pipingText(options)
    return instance.start()
  }

  instance.__proto__.progress = function(options) {
    options = Object.assign(
      {
        text: this.text
      },
      options
    )
    this.type = 'progress'
    this.text = progressText(options)
    return instance.start()
  }

  const succeed = instance.succeed
  instance.__proto__.succeed = function(text) {
    if (this.type === 'progress') {
      return succeed.bind(this)(`${this.text}, done.`)
    }
    return succeed.bind(this)(text)
  }

  const fail = instance.fail
  instance.__proto__.fail = function(text) {
    return fail.bind(this.start())(text)
  }

  const warn = instance.warn
  instance.__proto__.warn = function(text) {
    return warn.bind(this.start())(text)
  }

  return instance
}
