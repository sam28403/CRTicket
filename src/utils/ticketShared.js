export const DEFAULT_TICKET_MESSAGE = '买票请到12306 发货请到95306\n中国铁路祝您旅途愉快'
export const DEFAULT_TICKET_THEME = 'EMU_Green.jpg'

export function createDefaultTicket() {
  return {
    number: '',
    from: '',
    to: '',
    trainNo: '',
    date: '',
    time: '',
    price: '',
    seatType: '',
    seatNo: '',
    sellPlace: '',
    gate: '',
    message: DEFAULT_TICKET_MESSAGE,
    theme: DEFAULT_TICKET_THEME,
    distance: '',
  }
}

export const ticketRules = {
  trainNo: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          callback(new Error('请输入车次'))
        } else if (!/^(\d{4}|5\d{4}|[GCDZTKLYS]\d{1,4})$/i.test(value)) {
          callback(new Error('请输入正确的车次'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

export const seatOptions = [
  { value: '硬座', label: '硬座' },
  { value: '软座', label: '软座' },
  { value: '硬卧', label: '硬卧' },
  { value: '软卧', label: '软卧' },
  { value: '二等座', label: '二等座' },
  { value: '一等座', label: '一等座' },
  { value: '特等座', label: '特等座' },
  { value: '优选一等座', label: '优选一等座' },
  { value: '商务座', label: '商务座' },
  { value: '无座', label: '无座' },
  { value: '二等卧', label: '二等卧' },
  { value: '一等卧', label: '一等卧' },
  { value: '一等软座', label: '一等软座' },
  { value: '二等软座', label: '二等软座' },
  { value: '包厢硬卧', label: '包厢硬卧' },
  { value: '高级软卧', label: '高级软卧' },
  { value: '高级动卧', label: '高级动卧' },
  { value: '混编硬座', label: '混编硬座' },
  { value: '混编硬卧', label: '混编硬卧' },
  { value: '特等软座', label: '特等软座' },
  { value: '动卧', label: '动卧' },
  { value: '一人软包', label: '一人软包' },
  { value: '混编软座', label: '混编软座' },
  { value: '混编软卧', label: '混编软卧' },
  { value: '多功能座', label: '多功能座' },
  { value: '二等包座', label: '二等包座' },
  { value: '硬卧代硬座', label: '硬卧代硬座' },
  { value: '软卧代软座', label: '软卧代软座' },
  { value: '卧代二等座', label: '卧代二等座' },
  { value: '棚车', label: '棚车' },
]

export const disableAirSeats = [
  '二等座',
  '一等座',
  '特等座',
  '优选一等座',
  '商务座',
  '无座',
  '多功能座',
  '动卧',
  '高级动卧',
  '一等卧',
  '二等卧',
  '卧代二等座',
  '混编硬座',
  '混编软座',
  '混编硬卧',
  '混编软卧',
  '棚车',
]

export const themeOptions = [
  { id: 'Red.jpg', label: '经典红' },
  { id: 'Blue.jpg', label: '经典蓝', disabled: true },
  { id: 'EMU_Green.jpg', label: '动集绿' },
  { id: 'CIT_Yellow.jpg', label: '动检黄' },
  { id: 'Harmony_White.jpg', label: '和谐白' },
  { id: 'Blue_Sister.jpg', label: '蓝妹妹' },
  { id: 'CR400BF.jpg', label: '金凤凰' },
  { id: 'Sanya_1.jpg', label: '三亚1' },
  { id: 'Sanya_2.jpg', label: '三亚2' },
  { id: 'DF11G.jpg', label: '猪' },
  { id: 'DF11.jpg', label: '狮子' },
  { id: 'FXN5C.jpg', label: '复兴号机车' },
  { id: 'Blank.jpg', label: '空白底' },
]

export function hasRequiredTicketFields(ticket) {
  return Boolean(
    ticket.number &&
    ticket.date &&
    ticket.from &&
    ticket.to &&
    ticket.price &&
    ticket.seatNo &&
    ticket.seatType &&
    ticket.time &&
    ticket.trainNo
  )
}

export function buildTicketPayload(ticket, options = {}) {
  const {
    userId,
    useCredit = false,
    finalSeatType = ticket.seatType,
    hasConditioner = false,
    distance = 0,
  } = options

  return {
    user_id: userId,
    ticket_number: ticket.number,
    train_no: ticket.trainNo,
    departure_station: ticket.from,
    arrival_station: ticket.to,
    travel_date: ticket.date,
    departure_time: ticket.time,
    price: ticket.price,
    use_credit: useCredit ? 1 : 0,
    seat_type: finalSeatType,
    has_conditioner: hasConditioner ? 1 : 0,
    seat_no: ticket.seatNo,
    sell_place: ticket.sellPlace,
    gate_info: ticket.gate,
    message: ticket.message,
    theme: ticket.theme,
    distance: Number(distance) || 0,
  }
}
