// 字段顺序同时用于备份比较和数据库写入，请与 tickets 表保持一致。
export const TICKET_FIELDS = [
  'ticket_number',
  'train_no',
  'departure_station',
  'arrival_station',
  'travel_date',
  'departure_time',
  'price',
  'use_credit',
  'seat_type',
  'has_conditioner',
  'seat_no',
  'sell_place',
  'gate_info',
  'message',
  'theme',
  'distance',
]

export function ticketFieldValues(ticket) {
  return TICKET_FIELDS.map(field => ticket[field])
}

export function comparableTicketValues(ticket) {
  return ticketFieldValues(ticket).map(value => value == null ? '' : String(value))
}
