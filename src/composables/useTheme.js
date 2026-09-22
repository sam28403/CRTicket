import { computed, ref, watch } from 'vue'

const key = 'crticket-theme'
export const themeOptions = [
  { value: 'classic-system', label: '经典跟随系统' },
  { value: 'classic-light', label: '经典亮色' },
  { value: 'classic-dark', label: '经典暗色' },
  { value: 'contrast-system', label: '高对比度跟随系统' },
  { value: 'contrast-light', label: '高对比度亮色' },
  { value: 'contrast-dark', label: '高对比度暗色' },
]
const normalize = value => {
  // Preserve explicit choices made with the previous high-contrast theme.
  if (['system', 'light', 'dark'].includes(value)) return `contrast-${value}`
  return themeOptions.some(option => option.value === value) ? value : 'classic-system'
}
const preference = ref('classic-system')
const systemDark = ref(false)
const isDark = computed(() => preference.value.endsWith('-dark') || (preference.value.endsWith('-system') && systemDark.value))
const highContrast = computed(() => preference.value.startsWith('contrast-'))
const resolvedTheme = computed(() => `${highContrast.value ? 'contrast' : 'classic'}-${isDark.value ? 'dark' : 'light'}`)
let initialized = false

export function initializeTheme() {
  if (initialized) return
  initialized = true
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  systemDark.value = media.matches
  try {
    const saved = localStorage.getItem(key)
    preference.value = normalize(saved)
  } catch { /* 受限存储时仍可在当前页面切换主题。 */ }
  media.addEventListener('change', event => { systemDark.value = event.matches })
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) preference.value = normalize(event.newValue)
  })
  watch(preference, value => {
    try { localStorage.setItem(key, value) } catch { /* 存储不可用时保留内存设置。 */ }
  }, { flush: 'sync' })
  watch(resolvedTheme, () => {
    const dark = isDark.value
    document.documentElement.classList.toggle('high-contrast', highContrast.value)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, { immediate: true, flush: 'sync' })
}

export function useTheme() {
  return { preference, isDark, highContrast, resolvedTheme }
}
