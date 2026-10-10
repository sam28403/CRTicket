import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api.js'
import { buildTicketPayload } from '@/utils/ticketShared.js'
import { buildDebugTicket, randomChoice } from '@/utils/debugTickets.js'
import { trainQueryRange, isTrainQueryDateInRange } from '@/utils/trainQueryDate.js'

export function useDebugGeneration(currentUser) {
  const generationCount = ref(1)
  const departureDate = ref(trainQueryRange().today)
  const isGenerating = ref(false)
  const generatedTickets = ref([])
  const progress = ref('')
  const dataNotice = ref('')

  function disabledDate(value) {
    const date = [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')].join('-')
    return !isTrainQueryDateInRange(date) || date >= trainQueryRange().max
  }

  async function handleGenerate() {
    if (isGenerating.value) return
    const count = Number(generationCount.value)
    if (!Number.isInteger(count) || count < 1 || count > 1000) {
      ElMessage.warning('请输入 1 至 1000 之间的整数数量')
      return
    }
    const user = currentUser.value
    if (!user?.id) {
      ElMessage.warning('请先登录后再生成车票')
      return
    }
    const date = departureDate.value
    if (!isTrainQueryDateInRange(date) || date >= trainQueryRange().max) {
      ElMessage.warning('请选择今天前 2 天至后 14 天内的始发日期')
      return
    }
    isGenerating.value = true
    generatedTickets.value = []
    dataNotice.value = ''
    try {
      const pool = []
      const target = Math.min(count, 5)
      let skipped = 0
      let lastReason = ''
      for (let attempt = 0; attempt < target * 3 && pool.length < target; attempt++) {
        progress.value = `正在核验真实车次、区间和票价：${pool.length}/${target}，第 ${attempt + 1} 次查询`
        let data
        try {
          const response = await api.get('/ticket-samples', {
            params: { date },
            timeout: 90000,
          })
          data = response.data
        } catch (error) {
          if (error.response?.status !== 502) throw error
          skipped++
          lastReason = error.response.data?.message || '该车次查询失败'
          continue
        }
        if (!data.success) throw new Error(data.message || '真实车票查询失败')
        if (data.sample) pool.push(data.sample)
        else {
          skipped++
          lastReason = data.reason || '信息不完整'
        }
      }
      if (!pool.length) throw new Error(`没有查到完整的真实车票。${lastReason}`)
      const versions = [...new Set(pool.map(sample => sample.mileageVersion))].join('、')
      dataNotice.value = `已核验 ${pool.length} 个车次区间，里程来源：路路通 ${versions}。`
        + (skipped ? `跳过 ${skipped} 个不完整结果。` : '')
        + (count > pool.length ? '本批车票随机复用这些区间及对应的真实报价。' : '')
      generatedTickets.value = Array.from({ length: count }, (_, index) => ({
        index: index + 1,
        ...buildDebugTicket(pool[index] || randomChoice(pool)),
        saveStatus: '待保存',
        saveMessage: '',
      }))
      progress.value = `正在保存 ${count} 张车票`
      const tickets = generatedTickets.value.map(ticket => buildTicketPayload(ticket, {
        userId: user.id,
        finalSeatType: ticket.finalSeatType,
        distance: ticket.distance,
      }))
      const { data } = await api.post('/ticket/add-batch', { tickets }, { timeout: 30000 })
      if (!data.success) throw new Error(data.message || '批量保存失败')
      generatedTickets.value.forEach(ticket => {
        ticket.saveStatus = '成功'
        ticket.saveMessage = '保存成功'
      })
      ElMessage.success(`已生成并保存 ${count} 张车票`)
    } catch (error) {
      const message = error.response?.data?.message || error.message || '生成失败，请检查后端服务'
      generatedTickets.value.forEach(ticket => {
        ticket.saveStatus = error.response ? '失败' : '待确认'
        ticket.saveMessage = message
      })
      ElMessage.error(message)
      dataNotice.value = message
    } finally {
      progress.value = ''
      isGenerating.value = false
    }
  }

  return {
    generationCount, departureDate, isGenerating, generatedTickets,
    progress, dataNotice, disabledDate, handleGenerate,
  }
}
