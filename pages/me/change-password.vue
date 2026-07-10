<template>
  <view class="cp-container">
    <view class="cp-form">
      <view class="cp-row">
        <text class="cp-label">原密码</text>
        <view class="cp-input-box">
          <input class="cp-input" type="text" :password="!showOldPwd" v-model="form.oldPassword" placeholder="请输入原密码" />
        </view>
        <view class="cp-eye" :style="{ backgroundImage: 'url(' + (showOldPwd ? ICON_EYE_OPEN : ICON_EYE_CLOSE) + ')' }" @click="showOldPwd = !showOldPwd"></view>
      </view>
      <view class="cp-row">
        <text class="cp-label">新密码</text>
        <view class="cp-input-box">
          <input class="cp-input" type="text" :password="!showNewPwd" v-model="form.newPassword" placeholder="8-20位，必须含字母和数字" />
        </view>
        <view class="cp-eye" :style="{ backgroundImage: 'url(' + (showNewPwd ? ICON_EYE_OPEN : ICON_EYE_CLOSE) + ')' }" @click="showNewPwd = !showNewPwd"></view>
      </view>
      <text v-if="newPasswordError" class="cp-error-tip">{{ newPasswordError }}</text>
      <view class="cp-row">
        <text class="cp-label">确认密码</text>
        <view class="cp-input-box">
          <input class="cp-input" type="text" :password="!showConfirm" v-model="form.confirm" placeholder="再次输入新密码" />
        </view>
        <view class="cp-eye" :style="{ backgroundImage: 'url(' + (showConfirm ? ICON_EYE_OPEN : ICON_EYE_CLOSE) + ')' }" @click="showConfirm = !showConfirm"></view>
      </view>
      <text v-if="confirmPasswordError" class="cp-error-tip">{{ confirmPasswordError }}</text>
    </view>

    <view class="cp-tip">
      <text>· 密码长度 8-20 位</text>
      <text>· 必须同时包含字母和数字</text>
      <text>· 支持特殊字符 @$!%*#?&</text>
      <text>· 不得与原密码相同</text>
    </view>

    <view class="cp-submit" :class="{ disabled: submitting }" @click="onSubmit">
      <text>{{ submitting ? '提交中...' : '确认修改' }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from "vue";
import * as http from "../../utils/request.js";
import apiCfg from "../../config/api.js";
import { filterPassword, validatePassword } from "../../utils/validation.js";

const form = ref({ oldPassword: "", newPassword: "", confirm: "" });
const submitting = ref(false);
const showOldPwd = ref(false);
const showNewPwd = ref(false);
const showConfirm = ref(false);
const newPasswordError = ref("");
const confirmPasswordError = ref("");

// Element Plus 风格眼睛图标 SVG（与 Web 端一致）
const ICON_EYE_OPEN = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#a8abb2" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>');
const ICON_EYE_CLOSE = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#a8abb2" d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>');

// 实时过滤密码字符（与 login.vue 一致，防止字符集不一致导致登录失败）
watch(() => form.value.oldPassword, (val) => {
  const filtered = filterPassword(val);
  if (filtered !== val) form.value.oldPassword = filtered;
});

watch(() => form.value.newPassword, (val) => {
  const filtered = filterPassword(val);
  if (filtered !== val) form.value.newPassword = filtered;
  newPasswordError.value = val ? validatePassword(form.value.newPassword) : "";
});

watch(() => form.value.confirm, (val) => {
  if (val && val !== form.value.newPassword) {
    confirmPasswordError.value = "两次输入的密码不一致";
  } else {
    confirmPasswordError.value = "";
  }
});

function validate() {
  if (!form.value.oldPassword) { uni.showToast({ title: "请输入原密码", icon: "none" }); return false; }
  if (!form.value.newPassword) { uni.showToast({ title: "请输入新密码", icon: "none" }); return false; }
  // 与 login.vue + 后端一致的校验：8-20位，必须含字母和数字，仅允许 @$!%*#?&
  const pwdErr = validatePassword(form.value.newPassword);
  if (pwdErr) { uni.showToast({ title: pwdErr, icon: "none" }); return false; }
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
  min-height: 100%;
  background: var(--bg-page);
  padding: 16px 12px;
}

.cp-form {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 4px 16px;
  box-shadow: var(--shadow-sm);
}

.cp-row {
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid var(--border-light);
}

.cp-row:last-child {
  border-bottom: none;
}

.cp-label {
  width: 84px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
}

.cp-input-box {
  flex: 1;
  min-width: 0;
}

.cp-input {
  width: 100%;
  font-size: 15px;
  color: var(--text-primary);
  height: 32px;
  line-height: 32px;
}

.cp-eye {
  width: 48rpx;
  height: 48rpx;
  flex-shrink: 0;
  background-size: 36rpx;
  background-repeat: no-repeat;
  background-position: center;
}

.cp-tip {
  margin: 16px 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-tip text {
  font-size: 12px;
  color: var(--text-tertiary);
}

.cp-submit {
  margin-top: 24px;
  background: var(--color-gradient);
  color: #fff;
  text-align: center;
  padding: 14px 0;
  border-radius: var(--radius-lg);
  font-size: 15px;
  font-weight: 600;
  box-shadow: var(--shadow-md);
  transition: transform var(--transition-fast);
}

.cp-submit:active {
  transform: scale(0.98);
}

.cp-submit.disabled {
  background: var(--border-strong);
  box-shadow: none;
  color: var(--text-tertiary);
}

.cp-error-tip {
  font-size: 12px;
  color: #ef4444;
  display: block;
  margin-top: -8px;
  margin-bottom: 8px;
  padding-left: 84px;
}


</style>
