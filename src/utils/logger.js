import log4js from 'log4js'

export default class {
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
