export default function(sequelize, DataTypes) {
  return sequelize.define(
    'PlaylistSong',
    {
      playlist_id: {
        type: DataTypes.INTEGER
      },
      song_id: {
        type: DataTypes.INTEGER
      }
    },
    {
      tableName: 'tb_playlist_song',
      timestamps: true,
      underscored: true,
      charset: 'utf8',
      indexes: [
        {
          name: 'uk_playlist_song',
          unique: true,
          fields: ['playlist_id', 'song_id']
        }
      ]
    }
  )
}
