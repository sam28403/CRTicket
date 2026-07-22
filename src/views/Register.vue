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
            <h2>用户注册</h2>
            <form id="registerForm" @submit.prevent="handleSubmit">
              <el-form label-position="top" class="profile-form" @submit.prevent>
                <el-form-item label="账号">
                  <el-input v-model="username" placeholder="输入用户名" size="large" clearable />
                </el-form-item>
                <el-form-item label="密码">
                  <el-input v-model="password1" type="password" show-password placeholder="输入密码" size="large" clearable />
                </el-form-item>
                <el-form-item label="确认密码">
                  <el-input v-model="password2" type="password" show-password placeholder="确认密码" size="large" clearable />
                </el-form-item>
                <el-form-item label="验证码">
                  <div class="captcha-group">
                    <el-input-otp v-model="captchaInput" :length="5" size="large"/>
                    <img ref="captchaImage" alt="点击刷新验证码" @click="refreshCaptcha" />
                  </div>
                </el-form-item>
              </el-form>
              <div class="button-group">
                <button type="submit" class="btn btn-login">注册</button>
                <button type="button" class="btn btn-register" @click="goToLogin">返回登录界面</button>
              </div>
            </form>
          </div>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { User } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import {onMounted, ref} from "vue";
import { ElMessage } from 'element-plus';
import api from "@/api.js";

const router = useRouter();
const goToHistory = () => {
  router.push('/history');
};
const goToLogin = () => {
  router.push('/login');
}

const username = ref('');
const password1 = ref('');
const password2 = ref('');
const captchaInput = ref('');
let currentCaptcha = "";

// 通过 ref 获取 captchaImage 元素
const captchaImage = ref(null);

// 生成并显示验证码
function generateCaptcha() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

function drawCaptcha(code) {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 40;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "20px Arial";
  ctx.fillStyle = "#333";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(code, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

function refreshCaptcha() {
  currentCaptcha = generateCaptcha();
  // 通过 ref 更新 src 属性
  if (captchaImage.value) {
    captchaImage.value.src = drawCaptcha(currentCaptcha);
  }
}

function handleSubmit(e) {
  e.preventDefault();
  const inputCode = captchaInput.value.trim().toUpperCase();
  if (inputCode !== currentCaptcha) {
    ElMessage.error("验证码错误，请重新输入！");
    refreshCaptcha();
    return;
  }

  // 验证密码限制：至少8位密码，必须有数字，数字、大写、小写、符号中至少要有两个
  const pwd = password1.value;
  if (pwd.length < 8) {
    ElMessage.error("密码长度至少为8位！");
    return;
  }
  if (!/\d/.test(pwd)) {
    ElMessage.error("密码中必须包含数字！");
    return;
  }
  let types = 0;
  if (/\d/.test(pwd)) types++;
  if (/[A-Z]/.test(pwd)) types++;
  if (/[a-z]/.test(pwd)) types++;
  if (/[^A-Za-z0-9]/.test(pwd)) types++;
  if (types < 2) {
    ElMessage.error("密码在数字、大写字母、小写字母、特殊符号中至少要包含两种！");
    return;
  }

  // 验证密码一致性
  if (password1.value !== password2.value) {
    ElMessage.error("两次密码不一致！");
    return;
  }

  // 发送注册请求
  api.post("/user/register", { username: username.value, password: password1.value })
      .then(response => {
        if (response.data.success) {
          ElMessage.success("注册成功！");
          router.push("/login");
        } else {
          ElMessage.error(response.data.message || "注册失败，请重试");
        }
      })
      .catch(err => {
        console.error(err);
        ElMessage.error("请求失败，请检查网络");
      });
}

onMounted(() => {
  refreshCaptcha();
});
</script>

<style>
@import "../assets/styles/Login.css";
</style>