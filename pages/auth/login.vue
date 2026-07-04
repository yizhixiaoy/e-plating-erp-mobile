<template>
  <view class="login-container">
    <view class="logo-container">
      <text class="logo-text">电镀ERP</text>
      <text class="slogan">智慧电镀管理平台</text>
    </view>

    <!-- 登录表单 -->
    <view class="login-section">
      <!-- 登录方式切换 -->
      <view class="login-tabs">
        <view :class="['tab', loginType === 'PASSWORD' ? 'active' : '']" @click="loginType = 'PASSWORD'">账号密码</view>
        <view :class="['tab', loginType === 'SMS_CODE' ? 'active' : '']" @click="loginType = 'SMS_CODE'">短信验证</view>
        <view :class="['tab', loginType === 'SCAN_CODE' ? 'active' : '']" @click="loginType = 'SCAN_CODE'">扫码登录</view>
      </view>

      <!-- 租户信息 - 账号反显 -->
      <view v-if="autoTenantInfo" class="tenant-badge">
        <view class="tenant-badge-inner">
          <text class="tenant-name-small">{{ autoTenantInfo.tenantName }}</text>
          <text class="tenant-code-small">{{ autoTenantInfo.shortCode }}</text>
        </view>
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
          <text class="checkbox-label">记住当前用户</text>
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
            <image v-if="qrImage" :src="qrImage" mode="widthFix" class="qr-img" />
            <view v-else class="qr-placeholder">
              <text>扫码登录</text>
              <text class="qr-tip">请使用企业APP扫描二维码</text>
            </view>
            <text class="qr-expire">有效期：{{ qrExpire }}</text>
          </view>
        </view>
        <text v-if="scanStatus" class="scan-status">{{ scanStatus }}</text>
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
import { ref, computed, onMounted, onUnmounted, watch } from "vue";

// 导入配置文件
import apiConfig from "../../config/api.js";
import * as auth from "../../utils/auth.js";

// 导入统一校验
import {
  validateUsername as validateUsr,
  validatePassword as validatePwd,
  validatePhone as validatePhn,
  validateCode,
  validateConfirmPassword as checkConfirmPassword,
  filterUsername,
  filterPassword as filterPwd,
  filterPhone,
  filterCode
} from "../../utils/validation.js";

// 基础配置
const apiBase = apiConfig.apiBase;
const LAST_TENANT_CODE_KEY = apiConfig.storageKeys.lastTenantCode;

// 状态管理
const loginType = ref("PASSWORD");
const autoTenantInfo = ref(null);
let tenantFetchTimeout = null;

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
let scanPollTimer = null;
const qrImage = ref("");
const qrToken = ref("");
const scanStatus = ref("");

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
  // 等待用户输入账号后自动反显企业信息
});

onUnmounted(() => {
  if (qrTimer) {
    clearInterval(qrTimer);
    qrTimer = null;
  }
  stopScanPoll();
});

// 监听登录方式变化
watch(loginType, (newType) => {
  if (newType === "SCAN_CODE") {
    startQrCountdown();
    refreshQrCode();
  } else if (qrTimer) {
    clearInterval(qrTimer);
    qrTimer = null;
  }
  if (newType !== "SCAN_CODE") {
    stopScanPoll();
    scanStatus.value = "";
  }
});

// 实时过滤 + 校验 + 账号反查企业（与 Web 端一致）
watch(username, (val) => {
  const filtered = filterUsername(val);
  if (filtered !== val) username.value = filtered;
  usernameError.value = val ? validateUsr(username.value) : "";
  
  // 清除之前的定时器
  if (tenantFetchTimeout) {
    clearTimeout(tenantFetchTimeout);
    tenantFetchTimeout = null;
  }
  // 输入有效且格式正确时延迟查询租户信息
  if (val && !usernameError.value) {
    tenantFetchTimeout = setTimeout(() => {
      fetchTenantByUsername();
    }, 500);
  } else {
    autoTenantInfo.value = null;
  }
});

