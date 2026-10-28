import { displayTrainCode } from './trainDisplay.js'
import { isTrainQueryDateInRange, trainQueryRange } from './trainQueryDate.js'

export function trainQueryCode(train) {
  return displayTrainCode(train).split('/')[0].trim().toUpperCase()
}

export function trainQuerySourceLocation({ train, date, offline, offlineRecord = '' }) {
  const entered = trainQueryCode(train)
  const recordedTrain = displayTrainCode(offlineRecord)
  const matchesRecord = offlineRecord && !offlineRecord.includes('/')
    && entered === recordedTrain
  const code = offline
    ? matchesRecord ? offlineRecord : entered
    : entered

  return {
    path: '/train',
    query: {
      train: code || undefined,
      date: !offline && !isTrainQueryDateInRange(date) ? trainQueryRange().today : date,
      source: offline ? 'llt' : undefined,
    },
  }
}
