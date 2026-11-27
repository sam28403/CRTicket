import { displayTrainCode } from './trainDisplay.js'

export function splitTrainRecord(record) {
  if (typeof record !== 'string' || record.length > 40
    || !/^[A-Z]?\d{1,5}[A-Z]?(?:\/[A-Z]?\d{1,5}[A-Z]?)*$/.test(record)) return []
  const prefix = record.match(/^[A-Z]/)?.[0] || ''
  return record.split('/').map(code => /^\d/.test(code) ? prefix + code : code)
}

export function matchingTrainRecord(train, record) {
  const codes = splitTrainRecord(record)
  return codes.some(code => displayTrainCode(code) === train) ? record : ''
}
