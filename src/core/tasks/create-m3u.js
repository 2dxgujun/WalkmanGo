import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import fse from 'fs-extra'
import path from 'path'


export default function() {
  return Playlist.all({
    include: [
      {
        model: Song,
        as: 'songs',
        include: [
          {
            model: Artist,
            as: 'artists'
          },
          {
            model: Local,
            as: 'audio'
          }
        ]
      }
    ]
  }).map(
    playlist => {
      const writer = new M3UWriter()
      return Promise.each(playlist.songs, song => {
        const audiofile = path.basename(song.audio.path)
        const url = `${playlist.name}/${audiofile}`
        let title
        if (song.artists && song.artists.length > 0) {
          title = `${song.artists[0].name} - ${song.name}`
        } else {
          title = song.name
        }
        return getAudioDuration(song).then(duration => {
          writer.file(url, duration, title)
        })
      })
        .then(() => {
          return writer.toString()
        })
        .then(m3u => {
          return pipe(playlist, m3u).then(bytes => {
            return mark(playlist, bytes)
          })
        })
    },
    { concurrency: 4 }
  )
}
