<template>
  <view class="wb-container">
    <!-- 顶部欢迎栏 -->
    <view class="wb-header">
      <view class="wb-header-row">
        <view class="wb-avatar">
          <text class="wb-avatar-text">{{ avatarInitial }}</text>
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

    <!-- 快捷入口 -->
    <view class="wb-card">
      <view class="wb-card-title">
        <text>快捷入口</text>
      </view>
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
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import * as http from "../../utils/request.js";
import * as auth from "../../utils/auth.js";
import apiCfg from "../../config/api.js";

const userInfo = ref(auth.getUserInfo() || {});
const userName = computed(() => userInfo.value.realName || userInfo.value.username || "用户");
const tenantName = computed(() => userInfo.value.tenantName || auth.getTenantCode() || "");
const avatarInitial = computed(() => (userName.value || "U").slice(0, 1).toUpperCase());

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

const quickAccess = ref([
  { key: "scan", label: "扫一扫", color: "#3b82f6", iconText: "扫" },
  { key: "chat", label: "聊天", color: "#06b6d4", iconText: "聊" },
  { key: "contacts", label: "通讯录", color: "#10b981", iconText: "联" },
  { key: "message", label: "消息", color: "#f59e0b", iconText: "信" },
  { key: "todo", label: "待办", color: "#8b5cf6", iconText: "办" }
]);

const currentTab = ref("todo");
const tabs = computed(() => [
  { key: "todo", label: "待办", count: stats.value.pendingTodos },
  { key: "sys", label: "系统通知", count: sysCount.value },
  { key: "notice", label: "内部公告", count: noticeCount.value }
]);

const messages = ref([]);
const todoList = ref([]);

const sysCount = computed(() => messages.value.filter(m => m.noticeType === "SYS_UPDATE" && m.readStatus === 0).length);
const noticeCount = computed(() => messages.value.filter(m => m.noticeType === "INTERNAL_NOTICE" && m.readStatus === 0).length);

const filteredNotices = computed(() => {
  const type = currentTab.value === "sys" ? "SYS_UPDATE" : "INTERNAL_NOTICE";
  return messages.value.filter(m => m.noticeType === type).slice(0, 10);
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
    const res = await http.get(apiCfg.message.list, null, { silent: true });
    messages.value = res.data || [];
    // 兜底统计未读消息（即使 stats 桩失败）
    const unread = messages.value.filter(m => m.readStatus === 0).length;
    if (!stats.value.unreadMessages) stats.value.unreadMessages = unread;
  } catch (e) { messages.value = []; }
}

async function loadTodos() {
  try {
    const res = await http.get(apiCfg.todo.list, null, { silent: true });
    todoList.value = res.data || [];
    if (!stats.value.pendingTodos) stats.value.pendingTodos = todoList.value.length;
  } catch (e) { todoList.value = []; }
}

async function refreshAll() {
  await Promise.all([loadStats(), loadMessages(), loadTodos()]);
}

function onQuickClick(q) {
  if (q.key === "scan") goScan();
  else if (q.key === "chat") uni.switchTab({ url: "/pages/chat/list" });
  else if (q.key === "contacts") uni.switchTab({ url: "/pages/contacts/index" });
  else if (q.key === "message") uni.switchTab({ url: "/pages/message/list" });
  else if (q.key === "todo") goTodo();
}

function goScan() {
  uni.navigateTo({ url: "/pages/scan/index" });
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

onMounted(() => {
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
// onPullDownRefresh / onShow 通过选项式导出（uni-app 兼容）
export default {
  onPullDownRefresh() {
    Promise.resolve().then(() => uni.stopPullDownRefresh());
  },
  onShow() {
    // 切换 Tab 回到工作台时刷新
  }
};
</script>

<style scoped>
.wb-container {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 24px;
}

.wb-header {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  padding: 32px 16px 60px;
  color: #fff;
}

.wb-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wb-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.wb-avatar-text {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.wb-greet {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.wb-greet-hi {
  font-size: 16px;
  color: #fff;
  font-weight: 500;
}

.wb-greet-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 2px;
}

.wb-scan {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.wb-scan-icon {
  color: #fff;
  font-size: 14px;
}

.wb-stats {
  margin-top: 20px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 14px 8px;
  display: flex;
  justify-content: space-around;
}

.wb-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.wb-stat-num {
  color: #fff;
  font-size: 20px;
  font-weight: 600;
}

.wb-stat-label {
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
  margin-top: 4px;
}

.wb-card {
  margin: -36px 12px 12px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.wb-card + .wb-card {
  margin-top: 12px;
}

.wb-card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 12px;
}

.wb-quick-grid {
  display: flex;
  flex-wrap: wrap;
}

.wb-quick-item {
  width: 20%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 8px;
}

.wb-quick-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.wb-quick-icon-text {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.wb-quick-label {
  font-size: 12px;
  color: #475569;
}

.wb-tabs {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 8px;
}

.wb-tab {
  flex: 1;
  text-align: center;
  padding: 8px 0 12px;
  font-size: 14px;
  color: #64748b;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.wb-tab.active {
  color: #3b82f6;
  font-weight: 500;
}

.wb-tab.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  background: #3b82f6;
}

.wb-tab-badge {
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  padding: 0 6px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
}

.wb-tab-body {
  min-height: 100px;
}

.wb-empty {
  text-align: center;
  padding: 32px 0;
  color: #94a3b8;
  font-size: 13px;
}

.wb-list-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
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
  font-size: 14px;
  color: #1e293b;
}

.wb-list-sub {
  font-size: 12px;
  color: #94a3b8;
}

.wb-list-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
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
