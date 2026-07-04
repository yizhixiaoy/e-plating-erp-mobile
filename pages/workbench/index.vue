<template>
  <view class="wb-container">
    <!-- 顶部欢迎栏 -->
    <view class="wb-header">
      <view class="wb-header-row">
        <view class="wb-avatar">
          <image v-if="userAvatarUrl" :src="userAvatarUrl" class="wb-avatar-img" mode="aspectFill" />
          <text v-else class="wb-avatar-text">{{ avatarInitial }}</text>
        </view>
        <view class="wb-greet">
          <text class="wb-greet-hi">{{ greeting }}，{{ userName }}</text>
          <text class="wb-greet-sub">{{ tenantName }}</text>
        </view>
        <view class="wb-scan" @click="goScan">
          <text class="wb-scan-icon">扫</text>
        </view>
      </view>

      <!-- 统计卡 -->
      <view class="wb-stats">
        <view class="wb-stat" @click="goMessage">
          <text class="wb-stat-num">{{ stats.unreadMessages }}</text>
          <text class="wb-stat-label">未读消息</text>
        </view>
        <view class="wb-stat" @click="goTodo">
          <text class="wb-stat-num">{{ stats.pendingTodos }}</text>
          <text class="wb-stat-label">待办</text>
        </view>
        <view class="wb-stat">
          <text class="wb-stat-num">{{ stats.todayLogs }}</text>
          <text class="wb-stat-label">今日操作</text>
        </view>
        <view class="wb-stat">
          <text class="wb-stat-num">{{ stats.onlineUsers }}</text>
          <text class="wb-stat-label">在线人数</text>
        </view>
      </view>
    </view>

    <!-- 可滚动内容区 -->
    <scroll-view scroll-y class="wb-scroll">
      <!-- 快捷入口 -->
      <view class="wb-card">
        <view class="wb-quick-grid">
          <view class="wb-quick-item" v-for="q in quickAccess" :key="q.key" @click="onQuickClick(q)">
            <view class="wb-quick-icon" :style="{ background: q.color }">
              <text class="wb-quick-icon-text">{{ q.iconText }}</text>
            </view>
            <text class="wb-quick-label">{{ q.label }}</text>
          </view>
        </view>
      </view>

      <!-- 内容 Tab：待办 / 系统通知 / 内部公告 -->
      <view class="wb-card">
        <view class="wb-tabs">
          <view
            v-for="tab in tabs"
            :key="tab.key"
            :class="['wb-tab', currentTab === tab.key ? 'active' : '']"
            @click="currentTab = tab.key"
          >
            <text>{{ tab.label }}</text>
            <text v-if="tab.count > 0" class="wb-tab-badge">{{ tab.count }}</text>
          </view>
        </view>

        <view class="wb-tab-body">
          <!-- 待办 -->
          <block v-if="currentTab === 'todo'">
            <view v-if="todoList.length === 0" class="wb-empty">
              <text>暂无待办</text>
            </view>
            <view
              v-for="t in todoList"
              :key="t.id"
              class="wb-list-row"
              @click="goTodoDetail(t.id)"
            >
              <view class="wb-list-main">
                <text class="wb-list-title">{{ t.title }}</text>
                <text class="wb-list-sub">{{ t.source || "系统" }} · {{ formatTime(t.createTime) }}</text>
              </view>
              <text class="wb-list-tag tag-pending">待处理</text>
            </view>
          </block>

          <!-- 系统通知 / 内部公告 -->
          <block v-else>
            <view v-if="filteredNotices.length === 0" class="wb-empty">
              <text>暂无{{ currentTab === 'sys' ? '系统通知' : '内部公告' }}</text>
            </view>
            <view
              v-for="m in filteredNotices"
              :key="m.noticeId"
              class="wb-list-row"
              @click="goMessageDetail(m.noticeId)"
            >
              <view class="wb-list-main">
                <text class="wb-list-title">{{ m.title }}</text>
                <text class="wb-list-sub">{{ formatTime(m.publishTime) }}</text>
              </view>
              <text v-if="m.readStatus === 0" class="wb-list-tag tag-unread">未读</text>
            </view>
          </block>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import * as http from "../../utils/request.js";
import * as auth from "../../utils/auth.js";
import apiCfg from "../../config/api.js";
import { getImageUrl } from "../../utils/image-url.js";

