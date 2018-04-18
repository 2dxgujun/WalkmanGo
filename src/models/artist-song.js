export default function(sequelize, DataTypes) {
  return sequelize.define(
    'ArtistSong',
    {
      artist_id: {
        type: DataTypes.INTEGER
      },
      song_id: {
        type: DataTypes.INTEGER
      }
    },
    {
      tableName: 'tb_artist_song',
      timestamps: true,
      underscored: true,
      charset: 'utf8',
      indexes: [
        {
          name: 'uk_artist_song',
          unique: true,
          fields: ['artist_id', 'song_id']
        }
      ]
    }
  )
}
