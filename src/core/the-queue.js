import Queue from 'promise-queue'

const queue = new Queue(1 /*max concurrent*/, Infinity)

export default queue
