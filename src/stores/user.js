import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api.js'

export const useUserStore = defineStore('user', () => {
    const isLogin = ref(false)
    let authVersion = 0

    const setLogin = (val) => {
        authVersion++
        isLogin.value = val
        localStorage.setItem('login', val ? 'true' : 'false')
        if (!val) {
            localStorage.removeItem('user')
        }
    }

    const init = () => {
        isLogin.value = localStorage.getItem('login') === 'true'
    }

    const checkSession = async () => {
        // 只有主动登录过的浏览器才恢复会话；登出后保留 false 标记。
        if (localStorage.getItem('login') !== 'true') {
            setLogin(false)
            return false
        }
        const version = authVersion
        const isCurrent = () => version === authVersion && localStorage.getItem('login') === 'true'
        try {
            const response = await api.get('/user/session')
            // 登出或重新登录后，丢弃先前发出的校验结果。
            if (!isCurrent()) return false
            if (!response.data.success || !response.data.user?.id) {
                setLogin(false)
                return false
            }
            localStorage.setItem('user', JSON.stringify(response.data.user))
            isLogin.value = true
            return true
        } catch (error) {
            if (!isCurrent()) return false
            if (error.response?.status !== 401) throw error
            setLogin(false)
            return false
        }
    }

    const logout = async () => {
        setLogin(false)
        const response = await api.post('/user/logout', {})
        if (!response.data.success) throw new Error(response.data.message || '服务器注销失败')
    }

    return { isLogin, setLogin, init, checkSession, logout }
})
