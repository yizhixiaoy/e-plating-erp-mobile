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
  background-color: #f5f7fa;
}

.company-header {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  padding: 40px 20px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.company-logo {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
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
}

.info-card {
  margin: 16px 12px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 14px;
  color: #64748b;
}

.info-value {
  font-size: 14px;
  color: #1e293b;
}
</style>
