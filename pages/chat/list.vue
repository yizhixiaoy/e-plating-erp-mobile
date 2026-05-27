<template>
  <view class="chat-container">
    <!-- 顶部导航 -->
    <view class="header">
      <text class="title">消息</text>
      <view class="header-actions">
        <text class="action-icon" @click="goNewChat">+</text>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <input class="search-input" placeholder="搜索会话" v-model="keyword" confirm-type="search" />
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
        <text v-if="tab.value === 'unread' && totalUnread > 0" class="badge">{{ totalUnread > 99 ? '99+' : totalUnread }}</text>
      </view>
    </view>

    <!-- 会话列表 -->
    <scroll-view scroll-y class="conv-list" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="onRefresh" @scrolltolower="loadMore">
      <view v-if="filteredList.length === 0 && !loading" class="empty-state">
        <text class="empty-icon">💬</text>
        <text class="empty-text">暂无会话</text>
      </view>

      <view
        v-for="item in filteredList"
        :key="item.id"
        :class="['conv-item', item.pinned === 1 ? 'pinned' : '']"
        @click="openConversation(item)"
        @longpress="onLongPress(item)"
      >
        <view class="conv-avatar">
          <text class="avatar-text">{{ getAvatarText(item) }}</text>
          <view v-if="item.muted === 1" class="mute-indicator">
            <text class="mute-icon">🔇</text>
          </view>
        </view>

        <view class="conv-main">
          <view class="conv-top">
            <text class="conv-name">{{ getConvName(item) }}</text>
            <text class="conv-time">{{ formatTime(item.lastMessageAt) }}</text>
          </view>
          <view class="conv-bottom">
            <text class="conv-preview">
              <text v-if="item.lastMessageRecalled === 1" class="recalled">[已撤回]</text>
              <text v-else>{{ getLastMessagePreview(item) }}</text>
            </text>
            <text v-if="item.unreadCount > 0" class="unread-badge">{{ item.unreadCount > 99 ? '99+' : item.unreadCount }}</text>
          </view>
        </view>

        <view v-if="item.pinned === 1" class="pin-indicator">
          <text class="pin-icon">📌</text>
        </view>
      </view>

      <view v-if="loading" class="loading-more">
        <text>加载中...</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
const http = require("../../utils/request.js");
const auth = require("../../utils/auth.js");
const apiCfg = require("../../config/api.js");

const conversations = ref([]);
const currentTab = ref("all");
const keyword = ref("");
const loading = ref(false);
const refreshing = ref(false);
const pageNum = ref(1);
const hasMore = ref(true);
let pollTimer = null;

const tabs = [
  { label: "全部", value: "all" },
  { label: "未读", value: "unread" },
  { label: "单聊", value: "SINGLE" },
  { label: "群聊", value: "GROUP" }
];

const totalUnread = computed(() => conversations.value.reduce((sum, c) => sum + (c.unreadCount || 0), 0));

const filteredList = computed(() => {
  let list = conversations.value;
  if (currentTab.value === "unread") {
    list = list.filter(c => c.unreadCount > 0);
  } else if (currentTab.value === "SINGLE" || currentTab.value === "GROUP") {
    list = list.filter(c => c.convType === currentTab.value);
  }
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase();
    list = list.filter(c => {
      const name = getConvName(c).toLowerCase();
      return name.includes(kw) || (c.lastMessageContent || "").toLowerCase().includes(kw);
    });
  }
  return list;
});

function getConvName(item) {
  if (item.convType === "SINGLE") return item.peerName || item.name || "未命名";
  return item.name || "群聊";
}

function getAvatarText(item) {
  const name = getConvName(item);
  return name.slice(0, 1).toUpperCase();
}

function getLastMessagePreview(item) {
  if (!item.lastMessageContent) return "";
  const type = item.lastMessageMessageType || item.lastMessageType;
  if (type === "IMAGE") return "[图片]";
  if (type === "FILE") return "[文件]";
  if (type === "SYSTEM") return item.lastMessageContent;
  const content = item.lastMessageContent;
  return content.length > 30 ? content.slice(0, 30) + "..." : content;
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = (today - msgDay) / 86400000;
  if (dayDiff < 1) return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
  if (dayDiff < 7) return ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return (d.getMonth() + 1) + "/" + d.getDate();
}