watch(password, (val) => {
  const filtered = filterPwd(val);
  if (filtered !== val) password.value = filtered;
  passwordError.value = val ? validatePwd(password.value) : "";
});

watch(phone, (val) => {
  const filtered = filterPhone(val);
  if (filtered !== val) phone.value = filtered;
  phoneError.value = val ? validatePhn(phone.value) : "";
});

watch(smsCode, (val) => {
  const filtered = filterCode(val);
  if (filtered !== val) smsCode.value = filtered;
  smsCodeError.value = val ? validateCode(smsCode.value) : "";
});

// 忘记密码表单实时校验
watch(forgotPhone, (val) => {
  forgotPhone.value = filterPhone(val);
  forgotPhoneError.value = val ? validatePhn(forgotPhone.value) : "";
});

watch(forgotSmsCode, (val) => {
  forgotSmsCode.value = filterCode(val);
  forgotSmsCodeError.value = val ? validateCode(forgotSmsCode.value) : "";
});

watch(newPassword, (val) => {
  newPassword.value = filterPwd(val);
  newPasswordError.value = val ? validatePwd(newPassword.value) : "";
});

watch(confirmPassword, (val) => {
  confirmPasswordError.value = val ? checkConfirmPassword(val, newPassword.value) : "";
});

// 账号反查企业（与 Web 端一致）
async function fetchTenantByUsername() {
  if (!username.value || usernameError.value) {
    autoTenantInfo.value = null;
    return;
  }
  try {
    const resp = await uni.request({
      url: `${apiBase}/auth/tenants/by-username?username=${encodeURIComponent(username.value)}`,
      method: "GET"
    });
    if (resp.data?.code === 200 && resp.data?.data?.found) {
      const data = resp.data.data;
      autoTenantInfo.value = {
        shortCode: data.shortCode,
        tenantName: data.tenantName,
        logoUrl: data.logoUrl,
        tenantId: data.tenantId,
        realName: data.realName,
        phone: data.phone,
        email: data.email
      };
    } else {
      autoTenantInfo.value = null;
    }
  } catch (error) {
    console.error('账号反查企业失败:', error);
    autoTenantInfo.value = null;
  }
}

// 表单验证（使用统一校验模块）
function validateUsername() {
  usernameError.value = validateUsr(username.value);
  return usernameError.value;
}

function validatePassword() {
  passwordError.value = validatePwd(password.value);
  return passwordError.value;
}

function validatePhone() {
  phoneError.value = validatePhn(phone.value);
  return phoneError.value;
}

function validateSmsCode() {
  smsCodeError.value = validateCode(smsCode.value);
  return smsCodeError.value;
}

// 忘记密码验证（使用统一校验模块）
function validateForgotPhone() {
  forgotPhoneError.value = validatePhn(forgotPhone.value);
  return forgotPhoneError.value;
}

function validateForgotSmsCode() {
  forgotSmsCodeError.value = validateCode(forgotSmsCode.value);
  return forgotSmsCodeError.value;
}

function validateNewPassword() {
  newPasswordError.value = validatePwd(newPassword.value);
  return newPasswordError.value;
}

