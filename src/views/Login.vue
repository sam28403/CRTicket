<template>
  <div>
    <el-container style="height: 100vh">
      <el-header class="top-header">
        <el-avatar src="Picture1.png" />
        <h2>Sam-Lab CR Ticket Maker</h2>
        <el-button class="user-top-right" @click="goToHistory()">
          <el-icon><User /></el-icon>历史记录
        </el-button>
      </el-header>
      <el-main>
        <div class="login-section">
          <!-- 登录框 -->
          <div class="login-container">
            <h2>用户登录</h2>
            <form @submit.prevent="handleSubmit">
              <div class="input-group">
                <label for="username">账号</label>
                <input type="text" v-model="username" required />
              </div>
              <div class="input-group">
                <label for="password">密码</label>
                <input type="password" v-model="password" required />
              </div>
              <div class="input-group">
                <label for="captchaInput">验证码</label>
                <div class="captcha-group">
                  <input type="text" v-model="captchaInput" required />
                  <img ref="captchaImage" alt="点击刷新验证码" @click="refreshCaptcha" />
                </div>
              </div>
              <div class="button-group">
                <button type="submit" class="btn btn-login">登录</button>
                <button type="button" class="btn btn-register" @click="goToRegister">没有账号？去注册</button>
              </div>
            </form>
          </div>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from "vue-router";
import {ref, onMounted, computed} from "vue";
import { ElMessage } from "element-plus";
import api from "@/api.js";
import {useUserStore} from "@/stores/user.js";
import {User} from "@element-plus/icons-vue";
import { drawCaptcha, generateCaptcha } from "@/utils/captcha.js";

const router = useRouter();
const route = useRoute();
const username = ref('');
const password = ref('');
const captchaInput = ref('');
let currentCaptcha = "";

const goToHistory = () => {
  router.push("/history")
}

const userStore = useUserStore()
const loginValue = computed({
  get: () => userStore.isLogin,
  set: (val) => userStore.setLogin(val)
})

// 获取验证码图片
const captchaImage = ref(null);

function refreshCaptcha() {
  currentCaptcha = generateCaptcha();
  if (captchaImage.value) {
    captchaImage.value.src = drawCaptcha(currentCaptcha);
  }
}

function handleSubmit() {
  // 验证验证码
  const inputCode = captchaInput.value.trim().toUpperCase();
  if (inputCode !== currentCaptcha) {
    ElMessage.error("验证码错误，请重新输入！");
    refreshCaptcha();
    return;
  }

  // 验证用户名和密码
  if (!username.value || !password.value) {
    ElMessage.error("请输入用户名和密码！");
    return;
  }

  // 向后端发送登录请求
  api.post("/user/login", { username: username.value, password: password.value })
      .then(response => {
        if (response.data.success) {
          localStorage.setItem(
              "user",
              JSON.stringify(response.data.user)
          );

          ElMessage.success("登录成功！");
          const redirect = typeof route.query.redirect === "string" && route.query.redirect
            ? route.query.redirect
            : "/history"
          router.push(redirect); // 跳转到原目标页面或历史记录页面
          loginValue.value = true;
        } else {
          ElMessage.error(response.data.message || "登录失败，请重试");
        }
      })
      .catch(err => {
        console.error(err);
        ElMessage.error("请求失败，请检查网络");
      });
}

// 跳转到注册页面
function goToRegister() {
  router.push("/register");
}

// 初始化验证码
onMounted(() => {
  refreshCaptcha();
});
</script>

<style scoped>
@import "../assets/styles/Login.css";
</style>
