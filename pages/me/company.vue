<template>
  <view class="company-container">
    <!-- 头部卡片 -->
    <view class="company-header">
      <view class="company-logo">
        <text class="logo-text">{{ logoInitial }}</text>
      </view>
      <text class="company-name">{{ info.tenantName || '加载中...' }}</text>
    </view>

    <!-- 信息列表 -->
    <view class="info-card">
      <view class="info-row">
        <text class="info-label">公司名称</text>
        <text class="info-value">{{ info.tenantName || '-' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">公司简称</text>
        <text class="info-value">{{ info.shortCode || '-' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">联系人</text>
        <text class="info-value">{{ info.contactName || '-' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">联系电话</text>
        <text class="info-value">{{ info.phone || '-' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import * as http from "../../utils/request.js";
import * as auth from "../../utils/auth.js";
import apiCfg from "../../config/api.js";

const info = ref({});

const logoInitial = computed(() => (info.value.tenantName || "E").slice(0, 1).toUpperCase());

async function load() {
  try {
    const res = await http.get(apiCfg.me.company, null);
    info.value = res.data || {};
  } catch (e) {
    info.value = {};
  }
}

onMounted(() => { load(); });
</script>

<style scoped>
.company-container {
  min-height: 100%;
  background-color: var(--bg-page);
}

.company-header {
  background: var(--color-gradient);
  padding: 40px 20px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.company-logo {
  width: 76px;
  height: 76px;
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.logo-text {
  color: #fff;
  font-size: 28px;
  font-weight: 700;
}

.company-name {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.3px;
}

.info-card {
  margin: -16px 12px 12px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-light);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}
</style>
