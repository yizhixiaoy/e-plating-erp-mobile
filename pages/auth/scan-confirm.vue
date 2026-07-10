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
          <text class="info-label">当前用户：</text>
          <text class="info-value">{{ currentUser?.realName || currentUser?.username || '未知' }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">企业：</text>
          <text class="info-value">{{ currentUser?.companyName || '未知' }}</text>
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
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import apiConfig from "../../config/api.js";
import * as auth from "../../utils/auth.js";
import { request } from "../../utils/request.js";

// 状态管理
const qrToken = ref("");
const loading = ref(false);

// 当前登录用户信息（从存储中读取）
const currentUser = ref(null);

// 生命周期：使用 onLoad 接收参数，兼容 H5 和真机
onLoad((options) => {
  qrToken.value = (options && (options.qrToken || options.ticket)) || "";
  
  currentUser.value = auth.getUserInfo();
  
  if (qrToken.value && currentUser.value) {
    notifyScan();
  } else {
    uni.showToast({ title: "无效的扫码链接", icon: "none" });
    setTimeout(() => {
      uni.navigateBack();
    }, 1500);
  }
});

// 通知后端已扫码
async function notifyScan() {
  try {
    await request({
      url: apiConfig.getUrl("/auth/scan"),
      method: "POST",
      data: {
        qrToken: qrToken.value,
        userId: currentUser.value.userId
      }
    });
  } catch (error) {
    console.error('通知扫码失败:', error);
  }
}

// 确认登录
async function handleConfirm() {
  if (!qrToken.value) {
    uni.showToast({ title: "无效的扫码链接", icon: "none" });
    return;
  }
  
  if (!currentUser.value) {
    uni.showToast({ title: "用户信息缺失，请重新登录", icon: "none" });
    return;
  }
  
  loading.value = true;
  try {
    const resp = await request({
      url: apiConfig.getUrl("/auth/scan-confirm"),
      method: "POST",
      data: {
        qrToken: qrToken.value,
        confirm: true,
        userId: currentUser.value.userId,
        tenantId: currentUser.value.tenantId,
        username: currentUser.value.username
      }
    });
    
    if (resp?.code === 200) {
      uni.showToast({ title: "登录已确认", icon: "success" });
      setTimeout(() => {
        uni.navigateBack();
      }, 1500);
    } else {
      uni.showToast({ title: resp.data?.msg || "确认失败", icon: "none" });
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
    await request({
      url: apiConfig.getUrl("/auth/scan-confirm"),
      method: "POST",
      data: {
        qrToken: qrToken.value,
        confirm: false,
        userId: currentUser.value?.userId
      }
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
  min-height: 100%;
  background-color: var(--bg-page);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-container {
  text-align: center;
  margin: 40px 0 32px;
}

.logo-text {
  font-size: 28px;
  font-weight: 800;
  background: var(--color-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: block;
}

.slogan {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 6px;
  display: block;
  letter-spacing: 0.5px;
}

.confirm-card {
  background-color: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 28px 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-md);
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
  margin-bottom: 18px;
}

.icon {
  font-size: 40px;
}

.confirm-title {
  font-size: 19px;
  font-weight: 700;
  color: var(--text-primary);
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
  color: var(--text-secondary);
  min-width: 80px;
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
  flex: 1;
  word-break: break-all;
  font-weight: 500;
}

.action-buttons {
  width: 100%;
  display: flex;
  gap: 12px;
}

.cancel-btn {
  flex: 1;
  padding: 13px;
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  background-color: var(--bg-card);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.cancel-btn:active {
  background-color: var(--bg-input);
}

.confirm-btn {
  flex: 1;
  padding: 13px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-gradient);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
}

.confirm-btn:active {
  transform: scale(0.98);
}

.tip {
  margin-top: 24px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.5;
}
</style>
