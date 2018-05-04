import fetch from 'node-fetch'

export function getPlaylists(uin) {
  return fetch(
    `https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?hostuin=${uin}&size=32&format=json`,
    {
      headers: {
        referer: 'https://y.qq.com/'
      }
    }
  )
    .then(res => res.json())
    .then(result => {
      return result.data.disslist.map(diss => {
        return {
          id: diss.tid,
          name: diss.diss_name,
          song_cnt: diss.song_cnt
        }
      })
    })
}

export function getPlaylistSongs(playlistId) {
  return fetch(
    `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&disstid=${playlistId}&utf8=1&format=json`,
    {
      headers: {
        referer: 'https://y.qq.com/'
      }
    }
  )
    .then(res => res.json())
    .then(result => {
      return result.cdlist[0].songlist.map(song => {
        return {
          id: song.songid,
          mid: song.strMediaMid,
          name: song.songname,
          album_id: song.albumid,
          album_mid: song.albummid,
          artists: song.singer.map(singer => {
            return {
              id: singer.id,
              mid: singer.mid,
              name: singer.name
            }
          }),
          size128: song.size128,
          size320: song.size320,
          sizeflac: song.sizeflac
        }
      })
    })
}

export function getAlbumInfo(albumMid) {
  return fetch(
    `https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg?albummid=${albumMid}&format=json`
  )
    .then(res => res.json())
    .then(result => {
      return {
        id: result.data.id,
        mid: result.data.mid,
        name: result.data.name,
        song_cnt: result.data.total_song_num,
        release_date: result.data.aDate,
        language: result.data.lan,
        genre: result.data.genre,
        artist: {
          id: result.data.singerid,
          mid: result.data.singermid,
          name: result.data.singername
        }
      }
    })
}

export function getAudioStream(filename) {
  const guid = Math.floor(Math.random() * 1000000000)

  return fetch(
    `https://c.y.qq.com/base/fcgi-bin/fcg_musicexpress.fcg?guid=${guid}&format=json`
  )
    .then(res => res.json())
    .then(result => {
      const url = `${result.sip[0]}${filename}?vkey=${
        result.key
      }&guid=${guid}&fromtag=60`
      return fetch(url).then(res => res.body)
    })
}

export function getAlbumArtStream(albumId) {
  const id = albumId.toString()
  const sid = id.substr(id.length - 2).replace(/^0+/, '')
  return fetch(
    `https://y.gtimg.cn/music/photo/album_500/${sid}/500_albumpic_${id}_0.jpg`
  ).then(res => res.body)
}
