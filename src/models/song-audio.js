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
      isOptimized: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'optimized'
      },
      hasArtwork: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'has_artwork'
      }
    },
    {
      tableName: 'tb_song_audio',
      timestamps: true,
      underscored: true,
      charset: 'utf8',
      indexes: [
        {
          unique: true,
          fields: ['audio_id']
        }
      ]
    }
  )
}
