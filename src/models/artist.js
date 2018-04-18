export default function(sequelize, DataTypes) {
  return sequelize.define(
    'Artist',
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
      }
    },
    {
      tableName: 'tb_artist',
      timestamps: true,
      underscored: true,
      charset: 'utf8'
    }
  )
}
