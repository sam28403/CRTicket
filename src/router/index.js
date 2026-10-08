import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import MainView from '../views/MainView.vue'
import HistoryView from '../views/HistoryView.vue'
import Login from "@/views/Login.vue";
import Register from "@/views/Register.vue";
import Debug from "@/views/Debug.vue";
import User from "@/views/User.vue";
import { isGithubPagesBuild } from '@/config/deploy.js'
import api from '@/api.js'
import { useUserStore } from '@/stores/user.js'
import { ElMessage } from 'element-plus'


const routes = [
    {
        path: '/train',
        component: () => import('@/views/TrainQuery.vue')
    },
    {
        path: '/monitor',
        component: () => import('@/views/Monitor.vue')
    },
    {
        path: '/',
        component: MainView
    },
    {
        path: '/history',
        component: HistoryView,
        meta: {
            requiresAuth: true,
        }
    },
    {
        path: '/login',
        component: Login
    },
    {
        path: '/register',
        component: Register
    },
    {
        path: '/debug',
        component: Debug
    },
    {
        path: '/user',
        component: User,
        meta: {
            requiresAuth: true,
        }
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

const loginRedirect = (route) => ({
    path: '/login',
    query: { redirect: route.fullPath },
})

// 页面打开后会话也可能过期，统一处理受保护接口返回的 401。
api.interceptors.response.use(response => response, error => {
    if (error.response?.status === 401) {
        useUserStore().setLogin(false)
        const currentRoute = router.currentRoute.value
        if (currentRoute.meta.requiresAuth && error.config?.url !== '/user/session') {
            router.replace(loginRedirect(currentRoute))
        }
    }
    return Promise.reject(error)
})

router.beforeEach(async (to) => {
    if (isGithubPagesBuild && to.path !== '/') {
        return { path: '/' }
    }

    if (!to.meta.requiresAuth) {
        return true
    }

    try {
        if (!await useUserStore().checkSession()) return loginRedirect(to)
    } catch (error) {
        ElMessage.error('无法验证登录状态，请检查服务器或网络后重试')
        return false
    }

    return true
})

export default router
