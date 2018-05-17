# Walkman Go

> 论如何优雅的将QQ音乐的歌单导出到Sony Walkman设备

在Walkman Go诞生之前，如果你想要导出一个歌单到Walkman设备上，首先你要有一台Windows PC，然后把整个歌单下载下来，用foobar2000处理（修改标签信息，添加专辑封面），最后使用Media Go把整个歌单导出（Media Go每次导入都是把整个歌单全部写一遍，并且不会帮你删除歌单里面已经不存在的单曲，不能忍）。

有了Walkman Go，你只需要**把Walkman设备插入USB**，其他统统都不用管。

## Features

* 免费下载无损歌曲、付费歌曲、无版权不能播放的歌曲
* 支持缓存多种bitrate的歌曲（128, 320, flac）
* 歌曲添加高清专辑封面（QQ音乐在Mac上添加的是图标而不是封面，Walkman是不识别的）
* 修复编码问题导致部分歌名和歌手名在Walkman设备上出现乱码
* 移除歌单歌曲的专辑名（避免杂乱的单曲把Walkman上的专辑列表搞得一团糟）
* 只需要把Walkman设备插入USB就会自动开始同步歌单

## Install

```
$ npm i -g walkman-go
```

## Usage

首先，使用上面的命令安装（安装很慢请耐心等待）

然后，创建一个工作目录，例如`~/Music/WalkmanGo`，把**walkman-go.ini**文件放在这个目录里面。

```ini
# walkman-go.ini
[general]
workdir = ~/Music/WalkmanGo
# 比特率，可选：flac,320,128
bitrate = flac

[personal]
# 你的QQ号
uin = 123456789
playlists[] = Playlist1
playlists[] = Playlist2
```

启动Walkman Go:

```
$ walkman-go
```

## Requirements

* UNIX or UNIX-like system
* Node.js
* libFLAC (v1.2+) [FLAC Homepage](https://xiph.org/flac/index.html)

## Tested On

* NW-A35