const userInfo = ref(auth.getUserInfo() || {});
const userName = computed(() => userInfo.value.realName || userInfo.value.username || "用户");
const tenantName = computed(() => userInfo.value.tenantName || userInfo.value.companyName || auth.getTenantCode() || "");
const avatarInitial = computed(() => (userName.value || "U").slice(0, 1).toUpperCase());
const userAvatarUrl = computed(() => getImageUrl(userInfo.value.avatarUrl, "avatar.jpg"));

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return "凌晨好";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
});

const stats = ref({
  unreadMessages: 0,
  pendingTodos: 0,
  todayLogs: 0,
  onlineUsers: 0
});

// 快捷入口：key → 展示样式映射（颜色/图标文字为纯 UI 属性，保留前端）
const QUICK_STYLE = {
  scan:     { color: "#3b82f6", iconText: "扫" },
  ai:       { color: "#8b5cf6", iconText: "AI" },
  chat:     { color: "#06b6d4", iconText: "聊" },
  contacts: { color: "#10b981", iconText: "联" },
  message:  { color: "#f59e0b", iconText: "信" },
  todo:     { color: "#8b5cf6", iconText: "办" }
};
const quickAccess = ref([]);

const currentTab = ref("todo");
const tabs = computed(() => [
  { key: "todo", label: "待办", count: stats.value.pendingTodos },
  { key: "sys", label: "系统通知", count: sysCount.value },
  { key: "notice", label: "内部公告", count: noticeCount.value }
]);

const messages = ref([]);
const todoList = ref([]);

const sysCount = computed(() => messages.value.filter(m => m.readStatus === 0).length);
const noticeCount = computed(() => messages.value.filter(m => m.noticeType === "INTERNAL_NOTICE" && m.readStatus === 0).length);

const filteredNotices = computed(() => {
  if (currentTab.value === "sys") {
    // 系统通知：展示全部类型（system/work/approval/todo 等）
    return messages.value.slice(0, 10);
  }
  // 内部公告：仅展示 INTERNAL_NOTICE 类型
  return messages.value.filter(m => m.noticeType === "INTERNAL_NOTICE").slice(0, 10);
});

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
  return d.toLocaleDateString();
}

async function loadStats() {
  try {
    const res = await http.get(apiCfg.workbench.stats, null, { silent: true });
    if (res && res.data) {
      stats.value = Object.assign({}, stats.value, res.data);
    }
  } catch (e) { /* 后端桩可能未就绪，静默 */ }
}

async function loadMessages() {
  try {
    const res = await http.get(apiCfg.message.list, { pageNum: 1, pageSize: 50 }, { silent: true });
    messages.value = res.data?.records || res.data || [];
    // 兜底统计未读消息（即使 stats 桩失败）
    const unread = messages.value.filter(m => m.readStatus === 0).length;
    if (!stats.value.unreadMessages) stats.value.unreadMessages = unread;
  } catch (e) { messages.value = []; }
}

async function loadTodos() {
  try {
    const res = await http.get(apiCfg.todo.list, { pageNum: 1, pageSize: 20 }, { silent: true });
    todoList.value = res.data?.records || res.data || [];
    if (!stats.value.pendingTodos) stats.value.pendingTodos = todoList.value.length;
  } catch (e) { todoList.value = []; }
}

async function loadQuickAccess() {
  try {
    const res = await http.get(apiCfg.workbench.quickAccess, null, { silent: true });
    const items = res.data || [];
    quickAccess.value = items.map(item => {
      const style = QUICK_STYLE[item.key] || { color: "#6b7280", iconText: "?" };
      return { key: item.key, label: item.label, color: style.color, iconText: style.iconText };
    });
  } catch (e) { /* 兜底：使用全部默认项 */ }
}

const refreshAll = async () => {
  await Promise.all([loadStats(), loadMessages(), loadTodos(), loadQuickAccess()]);
};

function onQuickClick(q) {
  if (q.key === "scan") goScan();
  else if (q.key === "ai") goAiChat();
  else if (q.key === "chat") uni.switchTab({ url: "/pages/chat/list" });
  else if (q.key === "contacts") uni.switchTab({ url: "/pages/contacts/index" });
  else if (q.key === "message") uni.switchTab({ url: "/pages/message/list" });
  else if (q.key === "todo") goTodo();
}

function goScan() {
  uni.navigateTo({ url: "/pages/scan/index" });
}
function goAiChat() {
  uni.navigateTo({ url: "/pages/ai/chat" });
}
function goMessage() {
  uni.switchTab({ url: "/pages/message/list" });
}
function goTodo() {
  uni.navigateTo({ url: "/pages/todo/list" });
}
function goTodoDetail(id) {
  uni.navigateTo({ url: "/pages/todo/detail?id=" + id });
}
function goMessageDetail(id) {
  // noticeId 是 Long，保持字符串
  uni.navigateTo({ url: "/pages/message/detail?id=" + String(id) });
}

