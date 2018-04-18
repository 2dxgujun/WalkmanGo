export default function(sequelize, DataTypes) {
  return sequelize.define(
    'Playlist',
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
      songCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'song_cnt',
        defaultValue: 0
      }
    },
    {
      tableName: 'tb_playlist',
      timestamps: true,
      underscored: true,
      charset: 'utf8'
    }
  )
}
