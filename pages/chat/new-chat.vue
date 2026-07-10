<template>
  <view class="new-chat-container">
    <!-- 模式切换 -->
    <view class="mode-tabs">
      <view :class="['mode-tab', mode === 'single' ? 'active' : '']" @click="mode = 'single'">
        <text>发起单聊</text>
      </view>
      <view :class="['mode-tab', mode === 'group' ? 'active' : '']" @click="mode = 'group'">
        <text>创建群聊</text>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <input class="search-input" placeholder="搜索成员" v-model="keyword" @input="onSearch" />
    </view>

    <!-- 已选成员 -->
    <view v-if="selected.length > 0" class="selected-bar">
      <scroll-view scroll-x class="selected-scroll">
        <view class="selected-list">
          <view v-for="m in selected" :key="m.id" class="selected-chip">
            <text class="chip-name">{{ m.realName || m.username }}</text>
            <text class="chip-remove" @click="removeSelected(m)">✕</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 群名称 -->
    <view v-if="mode === 'group'" class="group-name-row">
      <input class="group-name-input" placeholder="输入群名称" v-model="groupName" maxlength="64" />
    </view>

    <!-- 搜索结果 -->
    <scroll-view scroll-y class="result-list">
      <view v-if="searching" class="loading-more">
        <text>搜索中...</text>
      </view>

      <view v-if="!searching && results.length === 0 && keyword.trim()" class="empty-state">
        <text class="empty-text">未找到匹配的成员</text>
      </view>

      <view v-for="item in results" :key="item.id" class="result-item" @click="selectMember(item)">
        <view class="result-avatar">
          <image v-if="getImageUrl(item.avatarUrl)" :src="getAvatarSrc(item)" class="result-avatar-img" mode="aspectFill" />
          <text v-else class="avatar-char">{{ (item.realName || item.username || 'U').slice(0, 1) }}</text>
        </view>
        <view class="result-info">
          <text class="result-name">{{ item.realName || item.username }}</text>
          <text class="result-dept">{{ item.deptName || '' }}</text>
        </view>
        <view v-if="isSelected(item)" class="check-mark">
          <text>✓</text>
        </view>
      </view>
    </scroll-view>

    <!-- 底部按钮 -->
    <view class="bottom-bar">
      <view :class="['create-btn', canCreate ? 'create-active' : '']" @click="createChat">
        <text>{{ mode === 'single' ? '开始聊天' : '创建群聊' }}{{ selected.length > 0 ? '(' + selected.length + ')' : '' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import * as http from "../../utils/request.js";
import * as auth from "../../utils/auth.js";
import apiCfg from "../../config/api.js";
import { getImageUrl } from "../../utils/image-url.js";
import { preloadImages } from "../../utils/image-preloader.js";

const mode = ref("single");
const keyword = ref("");
const results = ref([]);
const selected = ref([]);
const groupName = ref("");
const searching = ref(false);

let searchTimer = null;

// 头像预加载：URL -> 本地路径映射
const avatarMap = ref({});

function getAvatarSrc(item) {
  const remoteUrl = getImageUrl(item.avatarUrl);
  return avatarMap.value[remoteUrl] || remoteUrl;
}

const canCreate = computed(() => {
  if (mode.value === "single") return selected.value.length === 1;
  return selected.value.length >= 2 && groupName.value.trim().length > 0;
});

function onSearch() {
  clearTimeout(searchTimer);
  if (!keyword.value.trim()) {
    results.value = [];
    return;
  }
  searchTimer = setTimeout(doSearch, 300);
}

async function doSearch() {
  const kw = keyword.value.trim();
  if (!kw) return;
  searching.value = true;
  try {
    const res = await http.get(apiCfg.chat.contactsSearch, { keyword: kw, limit: 20 }, { silent: true });
    results.value = res.data || [];

    // 预加载头像
    preloadResultAvatars(results.value);
  } catch (e) {
    results.value = [];
  } finally {
    searching.value = false;
  }
}

async function preloadResultAvatars(userList) {
  const urls = userList
    .map(u => getImageUrl(u.avatarUrl))
    .filter(Boolean);
  if (!urls.length) return;
  try {
    const results = await preloadImages(urls);
    const map = { ...avatarMap.value };
    results.forEach((localPath, url) => { map[url] = localPath; });
    avatarMap.value = map;
  } catch (e) {
    console.warn('[new-chat] avatar preload failed:', e);
  }
}

function selectMember(item) {
  if (mode.value === "single") {
    selected.value = [item];
    createChat();
  } else {
    const idx = selected.value.findIndex(m => m.id === item.id);
    if (idx >= 0) {
      selected.value.splice(idx, 1);
    } else {
      selected.value.push(item);
    }
  }
}

function removeSelected(item) {
  selected.value = selected.value.filter(m => m.id !== item.id);
}

function isSelected(item) {
  return selected.value.some(m => m.id === item.id);
}

async function createChat() {
  if (!canCreate.value) return;
  try {
    if (mode.value === "single") {
      const peerUserId = selected.value[0].id;
      const res = await http.post(apiCfg.chat.createSingle, { peerUserId });
      const conv = res.data;
      const name = encodeURIComponent(selected.value[0].realName || selected.value[0].username || "聊天");
      // 传递会话元数据，避免 conversation.vue 额外调用 conversationDetail API
      const meta = encodeURIComponent(JSON.stringify({
        peerUserId: selected.value[0].id,
        peerAvatar: selected.value[0].avatarUrl || "",
        memberCount: conv.memberCount || 2,
        pinned: 0,
        muted: 0
      }));
      uni.redirectTo({ url: "/pages/chat/conversation?id=" + conv.id + "&name=" + name + "&convType=SINGLE&meta=" + meta });
    } else {
      const res = await http.post(apiCfg.chat.createGroup, {
        name: groupName.value.trim(),
        memberIds: selected.value.map(m => m.id)
      });
      const conv = res.data;
      const name = encodeURIComponent(groupName.value.trim());
      // 传递会话元数据，避免 conversation.vue 额外调用 conversationDetail API
      const meta = encodeURIComponent(JSON.stringify({
        memberCount: conv.memberCount || 0,
        pinned: 0,
        muted: 0
      }));
      uni.redirectTo({ url: "/pages/chat/conversation?id=" + conv.id + "&name=" + name + "&convType=GROUP&meta=" + meta });
    }
  } catch (e) {
    uni.showToast({ title: "创建失败", icon: "none" });
  }
}
</script>

<style scoped>
.new-chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-page);
}

