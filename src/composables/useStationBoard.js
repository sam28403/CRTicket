import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import api, { timetableTimeout } from '@/api.js'
import { stationQueryName } from '@/utils/stationName.js'
import { stationClock } from '@/utils/stationBoard.js'
import { stationLocation } from '@/utils/stationNavigation.js'

export function useStationBoard() {
  const route = useRoute()
  const router = useRouter()
  const station = ref('')
  const now = ref(Date.now())
  const clock = computed(() => stationClock(now.value))
  const loading = ref(false)
  const result = shallowRef(null)
  const error = ref('')
  let controller
  let requestId = 0
  const timer = setInterval(() => { now.value = Date.now() }, 1000)

  async function query(name = station.value) {
    const selected = stationQueryName(name)
    if (!selected) {
      ElMessage.warning('请输入车站名称（不超过 30 个字）')
      return
    }
    if (route.query.station !== selected) {
      await router.replace(stationLocation(selected))
      return
    }
    controller?.abort()
    controller = new AbortController()
    const id = ++requestId
    now.value = Date.now()
    const date = clock.value.date
    station.value = selected
    loading.value = true
    result.value = null
    error.value = ''
    try {
      const { data } = await api.get('/station', {
        params: { station: selected, date },
        timeout: timetableTimeout,
        signal: controller.signal,
      })
      if (!data.success) throw new Error(data.message || '查询失败')
      if (id !== requestId) return
      // 防止挂起标签页或长请求在午夜后仍展示昨天的数据。
      now.value = Date.now()
      if (data.date !== clock.value.date) {
        query(selected)
        return
      }
      if (!data.trains?.length) {
        ElMessage.warning('未查询到该车站当天的车次，请确认站名是否正确')
        return
      }
      result.value = data
    } catch (err) {
      if (id === requestId && err.code !== 'ERR_CANCELED') {
        error.value = err.response?.data?.message || (
          err.code === 'ECONNABORTED'
            ? '查询超时，请稍后重试'
            : err.message === '查询失败'
              ? err.message
              : '查询失败，请确认后端服务已启动后重试'
        )
      }
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  watch(() => route.query.station, name => {
    controller?.abort()
    requestId++
    loading.value = false
    result.value = null
    error.value = ''
    station.value = typeof name === 'string' ? stationLocation(name).query.station : ''
    if (station.value) query()
  }, { immediate: true })

  watch(() => clock.value.date, () => {
    const selected = result.value?.station || station.value
    result.value = null
    controller?.abort()
    requestId++
    loading.value = false
    if (stationQueryName(selected)) query(selected)
  })

  onBeforeUnmount(() => {
    clearInterval(timer)
    requestId++
    controller?.abort()
  })

  return { station, clock, loading, result, error, query }
}