onShow(() => {
  if (!auth.getToken()) {
    uni.reLaunch({ url: "/pages/auth/login" });
    return;
  }
  refreshAll();
});

// 下拉刷新
if (typeof uni !== "undefined" && uni.$on) {
  // uni-app 下拉刷新由生命周期函数 onPullDownRefresh 提供，setup 风格暴露：
}
</script>

<script>
// onPullDownRefresh 通过选项式导出（uni-app 兼容）
export default {
  onPullDownRefresh() {
    // 下拉刷新：重新加载数据
    if (this.refreshAll) this.refreshAll();
    Promise.resolve().then(() => uni.stopPullDownRefresh());
  },
};
</script>

<style scoped>
.wb-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-page);
}

.wb-scroll {
  flex: 1;
  min-height: 0;
}

/* ===== 顶部欢迎区 ===== */
.wb-header {
  background: var(--color-gradient);
  padding: 40px 16px 48px;
  color: #fff;
  flex-shrink: 0;
}

.wb-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wb-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.wb-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.wb-avatar-text {
  color: #fff;
  font-size: 20px;
  font-weight: 600;
}

.wb-greet {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.wb-greet-hi {
  font-size: 18px;
  color: #fff;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.wb-greet-sub {
  font-size: 13px;
  color: var(--text-white-secondary);
  margin-top: 3px;
}

.wb-scan {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  backdrop-filter: blur(4px);
}

.wb-scan:active {
  background: rgba(255, 255, 255, 0.3);
  transition: background var(--transition-fast);
}

.wb-scan-icon {
  color: #fff;
  font-size: 14px;
}

/* ===== 统计卡片区 —— 白色卡片悬浮 ===== */
.wb-stats {
  margin-top: 16px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: var(--radius-lg);
  padding: 16px 8px 12px;
  display: flex;
  justify-content: space-around;
  backdrop-filter: blur(8px);
}

.wb-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
}

.wb-stat:active {
  transform: scale(0.95);
  transition: transform var(--transition-fast);
}

.wb-stat-num {
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.wb-stat-label {
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  margin-top: 4px;
}

/* ===== 白色卡片 ===== */
.wb-card {
  margin: -28px 12px 12px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  padding-top: 34px;
  box-shadow: var(--shadow-md);
}

.wb-card + .wb-card {
  margin-top: 12px;
}

.wb-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 14px;
  letter-spacing: 0.2px;
}

/* ===== 快捷入口 ===== */
.wb-quick-grid {
  display: flex;
  flex-wrap: wrap;
}

.wb-quick-item {
  width: 33.33%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 14px;
}

.wb-quick-item:active {
  transform: scale(0.92);
  transition: transform var(--transition-fast);
}

.wb-quick-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  box-shadow: var(--shadow-sm);
}

.wb-quick-icon-text {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
}

.wb-quick-label {
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  line-height: 1.4;
}

/* ===== Tab 切换 ===== */
.wb-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-default);
  margin-bottom: 10px;
}

.wb-tab {
  flex: 1;
  text-align: center;
  padding: 10px 0 14px;
  font-size: 14px;
  color: var(--text-secondary);
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.wb-tab.active {
  color: var(--color-primary);
  font-weight: 600;
}

.wb-tab.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 28px;
  height: 3px;
  background: var(--color-primary);
  border-radius: 2px;
}

.wb-tab-badge {
  background: var(--color-danger);
  color: #fff;
  font-size: 10px;
  padding: 0 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
  line-height: 16px;
}

.wb-tab-body {
  min-height: 100px;
}

.wb-empty {
  text-align: center;
  padding: 32px 0;
  color: var(--text-tertiary);
  font-size: 13px;
  animation: fadeIn 0.3s ease;
}

/* ===== 列表项 ===== */
.wb-list-row {
  display: flex;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-light);
}

.wb-list-row:last-child {
  border-bottom: none;
}

.wb-list-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-list-title {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
}

.wb-list-sub {
  font-size: 12px;
  color: var(--text-tertiary);
}

.wb-list-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  margin-left: 8px;
  font-weight: 500;
}

.tag-pending {
  background: #dbeafe;
  color: #3b82f6;
}

.tag-unread {
  background: #fee2e2;
  color: #ef4444;
}
</style>
