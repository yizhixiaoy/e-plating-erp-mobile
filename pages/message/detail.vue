<template>
  <view class="detail-page">
    <!-- 顶部导航栏 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">
        <text class="nav-back-icon">←</text>
      </view>
      <text class="nav-title">消息详情</text>
      <view class="nav-placeholder"></view>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="state-container">
      <text class="state-spinner">⏳</text>
      <text class="state-text">加载中...</text>
    </view>

    <!-- 错误状态 -->
    <view v-else-if="!computedMessage" class="state-container">
      <text class="state-icon">📭</text>
      <text class="state-text">消息加载失败</text>
      <view class="retry-btn" @click="loadMessage">
        <text>重新加载</text>
      </view>
    </view>

    <!-- 消息内容 -->
    <view v-else class="detail-scroll">
      <!-- 标题卡片 -->
      <view class="title-card">
        <!-- 紧急/重要标记 -->
        <view v-if="computedMessage.level === 3" class="level-badge level-urgent">
          <text class="level-dot"></text>
          <text>紧急</text>
        </view>
        <view v-else-if="computedMessage.level === 2" class="level-badge level-important">
          <text class="level-dot"></text>
          <text>重要</text>
        </view>

        <!-- 标题 -->
        <view class="title-row">
          <view class="title-bar"></view>
          <text class="title-text">{{ computedMessage.title }}</text>
        </view>

        <!-- 元信息行 -->
        <view class="meta-row">
          <view class="meta-item">
            <text class="meta-icon">🕐</text>
            <text class="meta-text">{{ computedMessage.displayTime }}</text>
          </view>
          <view class="meta-item">
            <text class="meta-icon">📋</text>
            <text class="meta-text type-label">{{ computedMessage.typeText }}</text>
          </view>
        </view>
      </view>

      <!-- 正文卡片 -->
      <view class="content-card">
        <view class="content-body" v-html="computedMessage.content"></view>
      </view>

      <!-- 底部来源信息 -->
      <view class="footer-info">
        <text class="footer-text">此消息来自 {{ computedMessage.source || '系统' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import apiConfig from "../../config/api.js";
import { request } from "../../utils/request.js";
import * as dict from "../../utils/dict.js";
import { formatAbsoluteTime } from "../../utils/time.js";

const apiBase = apiConfig.apiBase;

const id = ref("");
const readStatus = ref(0);
const message = ref(null);
const loading = ref(true);
const noticeTypeItems = ref([]);

onLoad((options) => {
  id.value = (options && options.id) || "";
  readStatus.value = parseInt((options && options.readStatus) || "0", 10);

  dict.fetchDictData("notice_type").then((items) => { noticeTypeItems.value = items; });

  if (id.value) {
    loadMessage();
  } else {
    loading.value = false;
  }
});

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

function goBack() {
  uni.navigateBack();
}

const computedMessage = computed(() => {
  if (!message.value) return null;

  const typeText = dict.getDictLabel(noticeTypeItems.value, message.value.noticeType) || message.value.noticeType || '系统通知';

  const rawTime = message.value.publishTime || message.value.createdAt;
  const displayTime = formatAbsoluteTime(rawTime);

  return {
    ...message.value,
    typeText,
    displayTime
  };
});
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: #f0f2f5;
}

/* ===== 导航栏 ===== */
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--status-bar-height) + 8px) 16px 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
}

.nav-back {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-back:active {
  background: rgba(255, 255, 255, 0.3);
}

.nav-back-icon {
  font-size: 18px;
  color: #fff;
  font-weight: 400;
  line-height: 1;
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.5px;
}

.nav-placeholder {
  width: 36px;
}

/* ===== 状态 ===== */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 360px;
  gap: 12px;
}

.state-spinner,
.state-icon {
  font-size: 48px;
}

.state-text {
  font-size: 15px;
  color: #94a3b8;
}

