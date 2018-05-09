import { format } from 'url'
import { STATUS_CODES } from 'http'

export default class HttpError extends Error {
  constructor(code, message) {
    super(message || STATUS_CODES[code])
    this.name = STATUS_CODES[code]
    this.statusCode = code
  }
}
