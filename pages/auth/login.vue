<template>
  <view class="login-container">
    <view class="logo-container">
      <text class="logo-text">电镀ERP</text>
      <text class="slogan">智慧电镀管理平台</text>
    </view>

    <!-- 租户选择 -->
    <view v-if="step === 'tenant'" class="tenant-section">
      <text class="section-title">选择企业</text>
      
      <!-- 最近登录企业 -->
      <view v-if="recentTenants.length > 0" class="recent-tenants">
        <text class="subtitle">最近登录</text>
        <view v-for="tenant in recentTenants" :key="tenant.shortCode" class="tenant-item" @click="selectTenant(tenant)">
          <text class="tenant-name">{{ tenant.tenantName }}</text>
          <text class="tenant-code">{{ tenant.shortCode }}</text>
        </view>
      </view>
      
      <!-- 搜索企业 -->
      <view class="search-section">
        <view class="search-input-container">
          <input v-model="tenantSearch" @input="searchTenants" placeholder="搜索企业名称或编码" class="search-input" />
          <text v-if="tenantSearch" @click="clearSearch" class="clear-btn">×</text>
        </view>
        <view v-if="searchResults.length > 0" class="search-results">
          <view v-for="tenant in searchResults" :key="tenant.shortCode" class="tenant-item" @click="selectTenant(tenant)">
            <text class="tenant-name">{{ tenant.tenantName }}</text>
            <text class="tenant-code">{{ tenant.shortCode }}</text>
          </view>
        </view>
      </view>
      
      <button @click="backToRole" class="back-btn">返回</button>
    </view>

    <!-- 登录表单 -->
    <view v-else-if="step === 'login'" class="login-section">
      <!-- 登录方式切换 -->
      <view class="login-tabs">
        <view :class="['tab', loginType === 'PASSWORD' ? 'active' : '']" @click="loginType = 'PASSWORD'">账号密码</view>
        <view :class="['tab', loginType === 'SMS_CODE' ? 'active' : '']" @click="loginType = 'SMS_CODE'">短信验证</view>
        <view :class="['tab', loginType === 'SCAN_CODE' ? 'active' : '']" @click="loginType = 'SCAN_CODE'">扫码登录</view>
      </view>

      <!-- 账号密码登录 -->
      <view v-if="loginType === 'PASSWORD'" class="login-form">
        <view class="form-item">
          <text class="label">账号</text>
          <input v-model="username" @input="validateUsername" :class="{ 'error': usernameError }" placeholder="请输入账号" class="input" />
          <text v-if="usernameError" class="error-tip">{{ usernameError }}</text>
        </view>
        <view class="form-item">
          <text class="label">密码</text>
          <input v-model="password" password @input="validatePassword" :class="{ 'error': passwordError }" placeholder="请输入密码" class="input" />
          <text v-if="passwordError" class="error-tip">{{ passwordError }}</text>
        </view>
        <view class="form-item">
          <checkbox v-model="rememberTenant" class="checkbox" />
          <text class="checkbox-label">记住当前企业</text>
        </view>
      </view>

      <!-- 短信验证登录 -->
      <view v-else-if="loginType === 'SMS_CODE'" class="login-form">
        <view class="form-item">
          <text class="label">手机号</text>
          <input v-model="phone" @input="validatePhone" :class="{ 'error': phoneError }" placeholder="请输入手机号" class="input" />
          <text v-if="phoneError" class="error-tip">{{ phoneError }}</text>
        </view>
        <view class="form-item">
          <text class="label">验证码</text>
          <view class="code-input-container">
            <input v-model="smsCode" @input="validateSmsCode" :class="{ 'error': smsCodeError }" placeholder="请输入6位验证码" class="code-input" />
            <button :disabled="smsCountdown > 0 || smsSending" :loading="smsSending" @click="sendSmsCode" class="code-btn">
              {{ smsCountdown > 0 ? `重新获取(${smsCountdown}s)` : '获取验证码' }}
            </button>
          </view>
          <text v-if="smsCodeError" class="error-tip">{{ smsCodeError }}</text>
        </view>
      </view>

      <!-- 扫码登录 -->
      <view v-else-if="loginType === 'SCAN_CODE'" class="login-form">
        <view class="qr-container">
          <view class="qr-code" @click="refreshQrCode">
            <text>扫码登录</text>
            <text class="qr-tip">请使用企业APP扫描二维码</text>
            <text class="qr-expire">有效期：{{ qrExpire }}</text>
          </view>
        </view>
        <button @click="refreshQrCode" class="refresh-btn">刷新二维码</button>
      </view>

      <!-- 登录按钮 -->
      <button v-if="loginType !== 'SCAN_CODE'" :loading="loading" :disabled="!canLogin" @click="handleLogin" class="login-btn">
        登录
      </button>

      <!-- 其他操作 -->
      <view class="other-actions">
        <text @click="showForgotPassword = true" class="forgot-password">忘记密码？</text>
      </view>
    </view>

    <!-- 忘记密码弹窗 -->
    <view v-if="showForgotPassword" class="modal-overlay" @click="showForgotPassword = false">
      <view class="modal-content" @click.stop>
        <text class="modal-title">找回密码</text>
        <view class="form-item">
          <text class="label">手机号</text>
          <input v-model="forgotPhone" @input="validateForgotPhone" :class="{ 'error': forgotPhoneError }" placeholder="请输入您的手机号" class="input" />
          <text v-if="forgotPhoneError" class="error-tip">{{ forgotPhoneError }}</text>
        </view>
        <view class="form-item">
          <text class="label">验证码</text>
          <view class="code-input-container">
            <input v-model="forgotSmsCode" @input="validateForgotSmsCode" :class="{ 'error': forgotSmsCodeError }" placeholder="请输入6位验证码" class="code-input" />
            <button :disabled="forgotSmsCountdown > 0 || forgotSmsSending" :loading="forgotSmsSending" @click="sendForgotSmsCode" class="code-btn">
              {{ forgotSmsCountdown > 0 ? `重新获取(${forgotSmsCountdown}s)` : '获取验证码' }}
            </button>
          </view>
          <text v-if="forgotSmsCodeError" class="error-tip">{{ forgotSmsCodeError }}</text>
        </view>
        <view class="form-item">
          <text class="label">新密码</text>
          <input v-model="newPassword" password @input="validateNewPassword" :class="{ 'error': newPasswordError }" placeholder="请输入新密码" class="input" />
          <text v-if="newPasswordError" class="error-tip">{{ newPasswordError }}</text>
        </view>
        <view class="form-item">
          <text class="label">确认密码</text>
          <input v-model="confirmPassword" password @input="validateConfirmPassword" :class="{ 'error': confirmPasswordError }" placeholder="请再次输入新密码" class="input" />
          <text v-if="confirmPasswordError" class="error-tip">{{ confirmPasswordError }}</text>
        </view>
        <view class="modal-buttons">
          <button @click="showForgotPassword = false" class="cancel-btn">取消</button>
          <button :loading="forgotLoading" :disabled="!canResetPassword" @click="handleForgotPassword" class="confirm-btn">重置密码</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";

