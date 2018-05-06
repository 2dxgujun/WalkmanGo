export default class Writer {
  constructor() {
    this.data = '#EXTM3U\n'
  }

  write(line) {
    this.data += line + '\n'
  }

  file(uri, duration, title) {
    this.write(`#EXTINF:${duration},${title}`)
    this.write(uri)
  }

  toString() {
    return this.data
  }
}
