# Walkman Go (beta)

> A CLI for sync playlists to Sony Walkman deivce

## Features

* Download Hi-Fi music, payment required music, unavailable music
* Sync online playlists to local disk every five minutes
* Add High-Resolution album artwork
* Plug in your Walkman to sync playlists

## Install

```
$ npm i -g walkman-go
```

## Usage

Firstly, install as a global package.

Create a work directory, for example `~/WalkmanGo`, put **walkman-go.ini** into the directory.

```ini
# walkman-go.ini
[general]
workdir = ~/WalkmanGo
# Available bitrate: flac,320,128
bitrate = flac

[personal]
# Your QQ number
uin = 414236069
playlists[] = Playlist1
playlists[] = Playlist2
```

Start WalkmanGo:
```
$ walkman-go
```
