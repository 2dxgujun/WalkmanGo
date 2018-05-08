import detection from 'usb-detection'

export default function(onAdd, onRemove) {
  detection
    .find()
    .filter(device => {
      return device.deviceName.includes('WALKMAN')
    })
    .then(devices => {
      if (devices && devices.length > 0) {
        return devices[0]
      }
      return null
    })
    .then(device => {
      if (device) {
        onAdd(null, device)
      }
    })
    .catch(e => {
      onAdd(e)
    })

  detection.on('add', device => {
    if (device.deviceName.includes('WALKMAN')) {
      onAdd(null, device)
    }
  })

  detection.on('remove', device => {
    if (device.deviceName.includes('WALKMAN')) {
      onRemove(null, device)
    }
  })

  detection.startMonitoring()
  process.on('SIGINT', () => {
    // Allow the process to exit
    detection.stopMonitoring()
    process.exit(0)
  })
}
