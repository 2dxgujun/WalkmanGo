import log4js from 'log4js'

const { walkman_config_logdir: logdir } = process.env

export default function() {
  log4js.configure({
    appenders: {
      console: {
        type: 'console'
      },
      app: {
        type: 'file',
        filename: `${logdir}/app.log`,
        maxLogSize: 10485760,
        backups: 5
      },
      errorFile: {
        type: 'file',
        filename: `${logdir}/error.log`,
        maxLogSize: 1048576,
        backups: 5
      },
      error: {
        type: 'logLevelFilter',
        level: 'ERROR',
        appender: 'errorFile'
      }
    },
    categories: {
      default: {
        appenders: ['console'],
        level: 'DEBUG'
      }
    }
  })
}
