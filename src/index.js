import { CronJob } from 'cron'
import * as qqmusic from './vendor/qqmusic'

const job = new CronJob(
  '00 */5 * * * *',
  () => {
    qqmusic.getPlaylists('414236069').then(result => {
      console.log(result)
    })
  },
  null /* onComplete*/,
  true /*start now*/,
  'Asia/Shanghai',
  null /*context*/,
  true /*run on init*/
)
