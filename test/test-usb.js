var usbDetect = require('usb-detection')
var drivelist = require('drivelist')

usbDetect.startMonitoring()

usbDetect.find(function(err, devices) {
  console.log('find', devices, err)
})

drivelist.list((error, drives) => {
  if (error) {
    throw error
  }

  drives.forEach(drive => {
   console.log(drive)
  })
})
