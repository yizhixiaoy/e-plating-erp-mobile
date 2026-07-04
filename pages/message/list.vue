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
  background-color: var(--bg-page);
}

/* ===== 顶部导航 ===== */
.header {
  background: var(--color-gradient);
  padding: 40px 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
}

.header-actions {
  display: flex;
  gap: 16px;
}

.action-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.action-text:active {
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

/* ===== 筛选标签 —— 横向滚动 pill ===== */
.filter-tabs {
  display: flex;
  background-color: var(--bg-card);
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  gap: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.tab {
  flex-shrink: 0;
  text-align: center;
  padding: 6px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-input);
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.tab.active {
  color: var(--color-primary);
  font-weight: 600;
  background: #eff6ff;
  border-color: #bfdbfe;
}

.badge {
  background: var(--color-danger);
  color: #fff;
  font-size: 10px;
  padding: 0 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
  line-height: 16px;
  font-weight: 600;
}

/* ===== 消息列表 ===== */
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
  font-size: 64px;
  margin-bottom: 12px;
  display: block;
  animation: fadeIn 0.3s ease;
}

.empty-text {
  color: var(--text-tertiary);
  font-size: 14px;
}

.message-item {
  background-color: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.message-item:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-md);
}

.message-item.unread {
  background-color: #eff6ff;
  border-left: 3px solid var(--color-primary);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.message-type {
  display: flex;
  align-items: center;
  gap: 6px;
}

.type-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: 500;
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
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.level-tag::before {
  content: "●";
  font-size: 8px;
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
  font-size: 11px;
  color: var(--text-tertiary);
}

.message-content {
  margin-bottom: 10px;
}

.message-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  display: block;
  line-height: 1.4;
}

.message-summary {
  font-size: 13px;
  color: var(--text-secondary);
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
  background-color: var(--color-danger);
  border-radius: 50%;
  flex-shrink: 0;
}

.read-status {
  font-size: 11px;
  color: var(--text-tertiary);
}

.loading-more {
  text-align: center;
  padding: 16px;
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
