<template>
  <view class="me-container">
    <!-- 用户卡 -->
    <view class="me-card">
      <view class="me-avatar">
        <text class="me-avatar-text">{{ avatarInitial }}</text>
      </view>
      <view class="me-info">
        <text class="me-name">{{ profile.realName || profile.username || "未登录" }}</text>
        <text class="me-meta">
          {{ profile.deptName || "—" }}{{ profile.positionName ? ' · ' + profile.positionName : '' }}
        </text>
        <text class="me-tenant">{{ profile.tenantName || tenantCode }}</text>
      </view>
    </view>

    <!-- 一级入口 -->
    <view class="me-section">
      <view class="me-row" @click="goScan">
        <text class="me-row-label">扫一扫</text>
        <text class="me-row-arrow">›</text>
      </view>
      <view class="me-row" @click="goTodo">
        <text class="me-row-label">我的待办</text>
        <text class="me-row-arrow">›</text>
      </view>
      <view class="me-row" @click="goChangePassword">
        <text class="me-row-label">修改密码</text>
        <text class="me-row-arrow">›</text>
      </view>
    </view>

    <!-- 二级入口 -->
    <view class="me-section">
      <view class="me-row" @click="goCompany">
        <text class="me-row-label">公司信息</text>
        <text class="me-row-arrow">›</text>
      </view>
      <view class="me-row" @click="goEmailRecords">
        <text class="me-row-label">邮件记录</text>
        <text class="me-row-arrow">›</text>
      </view>
      <view class="me-row" @click="goSmsRecords">
        <text class="me-row-label">短信记录</text>
        <text class="me-row-arrow">›</text>
      </view>
      <view class="me-row" @click="goSettings">
        <text class="me-row-label">设置</text>
        <text class="me-row-arrow">›</text>
      </view>
      <view class="me-row" @click="goAbout">
        <text class="me-row-label">关于</text>
        <text class="me-row-arrow">›</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="me-logout" @click="logout">
      <text>退出登录</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
const http = require("../../utils/request.js");
const auth = require("../../utils/auth.js");
const apiCfg = require("../../config/api.js");

const profile = ref(auth.getUserInfo() || {});
const tenantCode = ref(auth.getTenantCode() || "");

const avatarInitial = computed(() => {
  const name = profile.value.realName || profile.value.username || "U";
  return String(name).slice(0, 1).toUpperCase();
});

async function loadProfile() {
  try {
    const res = await http.get(apiCfg.me.profile, null, { silent: true });
    if (res && res.data) {
      profile.value = Object.assign({}, profile.value, res.data);
      auth.setUserInfo(profile.value);
    }
  } catch (e) { /* 静默 */ }
}

function goScan() { uni.navigateTo({ url: "/pages/scan/index" }); }
function goTodo() { uni.navigateTo({ url: "/pages/todo/list" }); }
function goChangePassword() { uni.navigateTo({ url: "/pages/me/change-password" }); }
function goCompany() { uni.navigateTo({ url: "/pages/me/company" }); }
function goEmailRecords() { uni.navigateTo({ url: "/pages/message/email-records" }); }
function goSmsRecords() { uni.navigateTo({ url: "/pages/message/sms-records" }); }
function goSettings() { uni.navigateTo({ url: "/pages/me/settings" }); }
function goAbout() { uni.navigateTo({ url: "/pages/me/about" }); }

function logout() {
  uni.showModal({
    title: "提示",
    content: "确认退出登录？",
    success: async (res) => {
      if (res.confirm) {
        try {
          await http.post(apiCfg.login.logout, { refreshToken: auth.getRefreshToken() }, { silent: true });
        } catch (e) { /* ignore */ }
        auth.clearAuth();
        uni.reLaunch({ url: "/pages/auth/login" });
      }
    }
  });
}

onMounted(() => {
  if (!auth.getToken()) {
    uni.reLaunch({ url: "/pages/auth/login" });
    return;
  }
  loadProfile();
});
</script>

<style scoped>
.me-container {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 24px;
}

.me-card {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  padding: 32px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  color: #fff;
}

.me-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.me-avatar-text {
  color: #fff;
  font-size: 24px;
  font-weight: 600;
}

.me-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.me-name {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.me-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.me-tenant {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.me-section {
  margin: 12px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.me-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
}

.me-row:last-child {
  border-bottom: none;
}

.me-row-label {
  flex: 1;
  font-size: 14px;
  color: #1e293b;
}

.me-row-arrow {
  color: #cbd5e1;
  font-size: 18px;
}

.me-logout {
  margin: 16px 12px 0;
  text-align: center;
  padding: 14px 0;
  background: #fff;
  color: #ef4444;
  border-radius: 12px;
  font-size: 15px;
}
</style>
