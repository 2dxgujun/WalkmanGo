import detection from 'usb-detection'
import drivelist from 'drivelist'

Promise.promisifyAll(drivelist)

var schedulerId

function scheduleFindDrives(device, onAdd) {
  schedulerId = setInterval(() => {
    getWalkmanDrives()
      .then(drives => {
        if (drives && drives.length > 0) {
          device.drives = drives
          unscheduleFindDrives()
          onAdd(null, device)
        }
      })
      .catch(e => {
        onAdd(e)
      })
  }, 3000)
}

function unscheduleFindDrives() {
  if (schedulerId) {
    clearInterval(schedulerId)
  }
}

export default function(onAdd, onRemove) {
  detection
    .find()
    .filter(device => {
      return device.deviceName === 'WALKMAN'
    })
    .then(devices => {
      if (devices && devices.length > 0) {
        return devices[0]
      }
      return null
    })
    .then(device => {
      if (device) {
        scheduleFindDrives(device, onAdd)
      }
    })
    .catch(e => {
      onAdd(e)
    })

  detection.on('add', device => {
    if (device.deviceName === 'WALKMAN') {
      scheduleFindDrives(device, onAdd)
    }
  })

  detection.on('remove', device => {
    if (device.deviceName === 'WALKMAN') {
      unscheduleFindDrives()
      onRemove(null, device)
    }
  })

  detection.startMonitoring()
  process.on('SIGINT', () => {
    // Allow the process to exit
    detection.stopMonitoring()
  })
}

function getWalkmanDrives() {
  return drivelist.listAsync().filter(drive => {
    return drive.description === 'WALKMAN'
  })
}
