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
        <text class="message-time">{{ computedMessage.publishTime }}</text>
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
import * as dict from "../../utils/dict.js";

// 基础配置
const apiBase = apiConfig.apiBase;

// 状态管理
const id = ref("");
const readStatus = ref(0);
const message = ref(null);
const loading = ref(true);
const noticeTypeItems = ref([]);

// 生命周期
onMounted(() => {
  // 获取URL参数中的id和readStatus
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage.options;
  id.value = options.id || "";
  readStatus.value = parseInt(options.readStatus || "0", 10);
  
  // 加载字典
  dict.fetchDictData("notice_type").then((items) => { noticeTypeItems.value = items; });
  
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
      url: `${apiBase}/messages/notices/${id.value}`,
      method: "GET"
    });
    
    if (resp?.code === 200 && resp?.data) {
      message.value = resp.data;
      // 仅未读消息才标记已读，避免重复调用
      if (readStatus.value === 0) {
        markAsRead();
      }
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
      method: "PUT"
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
  
  // 从字典获取消息类型标签
  const typeText = dict.getDictLabel(noticeTypeItems.value, message.value.noticeType) || message.value.noticeType;
  
  // 格式化时间
  let publishTime = message.value.publishTime || message.value.createdAt;
  if (publishTime) {
    const date = new Date(publishTime);
    publishTime = date.toLocaleString();
  }
  
  return {
    ...message.value,
    typeText,
    publishTime
  };
});
</script>

<style scoped>
.message-detail-container {
  min-height: 100%;
  background-color: var(--bg-page);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-sm);
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
  color: var(--text-primary);
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
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
  color: var(--text-secondary);
}

.message-content {
  padding: 20px 16px;
  background-color: var(--bg-card);
  margin: 12px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.message-title {
  font-size: 19px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 14px;
  display: block;
  line-height: 1.4;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.message-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.message-type {
  font-size: 12px;
  color: var(--color-primary);
  background-color: #eff6ff;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-weight: 500;
}

.message-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary);
}

.message-body :deep(p) {
  margin-bottom: 12px;
}

.message-body :deep(h1),
.message-body :deep(h2),
.message-body :deep(h3) {
  margin: 16px 0 8px;
  font-weight: 600;
  color: var(--text-primary);
}

.error-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 300px;
  font-size: 14px;
  color: var(--text-secondary);
}

.retry-btn {
  margin-top: 16px;
  padding: 8px 20px;
  border: 1.5px solid var(--color-primary);
  border-radius: var(--radius-md);
  background-color: var(--bg-card);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 500;
}
</style>
