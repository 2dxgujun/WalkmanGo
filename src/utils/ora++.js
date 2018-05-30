import ora from 'ora'

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
  spinner.max = spinner.options.max
  spinner.progress = spinner.options.progress
  spinner.rawText = spinner.text
  spinner.inc = function(num = 1) {
    spinner.progress += num
    spinner.text = `${spinner.progress}/${spinner.max} ` + spinner.rawText
  }
  return spinner
}