// 导入配置文件
const config = require("../../config/api.js");

// 基础配置
const apiBase = config.apiBase;
const LAST_TENANT_CODE_KEY = config.storageKeys.lastTenantCode;

// 状态管理
const step = ref("login");
const selectedTenant = ref(null);
const loginType = ref("PASSWORD");
const tenantSearch = ref("");
const searchResults = ref([]);
const recentTenants = ref([]);
const searching = ref(false);

// 表单数据
const username = ref("");
const password = ref("");
const phone = ref("");
const smsCode = ref("");
const rememberTenant = ref(true);
const loading = ref(false);

// 错误提示
const usernameError = ref("");
const passwordError = ref("");
const phoneError = ref("");
const smsCodeError = ref("");

// 倒计时
const smsCountdown = ref(0);
const smsSending = ref(false);
const qrExpire = ref("02:00");
const qrExpireSeconds = ref(120);
let qrTimer = null;

// 忘记密码
const showForgotPassword = ref(false);
const forgotPhone = ref("");
const forgotSmsCode = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const forgotSmsCountdown = ref(0);
const forgotSmsSending = ref(false);
const forgotLoading = ref(false);
const forgotPhoneError = ref("");
const forgotSmsCodeError = ref("");
const newPasswordError = ref("");
const confirmPasswordError = ref("");

// 计算属性
const canLogin = computed(() => {
  if (loginType.value === 'PASSWORD') {
    return !usernameError.value && !passwordError.value && username.value && password.value;
  } else if (loginType.value === 'SMS_CODE') {
    return !phoneError.value && !smsCodeError.value && phone.value && smsCode.value;
  }
  return true;
});

const canResetPassword = computed(() => {
  return !forgotPhoneError.value && !forgotSmsCodeError.value && !newPasswordError.value && !confirmPasswordError.value && 
    forgotPhone.value && forgotSmsCode.value && newPassword.value && confirmPassword.value;
});

