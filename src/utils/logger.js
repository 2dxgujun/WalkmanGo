import log4js from 'log4js'

log4js.configure({
  appenders: {
    appFile: {
      type: 'file',
      filename: 'app.log'
    },
    app: {
      type: 'logLevelFilter',
      appender: 'appFile',
      level: 'DEBUG',
      maxLevel: 'WARN'
    },
    errorFile: {
      type: 'file',
      filename: 'error.log'
    },
    error: {
      type: 'logLevelFilter',
      appender: 'errorFile',
      level: 'ERROR'
    }
  },
  categories: {
    default: {
      appenders: ['app', 'error'],
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
