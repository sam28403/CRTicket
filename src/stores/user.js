import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
    const isLogin = ref(false)

    const setLogin = (val) => {
        isLogin.value = val
        localStorage.setItem('login', val ? 'true' : 'false')
        if (!val) {
            localStorage.removeItem('user')
        }
    }

    const init = () => {
        isLogin.value = localStorage.getItem('login') === 'true'
    }

    return { isLogin, setLogin, init }
})