.retry-btn {
  margin-top: 8px;
  padding: 10px 28px;
  border-radius: 22px;
  background: #fff;
  border: 1px solid #3b82f6;
}

.retry-btn text {
  font-size: 14px;
  color: #3b82f6;
  font-weight: 500;
}

/* ===== 滚动区 ===== */
.detail-scroll {
  padding: 14px 14px 40px;
}

/* ===== 标题卡片 ===== */
.title-card {
  background: #fff;
  border-radius: 16px;
  padding: 22px 20px 18px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.level-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  margin-bottom: 14px;
}

.level-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.level-urgent {
  background: #fef2f2;
  color: #dc2626;
}

.level-urgent .level-dot {
  background: #dc2626;
}

.level-important {
  background: #fff7ed;
  color: #ea580c;
}

.level-important .level-dot {
  background: #ea580c;
}

.title-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.title-bar {
  width: 4px;
  min-width: 4px;
  height: 24px;
  background: linear-gradient(180deg, #3b82f6, #6366f1);
  border-radius: 2px;
  margin-top: 2px;
}

.title-text {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.45;
  letter-spacing: 0.15px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.meta-icon {
  font-size: 14px;
  line-height: 1;
}

.meta-text {
  font-size: 13px;
  color: #64748b;
}

.type-label {
  color: #3b82f6;
  font-weight: 500;
}

/* ===== 正文卡片 ===== */
.content-card {
  background: #fff;
  border-radius: 16px;
  padding: 22px 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  margin-bottom: 16px;
}

.content-body {
  font-size: 15px;
  line-height: 1.9;
  color: #334155;
  word-break: break-word;
}

/* 富文本样式 */
.content-body :deep(p) {
  margin-bottom: 14px;
}

.content-body :deep(p:last-child) {
  margin-bottom: 0;
}

.content-body :deep(h1),
.content-body :deep(h2),
.content-body :deep(h3),
.content-body :deep(h4) {
  margin: 20px 0 10px;
  font-weight: 600;
  color: #1e293b;
}

.content-body :deep(h1) { font-size: 19px; }
.content-body :deep(h2) { font-size: 17px; }
.content-body :deep(h3) { font-size: 16px; }
.content-body :deep(h4) { font-size: 15px; }

.content-body :deep(ul),
.content-body :deep(ol) {
  padding-left: 20px;
  margin-bottom: 14px;
}

.content-body :deep(li) {
  margin-bottom: 6px;
}

.content-body :deep(strong),
.content-body :deep(b) {
  color: #1e293b;
  font-weight: 600;
}

.content-body :deep(a) {
  color: #3b82f6;
  text-decoration: underline;
}

.content-body :deep(blockquote) {
  border-left: 3px solid #cbd5e1;
  padding: 6px 0 6px 14px;
  margin: 14px 0;
  color: #64748b;
  background: #f8fafc;
  border-radius: 0 6px 6px 0;
}

.content-body :deep(code) {
  background: #f1f5f9;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  color: #e11d48;
}

.content-body :deep(pre) {
  background: #1e293b;
  color: #e2e8f0;
  padding: 14px 16px;
  border-radius: 10px;
  margin: 14px 0;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
}

.content-body :deep(pre code) {
  background: none;
  color: inherit;
  padding: 0;
  font-size: inherit;
}

.content-body :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 10px 0;
}

.content-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0;
  font-size: 13px;
}

.content-body :deep(th),
.content-body :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 9px 12px;
  text-align: left;
}

.content-body :deep(th) {
  background: #f8fafc;
  font-weight: 600;
  color: #334155;
}

.content-body :deep(hr) {
  border: none;
  height: 1px;
  background: #e2e8f0;
  margin: 18px 0;
}

/* ===== 底部信息 ===== */
.footer-info {
  text-align: center;
  padding: 4px 0 20px;
}

.footer-text {
  font-size: 12px;
  color: #94a3b8;
}
</style>
