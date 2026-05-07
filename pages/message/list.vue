<template>
  <view class="message-container">
    <!-- 顶部导航 -->
    <view class="header">
      <text class="title">消息中心</text>
      <view class="header-actions">
        <text class="action-text" @click="markAllRead">全部已读</text>
      </view>
    </view>

    <!-- 筛选标签 -->
    <view class="filter-tabs">
      <view 
        v-for="tab in tabs" 
        :key="tab.value"
        :class="['tab', currentTab === tab.value ? 'active' : '']"
        @click="currentTab = tab.value"
      >
        <text>{{ tab.label }}</text>
        <text v-if="tab.count > 0" class="badge">{{ tab.count }}</text>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view scroll-y class="message-list" @scrolltolower="loadMore">
      <view v-if="filteredList.length === 0" class="empty-state">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无消息</text>
      </view>

      <view 
        v-for="item in filteredList" 
        :key="item.noticeId"
        :class="['message-item', item.readStatus === 0 ? 'unread' : '']"
        @click="openDetail(item.noticeId)"
      >
        <view class="message-header">
          <view class="message-type">
            <text :class="['type-tag', getTypeClass(item.noticeType)]">
              {{ getTypeLabel(item.noticeType) }}
            </text>
            <text v-if="item.level === 3" class="level-tag urgent">紧急</text>
            <text v-else-if="item.level === 2" class="level-tag important">重要</text>
          </view>
          <text class="message-time">{{ formatTime(item.publishTime) }}</text>
        </view>

        <view class="message-content">
          <text class="message-title">{{ item.title }}</text>
          <text class="message-summary">{{ item.summary }}</text>
        </view>

        <view class="message-footer">
          <text v-if="item.readStatus === 0" class="unread-dot"></text>
          <text class="read-status">{{ item.readStatus === 0 ? '未读' : '已读' }}</text>
        </view>
      </view>

      <!-- 加载更多 -->
      <view v-if="loading" class="loading-more">
        <text>加载中...</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";

const rows = ref([]);
const currentTab = ref("all");
const loading = ref(false);

// 导入配置文件
const config = require("../../config/api.js");
const apiBase = config.apiBase;

const tabs = [
  { label: "全部", value: "all", count: 0 },
  { label: "未读", value: "unread", count: 0 },
  { label: "系统", value: "SYS_UPDATE", count: 0 },
  { label: "通知", value: "INTERNAL_NOTICE", count: 0 }
];

const filteredList = computed(() => {
  if (currentTab.value === "all") {
    return rows.value;
  } else if (currentTab.value === "unread") {
    return rows.value.filter(item => item.readStatus === 0);
  } else {
    return rows.value.filter(item => item.noticeType === currentTab.value);
  }
});

function getTypeClass(type) {
  return type === "SYS_UPDATE" ? "type-system" : "type-notice";
}

function getTypeLabel(type) {
  return type === "SYS_UPDATE" ? "系统" : "通知";
}

function formatTime(time) {
  if (!time) return "";
  const date = new Date(time);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
  return date.toLocaleDateString();
}

const load = async () => {
  const token = uni.getStorageSync("token");
  const resp = await uni.request({
    url: `${apiBase}/mobile/messages`,
    method: "GET",
    header: { Authorization: `Bearer ${token}` }
  });
  rows.value = resp.data?.data || [];
  updateTabCounts();
};

function updateTabCounts() {
  tabs[0].count = rows.value.length;
  tabs[1].count = rows.value.filter(item => item.readStatus === 0).length;
  tabs[2].count = rows.value.filter(item => item.noticeType === "SYS_UPDATE").length;
  tabs[3].count = rows.value.filter(item => item.noticeType === "INTERNAL_NOTICE").length;
}

const markRead = async (noticeId) => {
  const token = uni.getStorageSync("token");
  await uni.request({
    url: `${apiBase}/mobile/messages/${noticeId}/read`,
    method: "PATCH",
    header: { Authorization: `Bearer ${token}` }
  });
  await load();
};

const markAllRead = async () => {
  uni.showModal({
    title: "提示",
    content: "确定将所有消息标记为已读吗？",
    success: async (res) => {
      if (res.confirm) {
        const unreadItems = rows.value.filter(item => item.readStatus === 0);
        for (const item of unreadItems) {
          await markRead(item.noticeId);
        }
        uni.showToast({ title: "操作成功", icon: "success" });
      }
    }
  });
};

const openDetail = (noticeId) => {
  uni.navigateTo({ url: `/pages/message/detail?id=${noticeId}` });
};

function loadMore() {
  if (loading.value) return;
  loading.value = true;
  setTimeout(() => {
    loading.value = false;
  }, 1000);
}

onMounted(load);
</script>

<style scoped>
.message-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.header {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  padding: 40px 20px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.header-actions {
  display: flex;
  gap: 16px;
}

.action-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.filter-tabs {
  display: flex;
  background-color: #fff;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 14px;
  color: #64748b;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.tab.active {
  color: #3b82f6;
  font-weight: 500;
}

.tab.active::after {
  content: "";
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  background-color: #3b82f6;
}

.badge {
  background-color: #ef4444;
  color: #fff;
  font-size: 10px;
  padding: 0 6px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
}

.message-list {
  padding: 12px;
  height: calc(100vh - 160px);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  display: block;
}

.empty-text {
  color: #94a3b8;
  font-size: 14px;
}

.message-item {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.message-item.unread {
  background-color: #eff6ff;
  border-left: 3px solid #3b82f6;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.message-type {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.type-system {
  background-color: #dbeafe;
  color: #3b82f6;
}

.type-notice {
  background-color: #fef3c7;
  color: #f59e0b;
}

.level-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
}

.level-tag.urgent {
  background-color: #fee2e2;
  color: #ef4444;
}

.level-tag.important {
  background-color: #ffedd5;
  color: #f97316;
}

.message-time {
  font-size: 12px;
  color: #94a3b8;
}

.message-content {
  margin-bottom: 12px;
}

.message-title {
  font-size: 16px;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 4px;
  display: block;
}

.message-summary {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.message-footer {
  display: flex;
  align-items: center;
  gap: 6px;
}

.unread-dot {
  width: 8px;
  height: 8px;
  background-color: #ef4444;
  border-radius: 50%;
}

.read-status {
  font-size: 12px;
  color: #94a3b8;
}

.loading-more {
  text-align: center;
  padding: 16px;
  color: #94a3b8;
  font-size: 13px;
}
</style>