async function loadConversations(refresh) {
  if (refresh) {
    pageNum.value = 1;
    hasMore.value = true;
  }
  if (!hasMore.value && !refresh) return;
  loading.value = true;
  try {
    const res = await http.get(apiCfg.chat.conversations, {
      pageNum: pageNum.value,
      pageSize: 20
    }, { silent: true });
    const list = res.data?.list || res.data || [];
    if (refresh || pageNum.value === 1) {
      conversations.value = list;
    } else {
      conversations.value = [...conversations.value, ...list];
    }
    hasMore.value = list.length >= 20;
    if (refresh) refreshing.value = false;
  } catch (e) {
    if (refresh) refreshing.value = false;
  } finally {
    loading.value = false;
  }
}

function onRefresh() {
  refreshing.value = true;
  loadConversations(true);
}

function loadMore() {
  if (loading.value || !hasMore.value) return;
  pageNum.value++;
  loadConversations(false);
}

function openConversation(item) {
  const name = encodeURIComponent(getConvName(item));
  uni.navigateTo({
    url: "/pages/chat/conversation?id=" + item.id + "&name=" + name + "&convType=" + item.convType,
    events: {
      onMessagesRead(lastReadId) {
        const conv = conversations.value.find(c => c.id === item.id);
        if (conv) conv.unreadCount = 0;
      }
    }
  });
}

function goNewChat() {
  uni.navigateTo({ url: "/pages/chat/new-chat" });
}

function onLongPress(item) {
  const actions = [];
  actions.push(item.pinned === 1 ? "取消置顶" : "置顶");
  actions.push(item.muted === 1 ? "取消免打扰" : "免打扰");
  actions.push("删除");
  uni.showActionSheet({
    itemList: actions,
    success(res) {
      const action = actions[res.tapIndex];
      if (action === "置顶") togglePin(item, 1);
      else if (action === "取消置顶") togglePin(item, 0);
      else if (action === "免打扰") toggleMute(item, 1);
      else if (action === "取消免打扰") toggleMute(item, 0);
      else if (action === "删除") deleteConversation(item);
    }
  });
}

async function togglePin(item, value) {
  try {
    await http.patch(apiCfg.chat.pinned, { conversationId: item.id, value }, { silent: true });
    item.pinned = value;
  } catch (e) { /* ignore */ }
}

async function toggleMute(item, value) {
  try {
    await http.patch(apiCfg.chat.muted, { conversationId: item.id, value }, { silent: true });
    item.muted = value;
  } catch (e) { /* ignore */ }
}

async function deleteConversation(item) {
  uni.showModal({
    title: "提示",
    content: "确定删除该会话？",
    success: async (res) => {
      if (!res.confirm) return;
      try {
        const url = apiCfg.fillPath(apiCfg.chat.deleteConversation, { id: item.id });
        await http.del(url, { silent: true });
        conversations.value = conversations.value.filter(c => c.id !== item.id);
      } catch (e) { /* ignore */ }
    }
  });
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => { loadConversations(true); }, 15000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onMounted(() => {
  if (!auth.getToken()) {
    uni.reLaunch({ url: "/pages/auth/login" });
    return;
  }
  loadConversations(true);
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<script>
export default {
  onShow() {
    if (this.$refs && typeof this.$refs.loadConversations === "function") {
      this.$refs.loadConversations(true);
    }
  }
};
</script>

<style scoped>
.chat-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.header {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  padding: 40px 20px 16px;
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

.action-icon {
  font-size: 24px;
  color: #fff;
  width: 32px;
  height: 32px;
  text-align: center;
  line-height: 32px;
}

.search-bar {
  padding: 8px 16px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
}

.search-input {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  color: #fff;
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

.conv-list {
  height: calc(100vh - 180px);
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

.conv-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: #fff;
  border-bottom: 1px solid #f1f5f9;
  position: relative;
}

.conv-item.pinned {
  background-color: #fefce8;
}

.conv-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  position: relative;
  flex-shrink: 0;
}

.avatar-text {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.mute-indicator {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mute-icon {
  font-size: 10px;
}

.conv-main {
  flex: 1;
  min-width: 0;
}

.conv-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.conv-name {
  font-size: 16px;
  font-weight: 500;
  color: #1e293b;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-time {
  font-size: 12px;
  color: #94a3b8;
  margin-left: 8px;
  flex-shrink: 0;
}

.conv-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.conv-preview {
  font-size: 13px;
  color: #94a3b8;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recalled {
  color: #94a3b8;
  font-style: italic;
}

.unread-badge {
  background-color: #ef4444;
  color: #fff;
  font-size: 10px;
  padding: 0 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  margin-left: 8px;
  flex-shrink: 0;
}

.pin-indicator {
  margin-left: 4px;
}

.pin-icon {
  font-size: 12px;
}

.loading-more {
  text-align: center;
  padding: 16px;
  color: #94a3b8;
  font-size: 13px;
}
</style>
