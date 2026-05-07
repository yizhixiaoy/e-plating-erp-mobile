<template>
  <view class="scan-confirm-container">
    <view class="logo-container">
      <text class="logo-text">电镀ERP</text>
      <text class="slogan">智慧电镀管理平台</text>
    </view>

    <view class="confirm-card">
      <view class="confirm-icon">
        <text class="icon">📱</text>
      </view>
      <text class="confirm-title">扫码登录确认</text>
      
      <view class="info-section">
        <view class="info-item">
          <text class="info-label">登录设备：</text>
          <text class="info-value">{{ deviceInfo }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">登录时间：</text>
          <text class="info-value">{{ loginTime }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">登录IP：</text>
          <text class="info-value">{{ loginIp }}</text>
        </view>
      </view>

      <view class="action-buttons">
        <button @click="handleCancel" class="cancel-btn">取消</button>
        <button :loading="loading" @click="handleConfirm" class="confirm-btn">确认登录</button>
      </view>
    </view>

    <text class="tip">为了您的账号安全，请确认登录信息是否正确</text>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";

// 基础配置
const apiBase = "http://localhost:8080/api/v1";

// 状态管理
const qrToken = ref("");
const loading = ref(false);
const deviceInfo = ref("Web端");
const loginTime = ref("");
const loginIp = ref("");

// 生命周期
onMounted(() => {
  // 获取URL参数中的qrToken
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options;
  qrToken.value = options.qrToken || "";
  
  if (qrToken.value) {
    fetchScanInfo();
  } else {
    uni.showToast({ title: "无效的扫码链接", icon: "none" });
    setTimeout(() => {
      uni.navigateBack();
    }, 1500);
  }
  
  // 设置当前时间
  const now = new Date();
  loginTime.value = now.toLocaleString();
  // 模拟IP
  loginIp.value = "192.168.1.100";
});

// 获取扫码信息
async function fetchScanInfo() {
  try {
    const token = uni.getStorageSync("token");
    const resp = await uni.request({
      url: `${apiBase}/auth/scan-status`,
      method: "GET",
      header: { Authorization: `Bearer ${token}` },
      data: { qrToken: qrToken.value }
    });
    
    if (resp.data?.data) {
      const scanData = resp.data.data;
      deviceInfo.value = scanData.clientType || "未知设备";
      // 可以从后端获取更多信息
    }
  } catch (error) {
    console.error('获取扫码信息失败:', error);
  }
}

// 确认登录
async function handleConfirm() {
  if (!qrToken.value) {
    uni.showToast({ title: "无效的扫码链接", icon: "none" });
    return;
  }
  
  loading.value = true;
  try {
    const token = uni.getStorageSync("token");
    const resp = await uni.request({
      url: `${apiBase}/auth/scan-confirm`,
      method: "POST",
      header: { Authorization: `Bearer ${token}` },
      data: { qrToken: qrToken.value, confirm: true }
    });
    
    if (resp.data?.code === 0) {
      uni.showToast({ title: "登录已确认", icon: "success" });
      setTimeout(() => {
        uni.navigateBack();
      }, 1500);
    } else {
      uni.showToast({ title: resp.data?.message || "确认失败", icon: "none" });
    }
  } catch (error) {
    uni.showToast({ title: "确认失败，请稍后重试", icon: "none" });
  } finally {
    loading.value = false;
  }
}

// 取消登录
async function handleCancel() {
  if (!qrToken.value) {
    uni.navigateBack();
    return;
  }
  
  try {
    const token = uni.getStorageSync("token");
    const resp = await uni.request({
      url: `${apiBase}/auth/scan-confirm`,
      method: "POST",
      header: { Authorization: `Bearer ${token}` },
      data: { qrToken: qrToken.value, confirm: false }
    });
    
    uni.showToast({ title: "已取消登录", icon: "none" });
    setTimeout(() => {
      uni.navigateBack();
    }, 1500);
  } catch (error) {
    uni.showToast({ title: "取消失败，请稍后重试", icon: "none" });
  }
}
</script>

<style scoped>
.scan-confirm-container {
  padding: 16px;
  min-height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-container {
  text-align: center;
  margin: 40px 0 32px;
}

.logo-text {
  font-size: 24px;
  font-weight: bold;
  color: #3b82f6;
  display: block;
}

.slogan {
  font-size: 12px;
  color: #64748b;
  margin-top: 6px;
  display: block;
}

.confirm-card {
  background-color: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.confirm-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #eff6ff;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 16px;
}

.icon {
  font-size: 40px;
}

.confirm-title {
  font-size: 18px;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 24px;
}

.info-section {
  width: 100%;
  margin-bottom: 32px;
}

.info-item {
  display: flex;
  margin-bottom: 12px;
  align-items: flex-start;
}

.info-label {
  font-size: 14px;
  color: #64748b;
  min-width: 80px;
}

.info-value {
  font-size: 14px;
  color: #1e293b;
  flex: 1;
  word-break: break-all;
}

.action-buttons {
  width: 100%;
  display: flex;
  gap: 12px;
}

.cancel-btn {
  flex: 1;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background-color: #fff;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
}

.confirm-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background-color: #3b82f6;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.tip {
  margin-top: 24px;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
  line-height: 1.5;
}
</style>
