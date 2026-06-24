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
          <text class="avatar-char">{{ (item.realName || item.username || 'U').slice(0, 1) }}</text>
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

const mode = ref("single");
const keyword = ref("");
const results = ref([]);
const selected = ref([]);
const groupName = ref("");
const searching = ref(false);

let searchTimer = null;

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
  } catch (e) {
    results.value = [];
  } finally {
    searching.value = false;
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
      uni.redirectTo({ url: "/pages/chat/conversation?id=" + conv.id + "&name=" + name + "&convType=SINGLE" });
    } else {
      const res = await http.post(apiCfg.chat.createGroup, {
        name: groupName.value.trim(),
        memberIds: selected.value.map(m => m.id)
      });
      const conv = res.data;
      const name = encodeURIComponent(groupName.value.trim());
      uni.redirectTo({ url: "/pages/chat/conversation?id=" + conv.id + "&name=" + name + "&convType=GROUP" });
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
  height: 100vh;
  background-color: #f5f7fa;
}

.mode-tabs {
  display: flex;
  background: #fff;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.mode-tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 14px;
  color: #64748b;
  border-radius: 8px;
}

.mode-tab.active {
  background: #3b82f6;
  color: #fff;
  font-weight: 500;
}

.search-bar {
  padding: 12px 16px;
  background: #fff;
}

.search-input {
  background: #f1f5f9;
  border-radius: 20px;
  padding: 10px 16px;
  font-size: 14px;
}

.selected-bar {
  background: #fff;
  padding: 0 16px 12px;
  border-bottom: 1px solid #e2e8f0;
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
  background: #dbeafe;
  padding: 4px 10px;
  border-radius: 16px;
}

.chip-name {
  font-size: 13px;
  color: #3b82f6;
}

.chip-remove {
  font-size: 12px;
  color: #3b82f6;
  padding: 0 2px;
}

.group-name-row {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.group-name-input {
  background: #f1f5f9;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
}

.result-list {
  flex: 1;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-text {
  color: #94a3b8;
  font-size: 14px;
}

.loading-more {
  text-align: center;
  padding: 16px;
  color: #94a3b8;
  font-size: 13px;
}

.result-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #f1f5f9;
}

.result-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.avatar-char {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.result-info {
  flex: 1;
}

.result-name {
  font-size: 15px;
  color: #1e293b;
  display: block;
}

.result-dept {
  font-size: 12px;
  color: #94a3b8;
  display: block;
  margin-top: 2px;
}

.check-mark {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-mark text {
  color: #fff;
  font-size: 14px;
}

.bottom-bar {
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #e2e8f0;
}

.create-btn {
  padding: 12px;
  border-radius: 24px;
  background: #e2e8f0;
  text-align: center;
}

.create-active {
  background: #3b82f6;
}

.create-btn text {
  font-size: 15px;
  color: #fff;
  font-weight: 500;
}
</style>