// 生命周期
onMounted(() => {
  fetchRecentTenants();
  const lastCode = uni.getStorageSync(LAST_TENANT_CODE_KEY);
  if (lastCode) {
    selectedTenant.value = {
      shortCode: lastCode,
      tenantName: lastCode === "a" ? "演示租户A" : lastCode,
    };
  }
});

// 监听登录方式变化
watch(loginType, (newType) => {
  if (newType === "SCAN_CODE") {
    startQrCountdown();
  } else if (qrTimer) {
    clearInterval(qrTimer);
  }
});

// 租户选择
async function fetchRecentTenants() {
  try {
    const token = uni.getStorageSync("token");
    if (token) {
      const resp = await uni.request({
        url: `${apiBase}/auth/tenants/recent`,
        method: "GET",
        header: { Authorization: `Bearer ${token}` }
      });
      if (resp.data?.data) {
        recentTenants.value = resp.data.data;
      }
    } else {
      const lastCode = uni.getStorageSync(LAST_TENANT_CODE_KEY);
      if (lastCode) {
        recentTenants.value = [{
          shortCode: lastCode,
          tenantName: lastCode === "a" ? "演示租户A" : lastCode,
        }];
      }
    }
  } catch (error) {
    console.error('获取最近租户失败:', error);
  }
}

async function searchTenants() {
  if (!tenantSearch.value.trim()) {
    searchResults.value = [];
    return;
  }
  
  searching.value = true;
  try {
    const resp = await uni.request({
      url: `${apiBase}/auth/tenants/search`,
      method: "GET",
      data: { keyword: tenantSearch.value, limit: 10 }
    });
    if (resp.data?.data) {
      searchResults.value = resp.data.data;
    }
  } catch (error) {
    console.error('搜索租户失败:', error);
  } finally {
    searching.value = false;
  }
}

function clearSearch() {
  tenantSearch.value = "";
  searchResults.value = [];
}

function selectTenant(tenant) {
  selectedTenant.value = tenant;
  if (rememberTenant.value) {
    uni.setStorageSync(LAST_TENANT_CODE_KEY, tenant.shortCode);
  }
  step.value = "login";
}

function backToRole() {
  step.value = "login";
}

// 表单验证
function validateUsername() {
  if (!username.value) {
    usernameError.value = "请输入账号";
  } else if (username.value.length < 4 || username.value.length > 20) {
    usernameError.value = "账号长度需在4-20个字符之间";
  } else if (!/^[a-zA-Z0-9]+$/.test(username.value)) {
    usernameError.value = "账号只能包含字母和数字";
  } else {
    usernameError.value = "";
  }
}

function validatePassword() {
  if (!password.value) {
    passwordError.value = "请输入密码";
  } else if (password.value.length < 6 || password.value.length > 64) {
    passwordError.value = "密码长度需在6-64个字符之间";
  } else {
    passwordError.value = "";
  }
}

function validatePhone() {
  const phoneRegex = /^1\d{10}$/;
  if (!phone.value) {
    phoneError.value = "请输入手机号";
  } else if (!phoneRegex.test(phone.value)) {
    phoneError.value = "手机号格式不正确";
  } else {
    phoneError.value = "";
  }
}

function validateSmsCode() {
  if (!smsCode.value) {
    smsCodeError.value = "请输入验证码";
  } else if (smsCode.value.length !== 6) {
    smsCodeError.value = "验证码长度为6位";
  } else {
    smsCodeError.value = "";
  }
}

// 忘记密码验证
function validateForgotPhone() {
  const phoneRegex = /^1\d{10}$/;
  if (!forgotPhone.value) {
    forgotPhoneError.value = "请输入手机号";
  } else if (!phoneRegex.test(forgotPhone.value)) {
    forgotPhoneError.value = "手机号格式不正确";
  } else {
    forgotPhoneError.value = "";
  }
}

function validateForgotSmsCode() {
  if (!forgotSmsCode.value) {
    forgotSmsCodeError.value = "请输入验证码";
  } else if (forgotSmsCode.value.length !== 6) {
    forgotSmsCodeError.value = "验证码长度为6位";
  } else {
    forgotSmsCodeError.value = "";
  }
}

function validateNewPassword() {
  if (!newPassword.value) {
    newPasswordError.value = "请输入新密码";
  } else if (newPassword.value.length < 8 || newPassword.value.length > 64) {
    newPasswordError.value = "密码长度需在8-64个字符之间";
  } else {
    newPasswordError.value = "";
  }
}

