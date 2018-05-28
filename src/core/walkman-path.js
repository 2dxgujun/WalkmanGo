import path from 'path'

export function getWalkmanMusicPath(mountpoint) {
  return Promise.resolve(path.resolve(mountpoint.path, 'MUSIC'))
}

export function getWalkmanPlaylistsPath(mountpoint) {
  return getWalkmanMusicPath(mountpoint).then(musicPath => {
    return path.resolve(musicPath, 'PLAYLISTS')
  })
}

export function getWalkmanPlaylistPath(mountpoint, playlist) {
  return getWalkmanPlaylistsPath(mountpoint).then(playlistsPath => {
    return path.resolve(playlistsPath, playlist.name)
  })
}

export function getWalkmanPlaylistURLPath(mountpoint, playlist) {
  return getWalkmanMusicPath(mountpoint).then(musicPath => {
    return path.resolve(musicPath, `${playlist.name}.m3u`)
  })
}

export function getWalkmanPlaylistAudioPath(mountpoint, playlist, audio) {
  return getWalkmanPlaylistPath(mountpoint, playlist).then(playlistPath => {
    return path.resolve(playlistPath, path.basename(audio.path))
  })
}

export function getWalkmanAlbumPath(mountpoint, album) {
  return getWalkmanMusicPath(mountpoint).then(musicPath => {
    return path.resolve(musicPath, `${album.artist} - ${album.name}`)
  })
}

export function getWalkmanAlbumAudioPath(mountpoint, album, audio) {
  return getWalkmanAlbumPath(mountpoint, album).then(albumPath => {
    return path.resolve(albumPath, path.basename(audio.path))
  })
}
