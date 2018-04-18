export default function(sequelize, DataTypes) {
  return sequelize.define(
    'Album',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: false,
        field: 'id'
      },
      mid: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'mid'
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'name'
      },
      songCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'song_cnt'
      },
      releaseDate: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'release_date'
      },
      language: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'language'
      },
      genre: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'genre'
      }
    },
    {
      tableName: 'tb_album',
      timestamps: true,
      underscored: true,
      charset: 'utf8'
    }
  )
}