.mode-tabs {
  display: flex;
  background: var(--bg-card);
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
}

.mode-tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
  border-radius: var(--radius-full);
  background: var(--bg-input);
  transition: all var(--transition-fast);
}

.mode-tab.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.search-bar {
  padding: 12px 16px;
  background: var(--bg-card);
}

.search-input {
  background: var(--bg-input);
  border-radius: var(--radius-full);
  padding: 10px 16px;
  font-size: 14px;
  color: var(--text-primary);
}

.selected-bar {
  background: var(--bg-card);
  padding: 0 16px 12px;
  border-bottom: 1px solid var(--border-light);
}

.selected-scroll {
  white-space: nowrap;
}

.selected-list {
  display: inline-flex;
  gap: 8px;
}

.selected-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #eff6ff;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  border: 1px solid #bfdbfe;
}

.chip-name {
  font-size: 13px;
  color: var(--color-primary);
  font-weight: 500;
}

.chip-remove {
  font-size: 14px;
  color: var(--color-primary);
  padding: 0 2px;
  cursor: pointer;
}

.group-name-row {
  padding: 12px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
}

.group-name-input {
  background: var(--bg-input);
  border-radius: var(--radius-md);
  padding: 10px 16px;
  font-size: 14px;
  color: var(--text-primary);
}

.result-list {
  flex: 1;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-text {
  color: var(--text-tertiary);
  font-size: 14px;
}

.loading-more {
  text-align: center;
  padding: 16px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.result-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
  transition: background var(--transition-fast);
}

.result-item:active {
  background: var(--bg-hover);
}

.result-avatar {
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

.result-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.avatar-char {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-name {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
  display: block;
}

.result-dept {
  font-size: 12px;
  color: var(--text-tertiary);
  display: block;
  margin-top: 2px;
}

.check-mark {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.check-mark text {
  color: #fff;
  font-size: 14px;
}

.bottom-bar {
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: var(--bg-card);
  border-top: 1px solid var(--border-default);
}

.create-btn {
  padding: 13px;
  border-radius: var(--radius-lg);
  background: var(--border-strong);
  text-align: center;
  transition: all var(--transition-fast);
}

.create-active {
  background: var(--color-gradient);
  box-shadow: var(--shadow-md);
}

.create-btn:active {
  transform: scale(0.98);
}

.create-btn text {
  font-size: 15px;
  color: #fff;
  font-weight: 600;
}
</style>
