export default function(sequelize, DataTypes) {
  return sequelize.define(
    'Song',
    {
      id: {
        type: DataTypes.INTEGER,
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
      albumId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'album_id'
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
}
