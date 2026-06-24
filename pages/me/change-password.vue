<template>
  <view class="cp-container">
    <view class="cp-form">
      <view class="cp-row">
        <text class="cp-label">原密码</text>
        <input class="cp-input" type="text" password v-model="form.oldPassword" placeholder="请输入原密码" />
      </view>
      <view class="cp-row">
        <text class="cp-label">新密码</text>
        <input class="cp-input" type="text" password v-model="form.newPassword" placeholder="8-32位，建议含大小写与数字" />
      </view>
      <view class="cp-row">
        <text class="cp-label">确认密码</text>
        <input class="cp-input" type="text" password v-model="form.confirm" placeholder="再次输入新密码" />
      </view>
    </view>

    <view class="cp-tip">
      <text>· 密码长度 8-32 位</text>
      <text>· 建议同时包含大小写字母和数字</text>
      <text>· 不得与原密码相同</text>
    </view>

    <view class="cp-submit" :class="{ disabled: submitting }" @click="onSubmit">
      <text>{{ submitting ? '提交中...' : '确认修改' }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue";
import * as http from "../../utils/request.js";
import apiCfg from "../../config/api.js";

const form = ref({ oldPassword: "", newPassword: "", confirm: "" });
const submitting = ref(false);

function validate() {
  if (!form.value.oldPassword) { uni.showToast({ title: "请输入原密码", icon: "none" }); return false; }
  if (!form.value.newPassword) { uni.showToast({ title: "请输入新密码", icon: "none" }); return false; }
  if (form.value.newPassword.length < 8 || form.value.newPassword.length > 32) {
    uni.showToast({ title: "密码长度需 8-32 位", icon: "none" }); return false;
  }
  if (form.value.newPassword === form.value.oldPassword) {
    uni.showToast({ title: "新旧密码不能相同", icon: "none" }); return false;
  }
  if (form.value.newPassword !== form.value.confirm) {
    uni.showToast({ title: "两次输入不一致", icon: "none" }); return false;
  }
  return true;
}

async function onSubmit() {
  if (submitting.value) return;
  if (!validate()) return;
  submitting.value = true;
  try {
    await http.put(apiCfg.me.password, {
      oldPassword: form.value.oldPassword,
      newPassword: form.value.newPassword
    });
    uni.showToast({ title: "修改成功，请重新登录", icon: "success" });
    setTimeout(() => {
      // 强制重新登录
      uni.reLaunch({ url: "/pages/auth/login" });
    }, 1200);
  } catch (e) { /* 错误提示由拦截器处理 */ }
  finally { submitting.value = false; }
}
</script>

<style scoped>
.cp-container {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 16px 12px;
}

.cp-form {
  background: #fff;
  border-radius: 12px;
  padding: 4px 16px;
}

.cp-row {
  display: flex;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid #f1f5f9;
}

.cp-row:last-child {
  border-bottom: none;
}

.cp-label {
  width: 84px;
  color: #475569;
  font-size: 14px;
}

.cp-input {
  flex: 1;
  font-size: 14px;
  color: #1e293b;
  height: 32px;
  line-height: 32px;
}

.cp-tip {
  margin: 12px 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cp-tip text {
  font-size: 12px;
  color: #94a3b8;
}

.cp-submit {
  margin-top: 16px;
  background: #3b82f6;
  color: #fff;
  text-align: center;
  padding: 14px 0;
  border-radius: 8px;
  font-size: 15px;
}

.cp-submit.disabled {
  background: #93c5fd;
}
</style>
