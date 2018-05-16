import log4js from 'log4js'

log4js.configure({
  appenders: {
    console: {
      type: 'console'
    }
  },
  categories: {
    default: {
      appenders: ['console'],
      level: 'DEBUG'
    }
  }
})
export default class Logger {
  constructor(category) {
    this.innerLogger = log4js.getLogger(category)
  }

  d() {
    this.innerLogger.debug(...arguments)
  }

  i() {
    this.innerLogger.info(...arguments)
  }

  w() {
    this.innerLogger.warn(...arguments)
  }

  e() {
    this.innerLogger.error(...arguments)
  }
}

const Log = new Logger('')

export { Log }