function validateConfirmPassword() {
  confirmPasswordError.value = checkConfirmPassword(confirmPassword.value, newPassword.value);
  return confirmPasswordError.value;
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
        tenantCode: autoTenantInfo.value?.shortCode,
        scene: "LOGIN"
      }
    });
    if (resp.data?.code === 200 && resp.data?.data) {
      uni.showToast({ title: "验证码已发送，请注意查收", icon: "success" });
      smsCountdown.value = 60;
      const timer = setInterval(() => {
        smsCountdown.value--;
        if (smsCountdown.value <= 0) {
          clearInterval(timer);
        }
      }, 1000);
    } else {
      uni.showToast({ title: resp.data?.msg || "验证码发送失败", icon: "none" });
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
        tenantCode: autoTenantInfo.value?.shortCode,
        scene: "FORGOT_PASSWORD"
      }
    });
    if (resp.data?.code === 200 && resp.data?.data) {
      uni.showToast({ title: "验证码已发送，请注意查收", icon: "success" });
      forgotSmsCountdown.value = 60;
      const timer = setInterval(() => {
        forgotSmsCountdown.value--;
        if (forgotSmsCountdown.value <= 0) {
          clearInterval(timer);
        }
      }, 1000);
    } else {
      uni.showToast({ title: resp.data?.msg || "验证码发送失败", icon: "none" });
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
  stopScanPoll();
  scanStatus.value = "";
  try {
    const resp = await uni.request({
      url: `${apiBase}/auth/scan-ticket`,
      method: "POST",
      data: { clientType: "H5" }
    });
    if (resp.data?.code === 200 && resp.data?.data) {
      const data = resp.data.data;
      if (data.qrImage) {
        qrImage.value = data.qrImage;
      }
      if (data.qrToken) {
        qrToken.value = data.qrToken;
        if (data.expiresIn) {
          qrExpireSeconds.value = data.expiresIn;
          updateQrExpireDisplay();
        }
        startQrCountdown();
        startScanPoll();
        uni.showToast({ title: "二维码已刷新", icon: "success" });
      }
    }
  } catch (error) {
    uni.showToast({ title: "二维码刷新失败", icon: "none" });
  }
}

// 扫码状态轮询
function startScanPoll() {
  scanStatus.value = "等待扫码...";
  scanPollTimer = setInterval(async () => {
    if (!qrToken.value) return;
    try {
      const resp = await uni.request({
        url: `${apiBase}/auth/scan-status?qrToken=${encodeURIComponent(qrToken.value)}`,
        method: "GET"
      });
      if (resp.data?.code === 200) {
        const data = resp.data.data;
        if (data.status === "SCANNED") {
          scanStatus.value = "已扫码，请在手机端确认登录";
        } else if (data.status === "CONFIRMED") {
          stopScanPoll();
          clearInterval(qrTimer);
          scanStatus.value = "登录成功，正在跳转...";
          // 自动完成登录
          if (data.accessToken) {
            auth.setToken(data.accessToken);
            if (data.refreshToken) {
              auth.setRefreshToken(data.refreshToken);
            }
            if (data.userInfo) {
              auth.setUserInfo(data.userInfo);
            }
            if (data.sessionKey) {
              auth.saveSessionKey(data.sessionKey);
            }
            uni.switchTab({ url: "/pages/workbench/index" });
          }
        } else if (data.status === "EXPIRED") {
          stopScanPoll();
          qrImage.value = "";
          scanStatus.value = "二维码已过期，点击刷新";
          uni.showToast({ title: "二维码已过期", icon: "none" });
        }
      }
    } catch (error) {
      console.error('扫码状态轮询失败:', error);
    }
  }, 2000);
}

function stopScanPoll() {
  if (scanPollTimer) {
    clearInterval(scanPollTimer);
    scanPollTimer = null;
  }
}

