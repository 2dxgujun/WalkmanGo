import Promise from 'bluebird'

export function retry(func, options) {
  options = options || {}

  var interval = typeof options.interval === 'number' ? options.interval : 1000

  var max_tries
  if (typeof options.max_tries !== 'undefined') {
    max_tries = options.max_tries
  }

  var tries = 0
  var start = new Date().getTime()

  function try_once() {
    var tryStart = new Date().getTime()
    return Promise.try(func).catch(err => {
      ++tries
      var now = new Date().getTime()

      if (max_tries && tries === max_tries) {
        return Promise.reject(err)
      } else {
        var delay = interval - (now - tryStart)
        if (delay <= 0) {
          return try_once()
        } else {
          return Promise.delay(delay).then(try_once)
        }
      }
    })
  }
  return try_once()
}
