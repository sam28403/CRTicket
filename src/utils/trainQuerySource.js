import { displayTrainCode } from './trainDisplay.js'
import { isTrainQueryDateInRange, trainQueryRange } from './trainQueryDate.js'
import { matchingTrainRecord } from './trainQueryRecord.js'

export function trainQueryCode(train) {
  return displayTrainCode(train).split('/')[0].trim().toUpperCase()
}

export function trainQuerySourceLocation({ train, date, offline, offlineRecord = '', record }) {
  const entered = trainQueryCode(train)
  const selectedRecord = matchingTrainRecord(entered, record)
  const recordedTrain = displayTrainCode(offlineRecord)
  const matchesRecord = offlineRecord && !offlineRecord.includes('/')
    && entered === recordedTrain
  const code = offline && !selectedRecord
    ? matchesRecord ? offlineRecord : entered
    : entered

  return {
    path: '/train',
    query: {
      train: code || undefined,
      date: !offline && !isTrainQueryDateInRange(date) ? trainQueryRange().today : date,
      source: offline ? 'llt' : undefined,
      ...(selectedRecord && selectedRecord !== code ? { record: selectedRecord } : {}),
    },
  }
}
