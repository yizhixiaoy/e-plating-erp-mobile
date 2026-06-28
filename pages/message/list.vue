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
        :class="['tab', currentTab === '' ? 'active' : '']"
        @click="switchTab('')"
      >
        <text>全部</text>
        <text v-if="totalCount > 0" class="badge">{{ totalCount }}</text>
      </view>
      <view 
        :class="['tab', currentTab === 'unread' ? 'active' : '']"
        @click="switchTab('unread')"
      >
        <text>未读</text>
        <text v-if="unreadCount > 0" class="badge">{{ unreadCount }}</text>
      </view>
      <view 
        v-for="item in noticeTypeItems" 
        :key="item.value"
        :class="['tab', currentTab === item.value ? 'active' : '']"
        @click="switchTab(item.value)"
      >
        <text>{{ item.label }}</text>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view scroll-y class="message-list" @scrolltolower="loadMore">
      <view v-if="rows.length === 0" class="empty-state">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无消息</text>
      </view>

      <view 
        v-for="item in rows" 
        :key="item.noticeId"
        :class="['message-item', item.readStatus === 0 ? 'unread' : '']"
        @click="openDetail(item)"
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
          <text class="message-summary">{{ item.content }}</text>
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
import { ref, onMounted } from "vue";
import * as http from "../../utils/request.js";
import * as dict from "../../utils/dict.js";
import * as auth from "../../utils/auth.js";
import apiCfg from "../../config/api.js";

const rows = ref([]);
const currentTab = ref("");
const loading = ref(false);
const noticeTypeItems = ref([]);
const totalCount = ref(0);
const unreadCount = ref(0);

function getTypeClass(type) {
  return type === "SYS_UPDATE" ? "type-system" : "type-notice";
}

function getTypeLabel(type) {
  return dict.getDictLabel(noticeTypeItems.value, type) || type;
}

function formatTime(time) {
  if (!time) return "";
  const date = new Date(time);
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
  return date.toLocaleDateString();
}

async function load() {
  loading.value = true;
  try {
    const params = { pageNum: 1, pageSize: 50 };
    if (currentTab.value === "unread") {
      params.readStatus = 0;
    } else if (currentTab.value) {
      params.noticeType = currentTab.value;
    }
    const res = await http.get(apiCfg.message.list, params, { silent: true });
    const data = res.data || {};
    rows.value = data.records || data || [];
    // 更新角标（仅全部和未读）
    if (!currentTab.value) {
      totalCount.value = data.total || rows.value.length;
      unreadCount.value = rows.value.filter((i) => i.readStatus === 0).length;
    }
  } catch (e) { rows.value = []; }
  finally { loading.value = false; }
}

function switchTab(tab) {
  if (currentTab.value === tab) return;
  currentTab.value = tab;
  load();
}

async function markRead(noticeId) {
  const url = apiCfg.fillPath(apiCfg.message.read, { noticeId: String(noticeId) });
  await http.put(url, null, { silent: true });
  await load();
}

async function markAllRead() {
  uni.showModal({
    title: "提示",
    content: "确定将所有消息标记为已读？",
    success: async (res) => {
      if (!res.confirm) return;
      try {
        // 优先调用后端批量接口；失败则退化逐条。
        await http.post(apiCfg.message.readAll, {}, { silent: true });
      } catch (e) {
        const unread = rows.value.filter((i) => i.readStatus === 0);
        for (const item of unread) {
          try { await markRead(item.noticeId); } catch (er) { /* ignore */ }
        }
      }
      uni.showToast({ title: "操作成功", icon: "success" });
      load();
    }
  });
}

function openDetail(item) {
  // 已读消息不需要再次标记已读，直接跳转
  uni.navigateTo({ url: "/pages/message/detail?id=" + String(item.noticeId) + "&readStatus=" + (item.readStatus || 0) });
}

function loadMore() {
  // 占位：当前后端接口未分页，后续按需增强
}

onMounted(() => {
  if (!auth.getToken()) {
    uni.reLaunch({ url: "/pages/auth/login" });
    return;
  }
  dict.fetchDictData("notice_type").then((items) => { noticeTypeItems.value = items; });
  load();
});
</script>

<style scoped>
.message-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #f5f7fa;
}

.header {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  padding: 40px 20px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
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
  flex-shrink: 0;
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
  flex: 1;
  min-height: 0;
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
