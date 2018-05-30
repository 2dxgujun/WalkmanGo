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
  const instance = ora(options)
  instance.rawText = instance.text
  instance.preText = ''
  Object.defineProperty(instance, 'text', {
    set: function(text) {
      instance.rawText = text
    },
    get: function() {
      if (instance.max === 0) return instance.rawText
      const prefix = `${instance.progress}/${instance.max} `
      const text = prefix + instance.rawText
      if (text.length !== instance.preText.length) {
        const columns = instance.stream.columns || 80
        instance.lineCount = stripAnsi('--' + text)
          .split('\n')
          .reduce((count, line) => {
            return count + Math.max(1, Math.ceil(wcwidth(line) / columns))
          }, 0)
      }
      return text
    }
  })

  const MAX = Symbol('max')
  Object.defineProperty(instance, 'max', {
    set: function(max) {
      if (max < 0) throw new Error('Invalid max')
      if (!instance[MAX] || instance[MAX] === 0) {
        instance[MAX] = max
      } else {
        throw new Error("You can't set max more than once")
      }
    },
    get: function() {
      return instance[MAX]
    }
  })

  const PROGRESS = Symbol('progress')
  Object.defineProperty(instance, 'progress', {
    set: function(progress) {
      if (progress < 0 || progress > instance.max)
        throw new Error('Invalid progress')
      instance[PROGRESS] = progress
    },
    get: function() {
      return instance[PROGRESS]
    }
  })
  instance.progress = instance.options.progress
  instance.max = instance.options.max

  return instance
}

function calcLineCount(value, columns) {}
