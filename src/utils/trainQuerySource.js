import { displayTrainCode } from './trainDisplay.js'
import { isTrainQueryDateInRange, trainQueryRange } from './trainQueryDate.js'

export function trainQuerySourceLocation({ train, date, offline, offlineRecord = '' }) {
  const entered = train.trim().toUpperCase()
  const recordedTrain = displayTrainCode(offlineRecord)
  const matchesRecord = offlineRecord && (
    entered === recordedTrain || entered === recordedTrain.split('/')[0]
  )
  const code = offline
    ? matchesRecord ? offlineRecord : entered
    : displayTrainCode(entered).split('/')[0]

  return {
    path: '/train',
    query: {
      train: code || undefined,
      date: !offline && !isTrainQueryDateInRange(date) ? trainQueryRange().today : date,
      source: offline ? 'llt' : undefined,
    },
  }
}
