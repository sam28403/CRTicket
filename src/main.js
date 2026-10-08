import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './assets/styles/theme.css'
import { initializeTheme } from './composables/useTheme'

initializeTheme()
import './assets/styles/fonts.css'
import App from './App.vue'
import router from './router'
import {createPinia} from "pinia";

createApp(App).use(createPinia()).use(router).use(ElementPlus).mount('#app')
