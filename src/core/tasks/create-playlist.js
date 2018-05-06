import Sequelize from 'sequelize'
import sequelize, { Album, Artist, Playlist, Song, Local } from '../../models'
import fs from 'fs'

Promise.promisifyAll(fs)

//#EXTM3U
//#EXTINF:Duration,Artist Name - Track Title
//Playlist Name\Artist Name - Song Name.flac

//audio/x-mpegurl

export default function() {
  return Playlist.all({
    include: [
      {
        model: Song,
        as: 'songs'
      }
    ]
  }).then(playlists => {
  
  })
}
