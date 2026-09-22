export const hasAvailableSeat = (value) =>
  value === '有' ||
  value === '>20' ||
  (/^\d+$/.test(value) && Number(value) > 0)

export const hasPlentyOfSeats = (value) =>
  value === '有' || value === '>20' || Number(value) > 20

export const isKnownSeat = (value) =>
  value !== undefined && value !== null && value !== '' && value !== '--'
