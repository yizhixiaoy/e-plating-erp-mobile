<template>
  <view class="message-detail-container">
    <view class="header">
      <button @click="goBack" class="back-btn">
        <text class="back-icon">←</text>
      </button>
      <text class="header-title">消息详情</text>
      <view class="header-right"></view>
    </view>

    <view v-if="loading" class="loading-container">
      <text>加载中...</text>
    </view>

    <view v-else-if="computedMessage" class="message-content">
      <text class="message-title">{{ computedMessage.title }}</text>
      <view class="message-meta">
        <text class="message-time">{{ computedMessage.createTime }}</text>
        <text class="message-type">{{ computedMessage.typeText }}</text>
      </view>
      <view class="message-body" v-html="computedMessage.content"></view>
    </view>

    <view v-else class="error-container">
      <text>消息加载失败</text>
      <button @click="loadMessage" class="retry-btn">重试</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import apiConfig from "../../config/api.js";
import { request } from "../../utils/request.js";

// 基础配置
const apiBase = apiConfig.apiBase;

// 状态管理
const id = ref("");
const message = ref(null);
const loading = ref(true);

// 生命周期
onMounted(() => {
  // 获取URL参数中的id
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options;
  id.value = options.id || "";
  
  if (id.value) {
    loadMessage();
  } else {
    loading.value = false;
  }
});

// 加载消息详情
async function loadMessage() {
  if (!id.value) return;
  
  loading.value = true;
  try {
    const resp = await request({
      url: `${apiBase}/message/notices/${id.value}`,
      method: "GET"
    });
    
    if (resp?.code === 200 && resp?.data) {
      message.value = resp.data;
      // 标记为已读
      markAsRead();
    }
  } catch (error) {
    console.error('加载消息详情失败:', error);
  } finally {
    loading.value = false;
  }
}

// 标记为已读
async function markAsRead() {
  if (!id.value) return;
  
  try {
    await request({
      url: `${apiBase}/mobile/messages/${id.value}/read`,
      method: "PATCH"
    });
  } catch (error) {
    console.error('标记消息已读失败:', error);
  }
}

// 返回上一页
function goBack() {
  uni.navigateBack();
}

// 计算属性
const computedMessage = computed(() => {
  if (!message.value) return null;
  
  // 格式化消息类型
  const typeMap = {
    "SYS_UPDATE": "系统更新",
    "NOTICE": "公告",
    "ALERT": "提醒",
    "TASK": "任务"
  };
  
  // 格式化时间
  let createTime = message.value.createTime;
  if (createTime) {
    // 假设createTime是ISO格式的字符串
    const date = new Date(createTime);
    createTime = date.toLocaleString();
  }
  
  return {
    ...message.value,
    typeText: typeMap[message.value.noticeType] || message.value.noticeType,
    createTime: createTime
  };
});
</script>

<style scoped>
.message-detail-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;
}

.back-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
}

.back-icon {
  font-size: 20px;
  color: #1e293b;
}

.header-title {
  font-size: 16px;
  font-weight: 500;
  color: #1e293b;
}

.header-right {
  width: 40px;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
  font-size: 14px;
  color: #64748b;
}

.message-content {
  padding: 16px;
  background-color: #fff;
  margin: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message-title {
  font-size: 18px;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 12px;
  display: block;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.message-time {
  font-size: 12px;
  color: #94a3b8;
}

.message-type {
  font-size: 12px;
  color: #3b82f6;
  background-color: #eff6ff;
  padding: 2px 8px;
  border-radius: 4px;
}

.message-body {
  font-size: 14px;
  line-height: 1.6;
  color: #334155;
}

.message-body :deep(p) {
  margin-bottom: 12px;
}

.message-body :deep(h1),
.message-body :deep(h2),
.message-body :deep(h3) {
  margin: 16px 0 8px;
  font-weight: 500;
}

.error-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 300px;
  font-size: 14px;
  color: #64748b;
}

.retry-btn {
  margin-top: 16px;
  padding: 8px 16px;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  background-color: #fff;
  color: #3b82f6;
  font-size: 14px;
}
</style>
