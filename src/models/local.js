export default function(sequelize, DataTypes) {
  return sequelize.define(
    'Local',
    {
      path: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'path'
      },
      mimeType: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'mime_type'
      }
    },
    {
      tableName: 'tb_local',
      timestamps: true,
      underscored: true,
      charset: 'utf8'
    }
  )
}