function validateConfirmPassword() {
  if (!confirmPassword.value) {
    confirmPasswordError.value = "请确认密码";
  } else if (confirmPassword.value !== newPassword.value) {
    confirmPasswordError.value = "两次输入的密码不一致";
  } else {
    confirmPasswordError.value = "";
  }
}

// 验证码发送
async function sendSmsCode() {
  if (!phone.value) {
    phoneError.value = "请输入手机号";
    return;
  }
  smsSending.value = true;
  try {
    const resp = await uni.request({
      url: `${apiBase}/auth/sms-code`,
      method: "POST",
      data: {
        phone: phone.value,
        tenantCode: selectedTenant.value?.shortCode,
        scene: "LOGIN"
      }
    });
    if (resp.data?.code === 0) {
      uni.showToast({ title: "验证码已发送，请注意查收", icon: "success" });
      smsCountdown.value = 60;
      const timer = setInterval(() => {
        smsCountdown.value--;
        if (smsCountdown.value <= 0) {
          clearInterval(timer);
        }
      }, 1000);
    } else {
      uni.showToast({ title: resp.data?.message || "验证码发送失败", icon: "none" });
    }
  } catch (error) {
    uni.showToast({ title: "验证码发送失败，请稍后重试", icon: "none" });
  } finally {
    smsSending.value = false;
  }
}

async function sendForgotSmsCode() {
  if (!forgotPhone.value) {
    forgotPhoneError.value = "请输入手机号";
    return;
  }
  forgotSmsSending.value = true;
  try {
    const resp = await uni.request({
      url: `${apiBase}/auth/sms-code`,
      method: "POST",
      data: {
        phone: forgotPhone.value,
        tenantCode: selectedTenant.value?.shortCode,
        scene: "FORGOT_PASSWORD"
      }
    });
    if (resp.data?.code === 0) {
      uni.showToast({ title: "验证码已发送，请注意查收", icon: "success" });
      forgotSmsCountdown.value = 60;
      const timer = setInterval(() => {
        forgotSmsCountdown.value--;
        if (forgotSmsCountdown.value <= 0) {
          clearInterval(timer);
        }
      }, 1000);
    } else {
      uni.showToast({ title: resp.data?.message || "验证码发送失败", icon: "none" });
    }
  } catch (error) {
    uni.showToast({ title: "验证码发送失败，请稍后重试", icon: "none" });
  } finally {
    forgotSmsSending.value = false;
  }
}

// 扫码登录
function startQrCountdown() {
  if (qrTimer) {
    clearInterval(qrTimer);
  }
  qrExpireSeconds.value = 120;
  updateQrExpireDisplay();
  qrTimer = setInterval(() => {
    qrExpireSeconds.value--;
    updateQrExpireDisplay();
    if (qrExpireSeconds.value <= 0) {
      clearInterval(qrTimer);
      uni.showToast({ title: "二维码已过期，请刷新", icon: "none" });
    }
  }, 1000);
}

