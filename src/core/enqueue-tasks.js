import {
  attach_album_art,
  fetch_data,
  fetch_audio,
  fetch_album_art,
  create_m3u
} from './tasks'

export default function(queue) {
  queue.add(fetch_data).catch(err => {
    console.error(err)
  })
  queue.add(fetch_audio).catch(err => {
    console.error(err)
  })
  queue.add(fetch_album_art).catch(err => {
    console.error(err)
  })
  queue.add(attach_album_art).catch(err => {
    console.error(err)
  })
  queue.add(create_m3u).catch(err => {
    console.error(err)
  })
}
