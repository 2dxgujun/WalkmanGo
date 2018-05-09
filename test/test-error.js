var log4js = require('log4js')
var logger = log4js.getLogger()
logger.level = 'debug'
logger.error('Some debug messages', new Error('FUCK ERROR'))