function updateQrExpireDisplay() {
  const minutes = Math.floor(qrExpireSeconds.value / 60);
  const seconds = qrExpireSeconds.value % 60;
  qrExpire.value = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

async function refreshQrCode() {
  try {
    const resp = await uni.request({
      url: `${apiBase}/auth/scan-ticket`,
      method: "POST",
      data: { clientType: "APP" }
    });
    if (resp.data?.code === 0 && resp.data?.data?.qrToken) {
      // 这里应该生成二维码，暂时用模拟数据
      startQrCountdown();
      uni.showToast({ title: "二维码已刷新", icon: "success" });
    }
  } catch (error) {
    uni.showToast({ title: "二维码刷新失败", icon: "none" });
  }
}

// 登录处理
async function handleLogin() {
  if (!selectedTenant.value) {
    uni.showToast({ title: "请先选择企业", icon: "none" });
    return;
  }
  
  loading.value = true;
  try {
    let loginData = {
      loginType: loginType.value,
      tenantCode: selectedTenant.value.shortCode,
      clientType: "APP"
    };
    
    if (loginType.value === 'PASSWORD') {
      Object.assign(loginData, { username: username.value, password: password.value });
    } else if (loginType.value === 'SMS_CODE') {
      Object.assign(loginData, { phone: phone.value, smsCode: smsCode.value });
    }
    
    const resp = await uni.request({
      url: `${apiBase}/auth/login`,
      method: "POST",
      data: loginData
    });
    
    if (resp.data?.code === 0 && resp.data?.data?.accessToken) {
      const token = resp.data.data.accessToken;
      uni.setStorageSync("token", token);
      if (rememberTenant.value) {
        uni.setStorageSync(LAST_TENANT_CODE_KEY, selectedTenant.value.shortCode);
      }
      uni.navigateTo({ url: "/pages/message/list" });
    } else {
      uni.showToast({ title: resp.data?.message || "登录失败", icon: "none" });
    }
  } catch (error) {
    uni.showToast({ title: "登录失败，请稍后重试", icon: "none" });
  } finally {
    loading.value = false;
  }
}

// 忘记密码处理
async function handleForgotPassword() {
  if (!selectedTenant.value) {
    uni.showToast({ title: "请先选择企业", icon: "none" });
    return;
  }
  
  forgotLoading.value = true;
  try {
    const resp = await uni.request({
      url: `${apiBase}/auth/reset-password`,
      method: "POST",
      data: {
        phone: forgotPhone.value,
        smsCode: forgotSmsCode.value,
        newPassword: newPassword.value,
        tenantCode: selectedTenant.value.shortCode
      }
    });
    
    if (resp.data?.code === 0) {
      uni.showToast({ title: "密码重置成功", icon: "success" });
      showForgotPassword.value = false;
      // 重置表单
      forgotPhone.value = "";
      forgotSmsCode.value = "";
      newPassword.value = "";
      confirmPassword.value = "";
      forgotPhoneError.value = "";
      forgotSmsCodeError.value = "";
      newPasswordError.value = "";
      confirmPasswordError.value = "";
    } else {
      uni.showToast({ title: resp.data?.message || "密码重置失败", icon: "none" });
    }
  } catch (error) {
    uni.showToast({ title: "密码重置失败，请稍后重试", icon: "none" });
  } finally {
    forgotLoading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  padding: 16px;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.logo-container {
  text-align: center;
  margin: 40px 0;
}

.logo-text {
  font-size: 28px;
  font-weight: bold;
  color: #3b82f6;
  display: block;
}

.slogan {
  font-size: 14px;
  color: #64748b;
  margin-top: 8px;
  display: block;
}

.tenant-section {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 16px;
  color: #1e293b;
}

.subtitle {
  font-size: 14px;
  color: #64748b;
  margin: 12px 0 8px;
}

.tenant-item {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tenant-name {
  font-size: 14px;
  color: #1e293b;
}

.tenant-code {
  font-size: 12px;
  color: #64748b;
  background-color: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
}

.search-section {
  margin-top: 16px;
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 10px 32px 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 14px;
}

.clear-btn {
  position: absolute;
  right: 12px;
  font-size: 18px;
  color: #94a3b8;
}

.search-results {
  margin-top: 8px;
  background-color: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.back-btn {
  margin-top: 16px;
  padding: 10px;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  background-color: #fff;
  color: #3b82f6;
  font-size: 14px;
}

.login-section {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.login-tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #e2e8f0;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: 14px;
  color: #64748b;
  border-bottom: 2px solid transparent;
}

.tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  font-weight: 500;
}

.login-form {
  margin-bottom: 20px;
}

.form-item {
  margin-bottom: 16px;
}

.label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 6px;
}

.input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 14px;
}

.input.error {
  border-color: #ef4444;
}

.error-tip {
  font-size: 12px;
  color: #ef4444;
  margin-top: 4px;
  display: block;
}

.code-input-container {
  display: flex;
  gap: 8px;
}

.code-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 14px;
}

.code-input.error {
  border-color: #ef4444;
}

.code-btn {
  padding: 0 12px;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  background-color: #3b82f6;
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
}

.checkbox {
  transform: scale(1.2);
  margin-right: 8px;
}

.checkbox-label {
  font-size: 14px;
  color: #64748b;
}

.qr-container {
  display: flex;
  justify-content: center;
  margin: 20px 0;
}

.qr-code {
  width: 200px;
  height: 200px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #f8fafc;
}

.qr-tip {
  font-size: 12px;
  color: #64748b;
  margin-top: 8px;
}

.qr-expire {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

.refresh-btn {
  margin-top: 16px;
  padding: 10px;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  background-color: #fff;
  color: #3b82f6;
  font-size: 14px;
}

.login-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 4px;
  background-color: #3b82f6;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
}

.other-actions {
  margin-top: 16px;
  text-align: center;
}

.forgot-password {
  font-size: 14px;
  color: #3b82f6;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.modal-content {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 16px;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 16px;
  display: block;
  text-align: center;
}

.modal-buttons {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.cancel-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background-color: #fff;
  color: #64748b;
  font-size: 14px;
}

.confirm-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 4px;
  background-color: #3b82f6;
  color: #fff;
  font-size: 14px;
}
</style>
