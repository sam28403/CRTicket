import { ref, watch } from 'vue'
import QRCode from 'qrcode'
import { ticketQRCodeOptions } from '@/utils/ticketShared.js'

export function useTicketQRCode(number) {
  const url = ref('')
  watch(number, value => {
    url.value = ''
    if (!value) return
    QRCode.toDataURL(value, ticketQRCodeOptions(), (error, result) => {
      if (!error && number() === value) url.value = result
    })
  }, { immediate: true })
  return url
}
