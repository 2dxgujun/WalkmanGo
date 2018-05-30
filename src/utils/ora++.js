import ora from 'ora'
import stripAnsi from 'strip-ansi'
import wcwidth from 'wcwidth'

export default function(options) {
  if (typeof options === 'string') {
    options = {
      text: options
    }
  }
  options = Object.assign(
    {
      color: 'green',
      max: 0,
      progress: 0
    },
    options
  )
  const spinner = ora(options)
  spinner.rawText = spinner.text
  Object.defineProperty(spinner, 'text', {
    set: function(text) {
      spinner.rawText = text
      spinner.lineCount = calcLineCount(spinner.text, spinner.stream.columns)
    },
    get: function() {
      if (spinner.max === 0) return spinner.rawText
      const maxLength = spinner.max.toString().length
      const progress = spinner.progress.toString().padStart(maxLength)
      const prefix = `${progress}/${spinner.max} `
      return prefix + spinner.rawText
    }
  })

  const MAX = Symbol('max')
  Object.defineProperty(spinner, 'max', {
    set: function(max) {
      if (max < 0) throw new Error('Invalid max')
      if (!spinner[MAX] || spinner[MAX] === 0) {
        spinner[MAX] = max
        spinner.lineCount = calcLineCount(spinner.text, spinner.stream.columns)
      } else {
        throw new Error("You can't set max more than once")
      }
    },
    get: function() {
      return spinner[MAX]
    }
  })

  const PROGRESS = Symbol('progress')
  Object.defineProperty(spinner, 'progress', {
    set: function(progress) {
      if (progress < 0 || progress > spinner.max)
        throw new Error('Invalid progress')
      spinner[PROGRESS] = progress
    },
    get: function() {
      return spinner[PROGRESS]
    }
  })
  spinner.progress = spinner.options.progress
  spinner.max = spinner.options.max

  return spinner
}

function calcLineCount(value, columns) {
  return stripAnsi('--' + value)
    .split('\n')
    .reduce((count, line) => {
      return count + Math.max(1, Math.ceil(wcwidth(line) / columns))
    }, 0)
}
