export default function(sequelize, DataTypes) {
  return sequelize.define(
    'User',
    {
      uin: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'uin'
      }
    },
    {
      tableName: 'tb_user',
      timestamps: true,
      underscored: true,
      charset: 'utf8',
      indexes: [
        {
          name: 'uk_uin',
          unique: true,
          fields: ['uin']
        }
      ]
    }
  )
}
