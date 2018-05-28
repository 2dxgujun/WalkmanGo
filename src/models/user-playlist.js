export default function(sequelize, DataTypes) {
  return sequelize.define(
    'UserPlaylist',
    {
      user_id: {
        type: DataTypes.INTEGER
      },
      playlist_id: {
        type: DataTypes.INTEGER
      }
    },
    {
      tableName: 'tb_user_playlist',
      timestamps: true,
      underscored: true,
      charset: 'utf8',
      indexes: [
        {
          name: 'uk_user_playlist',
          unique: true,
          fields: ['user_id', 'playlist_id']
        }
      ]
    }
  )
}
