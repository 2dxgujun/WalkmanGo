import Sequelize from 'sequelize'

export default function(sequelize, DataTypes) {
  return sequelize.define(
    'SongAudio',
    {
      song_id: {
        type: DataTypes.INTEGER
      },
      audio_id: {
        type: DataTypes.INTEGER
      },
      bitrate: {
        type: Sequelize.ENUM('128', '320', 'flac'),
        allowNull: false,
        field: 'bitrate'
      },
      optimized: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'optimized'
      }
    },
    {
      tableName: 'tb_song_audio',
      timestamps: true,
      underscored: true,
      charset: 'utf8',
      indexes: [
        {
          name: 'uk_song_audio_bitrate',
          unique: true,
          fields: ['song_id', 'audio_id', 'bitrate']
        }
      ]
    }
  )
}
