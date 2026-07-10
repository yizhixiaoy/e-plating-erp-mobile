<template>
  <view class="sc-container">
    <view class="sc-bar">
      <text class="sc-back" @click="goBack">‹</text>
      <text class="sc-title">扫一扫</text>
      <text class="sc-action" @click="manualInput">手动</text>
    </view>

    <view class="sc-body">
      <view class="sc-frame">
        <view class="sc-corner top-left"></view>
        <view class="sc-corner top-right"></view>
        <view class="sc-corner bottom-left"></view>
        <view class="sc-corner bottom-right"></view>
        <text class="sc-hint">{{ hint }}</text>
      </view>

      <view class="sc-tip">
        <text>· 仅支持 ERP 体系内 PC 端登录二维码</text>
        <text>· 二维码失效时请刷新 PC 页面重试</text>
      </view>

      <view class="sc-actions">
        <view class="sc-btn primary" @click="startScan">{{ scanning ? '扫描中...' : '开始扫描' }}</view>
        <view class="sc-btn ghost" @click="goBack">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue";

const scanning = ref(false);
const hint = ref("将二维码放入框内，自动识别");

function goBack() {
  uni.navigateBack({ fail: () => uni.switchTab({ url: "/pages/workbench/index" }) });
}

function parseTicket(raw) {
  if (!raw) return "";
  // 支持两种载体：完整 URL 或纯 ticket 串
  const m = String(raw).match(/[?&]ticket=([^&#]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (/^[A-Za-z0-9_-]{8,}$/.test(raw)) return raw;
  return "";
}

function handleResult(raw) {
  const ticket = parseTicket(raw);
  if (!ticket) {
    uni.showModal({ title: "无法识别", content: "该二维码不是有效的登录二维码", showCancel: false });
    return;
  }
  uni.navigateTo({ url: "/pages/auth/scan-confirm?ticket=" + encodeURIComponent(ticket) });
}

function startScan() {
  if (scanning.value) return;
  scanning.value = true;
  hint.value = "正在调用相机...";
  uni.scanCode({
    scanType: ["qrCode"],
    success: (res) => {
      const raw = res && (res.result || res.code) || "";
      handleResult(raw);
    },
    fail: () => {
      uni.showToast({ title: "扫描已取消", icon: "none" });
    },
    complete: () => {
      scanning.value = false;
      hint.value = "将二维码放入框内，自动识别";
    }
  });
}

function manualInput() {
  // H5 端无相机时使用：弹窗输入 ticket 或粘贴 URL
  // eslint-disable-next-line no-undef
  if (typeof uni.prompt === "function") {
    uni.prompt({ title: "粘贴登录链接或 ticket", success: (r) => r.confirm && handleResult(r.value) });
  } else {
    uni.showModal({
      title: "提示",
      content: "当前环境暂不支持手动输入，请直接扫码",
      showCancel: false
    });
  }
}
</script>

<style scoped>
.sc-container {
  min-height: 100%;
  background: #0f172a;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.sc-bar {
  display: flex;
  align-items: center;
  padding: calc(var(--status-bar-height) + 12px) 16px 12px;
  gap: 12px;
}

.sc-back {
  font-size: 28px;
  color: #fff;
  width: 32px;
  text-align: left;
}

.sc-title {
  flex: 1;
  text-align: center;
  font-size: 16px;
  color: #fff;
  font-weight: 500;
}

.sc-action {
  font-size: 14px;
  color: #93c5fd;
  width: 32px;
  text-align: right;
}

.sc-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 24px;
}

.sc-frame {
  width: 240px;
  height: 240px;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  position: relative;
  margin-top: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sc-corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: #3b82f6;
  border-style: solid;
}

.sc-corner.top-left {
  top: -2px; left: -2px;
  border-width: 3px 0 0 3px;
}
.sc-corner.top-right {
  top: -2px; right: -2px;
  border-width: 3px 3px 0 0;
}
.sc-corner.bottom-left {
  bottom: -2px; left: -2px;
  border-width: 0 0 3px 3px;
}
.sc-corner.bottom-right {
  bottom: -2px; right: -2px;
  border-width: 0 3px 3px 0;
}

.sc-hint {
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
}

.sc-tip {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.sc-tip text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.sc-actions {
  width: 100%;
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sc-btn {
  text-align: center;
  padding: 12px 0;
  border-radius: 8px;
  font-size: 15px;
}

.sc-btn.primary {
  background: #3b82f6;
  color: #fff;
}

.sc-btn.ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.4);
}
</style>
