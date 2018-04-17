export default function(sequelize, DataTypes) {
  const Song = sequelize.define(
    'Song',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: false,
        field: 'id'
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'name'
      },
      mediaId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'media_id'
      },
      size128: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'size_128'
      },
      size320: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'size_320'
      },
      sizeflac: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'size_flac'
      }
    },
    {
      tableName: 'tb_song',
      timestamps: true,
      underscored: true,
      charset: 'utf8'
    }
  )
  return Song
}
