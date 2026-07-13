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
          <image v-if="getAvatarSrc(item)" :src="getAvatarSrc(item)" class="conv-avatar-img" mode="aspectFill" @error="onConvAvatarError(item)" />
          <text v-else class="avatar-text">{{ getAvatarText(item) }}</text>
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
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { onShow } from "@dcloudio/uni-app";
import * as http from "../../utils/request.js";
import * as auth from "../../utils/auth.js";
import apiCfg from "../../config/api.js";
import { getImageUrl } from "../../utils/image-url.js";
import { preloadImages } from "../../utils/image-preloader.js";

const conversations = ref([]);
const currentTab = ref("all");
const keyword = ref("");
const loading = ref(false);
const refreshing = ref(false);
const pageNum = ref(1);
const hasMore = ref(true);
let pollTimer = null;
let searchTimer = null;

// 头像预加载：URL -> 本地路径映射
const avatarMap = ref({});

/** 获取会话头像的显示路径 */
function getAvatarSrc(item) {
  const remoteUrl = getImageUrl(item.peerAvatar || item.avatar);
  return avatarMap.value[remoteUrl] || "";
}

/** 头像加载失败时清除缓存，回退到文字头像 */
function onConvAvatarError(item) {
  const remoteUrl = getImageUrl(item.peerAvatar || item.avatar);
  if (remoteUrl) {
    const map = { ...avatarMap.value };
    delete map[remoteUrl];
    avatarMap.value = map;
  }
}

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
  if (!time) return "—";
  const d = new Date(time);
  if (isNaN(d.getTime())) return "—";
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
    const params = {
      pageNum: pageNum.value,
      pageSize: 20
    };
    const kw = keyword.value.trim();
    if (kw) params.keyword = kw;
    const res = await http.get(apiCfg.chat.conversations, params, { silent: true });
    const list = res.data?.records || res.data || [];
    if (refresh || pageNum.value === 1) {
      conversations.value = list;
    } else {
      conversations.value = [...conversations.value, ...list];
    }
    hasMore.value = list.length >= 20;
    if (refresh) refreshing.value = false;

    // 预加载头像
    preloadConvAvatars(refresh || pageNum.value === 1 ? conversations.value : list);
  } catch (e) {
    if (refresh) refreshing.value = false;
  } finally {
    loading.value = false;
  }
}

/** 批量预加载会话头像 */
async function preloadConvAvatars(convList) {
  const urls = convList
    .map(c => getImageUrl(c.peerAvatar || c.avatar))
    .filter(Boolean);
  if (!urls.length) return;
  try {
    const results = await preloadImages(urls);
    const map = { ...avatarMap.value };
    results.forEach((localPath, url) => {
      map[url] = localPath;
    });
    avatarMap.value = map;
  } catch (e) {
    console.warn('[chat] avatar preload failed:', e);
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
  // 将完整会话元数据编码到 URL，避免 conversation.vue 额外调用 conversationDetail API
  // Web 端 selectConversation(c) 直接使用列表中的 ConversationView，从不调用 conversationDetail
  const meta = encodeURIComponent(JSON.stringify({
    peerUserId: item.peerUserId,
    peerAvatar: item.peerAvatar || "",
    memberCount: item.memberCount || 0,
    pinned: item.pinned || 0,
    muted: item.muted || 0
  }));
  const url = "/pages/chat/conversation?id=" + item.id + "&name=" + name + "&convType=" + item.convType + "&meta=" + meta;
  uni.navigateTo({
    url: url,
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

// 实时搜索：输入变化 300ms 后自动触发
watch(keyword, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadConversations(true);
  }, 300);
});

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

onShow(() => {
  loadConversations(true);
});
</script>

<style scoped>
.chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--bg-page);
}

/* ===== 顶部导航 ===== */
.header {
  background: var(--color-gradient);
  padding: calc(var(--status-bar-height) + 16px) 20px 16px;
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
  gap: 12px;
}

.action-icon {
  font-size: 26px;
  color: #fff;
  width: 36px;
  height: 36px;
  text-align: center;
  line-height: 36px;
  background: rgba(255,255,255,0.15);
  border-radius: 50%;
}

.action-icon:active {
  background: rgba(255,255,255,0.25);
  transition: background var(--transition-fast);
}

/* ===== 搜索栏 —— 独立白色卡片 ===== */
.search-bar {
  padding: 12px 16px 8px;
  background: var(--bg-page);
  flex-shrink: 0;
}

.search-input {
  background: var(--bg-card);
  border-radius: var(--radius-full);
  padding: 10px 16px;
  font-size: 14px;
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
  width: 100%;
  box-sizing: border-box;
  height: 40px;
}

.search-input::placeholder {
  color: var(--text-tertiary);
  font-size: 13px;
}

/* ===== 筛选 Tab —— 胶囊 pill 风格 ===== */
.filter-tabs {
  display: flex;
  background-color: var(--bg-card);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  gap: 6px;
  overflow-x: auto;
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
}

/* ===== 会话列表 ===== */
.conv-list {
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

.conv-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  background-color: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
  position: relative;
}

.conv-item:active {
  background-color: var(--bg-hover);
  transition: background-color var(--transition-fast);
}

.conv-item.pinned {
  background-color: #fffbeb;
}

.conv-item.pinned::before {
  content: "📌";
  position: absolute;
  left: 48px;
  font-size: 10px;
  opacity: 0.6;
}

.conv-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--color-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.conv-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.avatar-text {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.mute-indicator {
  position: absolute;
  bottom: -1px;
  right: -1px;
  background: var(--bg-card);
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-card);
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
  color: var(--text-primary);
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
  color: var(--text-tertiary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recalled {
  color: var(--text-tertiary);
  font-style: italic;
}

/* 微信风格红点 badge */
.unread-badge {
  background: var(--color-danger);
  color: #fff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  margin-left: 8px;
  flex-shrink: 0;
  font-weight: 600;
}

.pin-indicator {
  margin-left: 4px;
}

.pin-icon {
  font-size: 14px;
}

.loading-more {
  text-align: center;
  padding: 16px;
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
