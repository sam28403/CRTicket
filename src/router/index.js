import { createRouter, createWebHistory } from 'vue-router'
import MainView from '../views/MainView.vue'
import HistoryView from '../views/HistoryView.vue'
import Login from "@/views/Login.vue";
import Register from "@/views/Register.vue";
import Debug from "@/views/Debug.vue";
import User from "@/views/User.vue";


const routes = [
    {
        path: '/',
        component: MainView
    },
    {
        path: '/history',
        component: HistoryView
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
    history: createWebHistory(),
    routes
})

router.beforeEach((to) => {
    if (!to.meta.requiresAuth) {
        return true
    }

    const isLogin = localStorage.getItem('login') === 'true'
    if (!isLogin) {
        return {
            path: '/login',
            query: {
                redirect: to.fullPath,
            },
        }
    }

    return true
})

export default router
