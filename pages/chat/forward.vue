<template>
  <view class="forward-container">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <input class="search-input" placeholder="搜索会话" v-model="keyword" @input="onSearch" />
    </view>

    <!-- 会话列表 -->
    <scroll-view scroll-y class="conv-list">
      <view v-if="loading" class="loading-more">
        <text>加载中...</text>
      </view>

      <view v-if="!loading && conversations.length === 0" class="empty-state">
        <text class="empty-text">暂无可转发的会话</text>
      </view>

      <view
        v-for="item in filteredList"
        :key="item.id"
        class="conv-item"
        @click="toggleSelect(item)"
      >
        <view class="conv-avatar">
          <image v-if="getImageUrl(item.peerAvatar || item.avatar)" :src="getAvatarSrc(item)" class="conv-avatar-img" mode="aspectFill" />
          <text v-else class="avatar-text">{{ getAvatarText(item) }}</text>
        </view>
        <view class="conv-info">
          <text class="conv-name">{{ getConvName(item) }}</text>
          <text class="conv-type">{{ item.convType === 'SINGLE' ? '单聊' : '群聊' }}</text>
        </view>
        <view :class="['check-box', isSelected(item) ? 'checked' : '']">
          <text v-if="isSelected(item)">✓</text>
        </view>
      </view>
    </scroll-view>

    <!-- 底部按钮 -->
    <view class="bottom-bar">
      <view :class="['send-btn', selected.length > 0 ? 'send-active' : '']" @click="doForward">
        <text>转发{{ selected.length > 0 ? '(' + selected.length + ')' : '' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import * as http from "../../utils/request.js";
import apiCfg from "../../config/api.js";
import { getImageUrl } from "../../utils/image-url.js";
import { preloadImages } from "../../utils/image-preloader.js";

const conversations = ref([]);
const selected = ref([]);
const keyword = ref("");
const loading = ref(true);
const messageData = ref(null);

// 头像预加载：URL -> 本地路径映射
const avatarMap = ref({});

function getAvatarSrc(item) {
  const remoteUrl = getImageUrl(item.peerAvatar || item.avatar);
  return avatarMap.value[remoteUrl] || remoteUrl;
}

const filteredList = computed(() => {
  if (!keyword.value.trim()) return conversations.value;
  const kw = keyword.value.trim().toLowerCase();
  return conversations.value.filter(c => getConvName(c).toLowerCase().includes(kw));
});

onLoad((query) => {
  if (query.data) {
    try {
      messageData.value = JSON.parse(decodeURIComponent(query.data));
    } catch (e) { /* ignore */ }
  }
  loadConversations();
});

function onSearch() {}

async function loadConversations() {
  loading.value = true;
  try {
    const res = await http.get(apiCfg.chat.conversations, { pageNum: 1, pageSize: 100 }, { silent: true });
    conversations.value = res.data?.records || res.data || [];

    // 预加载头像
    preloadConvAvatars(conversations.value);
  } catch (e) {
    conversations.value = [];
  } finally {
    loading.value = false;
  }
}

async function preloadConvAvatars(convList) {
  const urls = convList
    .map(c => getImageUrl(c.peerAvatar || c.avatar))
    .filter(Boolean);
  if (!urls.length) return;
  try {
    const results = await preloadImages(urls);
    const map = { ...avatarMap.value };
    results.forEach((localPath, url) => { map[url] = localPath; });
    avatarMap.value = map;
  } catch (e) {
    console.warn('[forward] avatar preload failed:', e);
  }
}

function getConvName(item) {
  if (item.convType === "SINGLE") return item.peerName || item.name || "未命名";
  return item.name || "群聊";
}

function getAvatarText(item) {
  return getConvName(item).slice(0, 1).toUpperCase();
}

function toggleSelect(item) {
  const idx = selected.value.findIndex(s => s.id === item.id);
  if (idx >= 0) {
    selected.value.splice(idx, 1);
  } else {
    selected.value.push(item);
  }
}

function isSelected(item) {
  return selected.value.some(s => s.id === item.id);
}

async function doForward() {
  if (selected.value.length === 0 || !messageData.value) return;
  try {
    for (const conv of selected.value) {
      await http.post(apiCfg.chat.send, {
        conversationId: conv.id,
        msgType: messageData.value.msgType,
        content: messageData.value.content,
        extraJson: messageData.value.extraJson
      });
    }
    uni.showToast({ title: "转发成功", icon: "success" });
    setTimeout(() => { uni.navigateBack(); }, 1000);
  } catch (e) {
    uni.showToast({ title: "转发失败", icon: "none" });
  }
}
</script>

<style scoped>
.forward-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-page);
}

.search-bar {
  padding: 12px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
}

.search-input {
  background: var(--bg-input);
  border-radius: var(--radius-full);
  padding: 10px 16px;
  font-size: 14px;
  color: var(--text-primary);
}

.conv-list {
  flex: 1;
}

.loading-more {
  text-align: center;
  padding: 16px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-text {
  color: var(--text-tertiary);
  font-size: 14px;
}

.conv-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
  transition: background var(--transition-fast);
}

.conv-item:active {
  background: var(--bg-hover);
}

.conv-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.conv-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.avatar-text {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.conv-info {
  flex: 1;
  min-width: 0;
}

.conv-name {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
  display: block;
}

.conv-type {
  font-size: 12px;
  color: var(--text-tertiary);
  display: block;
  margin-top: 2px;
}

.check-box {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.check-box.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.check-box text {
  color: #fff;
  font-size: 14px;
}

.bottom-bar {
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: var(--bg-card);
  border-top: 1px solid var(--border-default);
}

.send-btn {
  padding: 13px;
  border-radius: var(--radius-lg);
  background: var(--border-strong);
  text-align: center;
  transition: all var(--transition-fast);
}

.send-active {
  background: var(--color-gradient);
  box-shadow: var(--shadow-md);
}

.send-btn:active {
  transform: scale(0.98);
}

.send-btn text {
  font-size: 15px;
  color: #fff;
  font-weight: 600;
}
</style>