// 登录处理
async function handleLogin() {
  // 先校验表单（与 Web 端一致）
  if (loginType.value === 'PASSWORD') {
    validateUsername();
    validatePassword();
    if (usernameError.value || passwordError.value) return;
  } else if (loginType.value === 'SMS_CODE') {
    const phoneErr = validatePhone();
    const codeErr = validateSmsCode();
    if (phoneErr || codeErr) return;
  }
  
  loading.value = true;
  try {
    // 获取设备信息
    // #ifdef H5
    const deviceInfo = navigator.platform || 'Unknown';
    const userAgent = navigator.userAgent;
    // #endif
    
    let loginData = {
      loginType: loginType.value,
      tenantCode: autoTenantInfo.value?.shortCode || '',
      clientType: "H5",
      // #ifdef H5
      deviceInfo: deviceInfo,
      userAgent: userAgent
      // #endif
    };
    
    if (loginType.value === 'PASSWORD') {
      // RSA 加密密码传输
      try {
        const JSEncrypt = (await import("jsencrypt")).default;
        const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const keyResp = await uni.request({
          url: `${apiBase}/auth/public-key?clientId=${encodeURIComponent(clientId)}`,
          method: "GET"
        });
        const publicKey = keyResp.data?.data?.publicKey;
        if (publicKey) {
          const enc = new JSEncrypt();
          enc.setPublicKey(publicKey);
          const encrypted = enc.encrypt(password.value);
          if (encrypted) {
            Object.assign(loginData, { username: username.value, password: encrypted, rsaClientId: clientId });
          } else {
            Object.assign(loginData, { username: username.value, password: password.value });
          }
        } else {
          Object.assign(loginData, { username: username.value, password: password.value });
        }
      } catch {
        Object.assign(loginData, { username: username.value, password: password.value });
      }
    } else if (loginType.value === 'SMS_CODE') {
      Object.assign(loginData, { phone: phone.value, smsCode: smsCode.value });
    }
    
    const resp = await uni.request({
      url: `${apiBase}/auth/login`,
      method: "POST",
      data: loginData
    });
    
    if (resp.data?.code === 200 && resp.data?.data?.accessToken) {
      const token = resp.data.data.accessToken;
      const userInfo = resp.data.data.userInfo;
      const sessionKey = resp.data.data.sessionKey;
      
      auth.setToken(token);
      if (resp.data.data.refreshToken) {
        auth.setRefreshToken(resp.data.data.refreshToken);
      }
      if (userInfo) {
        auth.setUserInfo(userInfo);
      }
      if (sessionKey) {
        auth.saveSessionKey(sessionKey);
      }
      if (rememberTenant.value) {
        uni.setStorageSync(LAST_TENANT_CODE_KEY, autoTenantInfo.value?.shortCode || '');
      }
      uni.switchTab({ url: "/pages/message/list" });
    } else {
      uni.showToast({ title: resp.data?.msg || "登录失败", icon: "none" });
    }
  } catch (error) {
    uni.showToast({ title: "登录失败，请稍后重试", icon: "none" });
  } finally {
    loading.value = false;
  }
}

// 忘记密码处理
async function handleForgotPassword() {
  // 先校验所有字段（与 Web 端一致）
  const phoneErr = validateForgotPhone();
  const codeErr = validateForgotSmsCode();
  const pwdErr = validateNewPassword();
  const confirmErr = validateConfirmPassword();
  if (phoneErr || codeErr || pwdErr || confirmErr) return;
  
  forgotLoading.value = true;
  try {
    const resp = await uni.request({
      url: `${apiBase}/auth/reset-password`,
      method: "POST",
      data: {
        phone: forgotPhone.value,
        smsCode: forgotSmsCode.value,
        newPassword: newPassword.value,
        tenantCode: autoTenantInfo.value?.shortCode || ''
      }
    });
    
    if (resp.data?.code === 200 && resp.data?.data) {
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
      uni.showToast({ title: resp.data?.msg || "密码重置失败", icon: "none" });
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
  min-height: 100%;
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

.tenant-badge {
  margin-bottom: 16px;
  padding: 8px 12px;
  background-color: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 6px;
}

.tenant-badge-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tenant-name-small {
  font-size: 14px;
  font-weight: 500;
  color: #0369a1;
}

.tenant-code-small {
  font-size: 12px;
  color: #64748b;
  background-color: #e0f2fe;
  padding: 2px 8px;
  border-radius: 4px;
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
  min-height: 200px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #f8fafc;
  overflow: hidden;
}

.qr-img {
  width: 180px;
  height: 180px;
  display: block;
}

.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.qr-placeholder text:first-child {
  font-size: 14px;
  color: #64748b;
}

.qr-tip {
  font-size: 12px;
  color: #64748b;
  margin-top: 8px;
}

.qr-expire {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 8px;
  padding-bottom: 12px;
}

.scan-status {
  display: block;
  text-align: center;
  font-size: 13px;
  color: #3b82f6;
  margin-top: 12px;
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
