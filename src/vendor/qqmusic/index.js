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

export function getSongs(id) {
  return fetch(
    `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&disstid=${id}&utf8=1&format=json`,
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
          media_id: song.strMediaMid,
          name: song.songname,
          size128: song.size128,
          size320: song.size320,
          sizeflac: song.sizeflac
        }
      })
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
      console.log(url)
      return fetch(url).then(res => res.body)
    })
}
