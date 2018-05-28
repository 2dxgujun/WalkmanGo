export default function(sequelize, DataTypes) {
  return sequelize.define(
    'UserAlbum',
    {
      user_id: {
        type: DataTypes.INTEGER
      },
      album_id: {
        type: DataTypes.INTEGER
      }
    },
    {
      tableName: 'tb_user_album',
      timestamps: true,
      underscored: true,
      charset: 'utf8',
      indexes: [
        {
          name: 'uk_user_album',
          unique: true,
          fields: ['user_id', 'album_id']
        }
      ]
    }
  )
}
