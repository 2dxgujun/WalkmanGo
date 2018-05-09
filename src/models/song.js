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
