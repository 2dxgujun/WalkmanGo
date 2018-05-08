import detection from 'usb-detection'
import { transfer, cancel as cancelTransfer } from './transfer'
import {
  schedule as scheduleSync,
  unschedule as unscheduleSync
} from './schedule-sync'

export default function() {
  detect(
    (err, device) => {
      return unscheduleSync().then(transfer).then(scheduleSync)
    },
    (err, device) => {
      return cancelTransfer().then(scheduleSync)
    }
  )
}

function detect(onDetect, onRemove) {
  detection
    .find()
    .filter(device => {
      return device.deviceName.includes('WALKMAN')
    })
    .then(devices => {
      if (devices && devices.length > 0) {
        onDetect(null, devices[0])
      }
    })
    .catch(e => {
      onDetect(e)
    })

  detection.on('add', device => {
    if (device.deviceName.includes('WALKMAN')) {
      onDetect(null, device)
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
