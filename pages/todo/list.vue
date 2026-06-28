<template>
  <view class="todo-container">
    <!-- 顶部 -->
    <view class="header">
      <text class="title">我的待办</text>
      <view class="header-actions">
        <text class="action-text" @click="loadStats">刷新</text>
      </view>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-row">
      <view class="stat-card">
        <text class="stat-num">{{ stats.pending || 0 }}</text>
        <text class="stat-label">待处理</text>
      </view>
      <view class="stat-card">
        <text class="stat-num warn">{{ stats.overdue || 0 }}</text>
        <text class="stat-label">已逾期</text>
      </view>
      <view class="stat-card">
        <text class="stat-num">{{ stats.todayNew || 0 }}</text>
        <text class="stat-label">今日新增</text>
      </view>
      <view class="stat-card">
        <text class="stat-num done">{{ stats.done || 0 }}</text>
        <text class="stat-label">已处理</text>
      </view>
    </view>

    <!-- 筛选标签 -->
    <view class="filter-tabs">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        :class="['tab', currentTab === tab.value ? 'active' : '']"
        @click="onTabChange(tab.value)"
      >
        <text>{{ tab.label }}</text>
        <text v-if="tab.count > 0" class="badge">{{ tab.count }}</text>
      </view>
    </view>

    <!-- 待办列表 -->
    <scroll-view scroll-y class="todo-list" @scrolltolower="loadMore">
      <view v-if="rows.length === 0 && !loading" class="empty-state">
        <text class="empty-text">暂无待办事项</text>
      </view>

      <view
        v-for="item in rows"
        :key="item.id"
        :class="['todo-item', item.readStatus === 0 ? 'unread' : '']"
        @click="goToDetail(item)"
      >
        <view class="todo-header">
          <view class="todo-type">
            <text :class="['type-tag', getTypeClass(item.todoType)]">
              {{ getTypeLabel(item.todoType) }}
            </text>
            <text v-if="item.priority >= 2" :class="['priority-tag', priorityClass(item.priority)]">
              {{ getPriorityLabel(item.priority) }}
            </text>
          </view>
          <text class="todo-time">{{ formatTime(item.createdAt) }}</text>
        </view>

        <view class="todo-content">
          <text class="todo-title">{{ item.title }}</text>
          <text class="todo-desc">{{ item.content }}</text>
        </view>

        <view class="todo-footer">
          <view class="todo-source">
            <text class="source-text">{{ item.bizModule || '系统' }}</text>
            <text v-if="item.deadline" :class="['deadline', isOverdue(item) ? 'overdue' : '']">
              {{ isOverdue(item) ? '已逾期 ' : '截止：' }}{{ formatTime(item.deadline) }}
            </text>
          </view>
          <view :class="['todo-status', getStatusClass(item.status)]">
            <text>{{ getStatusLabel(item.status) }}</text>
          </view>
        </view>
      </view>

      <view v-if="loading" class="loading-more">
        <text>加载中...</text>
      </view>
      <view v-else-if="rows.length > 0 && !hasMore" class="loading-more">
        <text>没有更多了</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
import * as http from "../../utils/request.js";
import * as dict from "../../utils/dict.js";
import apiCfg from "../../config/api.js";

const rows = ref([]);
const stats = ref({});
const loading = ref(false);
const pageNum = ref(1);
const pageSize = ref(20);
const total = ref(0);
const hasMore = ref(true);
const currentTab = ref("pending");

const todoTypeItems = ref([]);
const todoPriorityItems = ref([]);
const todoStatusItems = ref([]);

const tabs = ref([
  { label: "待处理", value: "pending", count: 0 },
  { label: "已处理", value: "done", count: 0 },
  { label: "全部", value: "all", count: 0 }
]);

function getTypeClass(type) {
  const map = { APPROVAL: "type-approval", TASK: "type-task", REMIND: "type-notice", CC: "type-cc" };
  return map[type] || "type-task";
}
function getTypeLabel(type) {
  return dict.getDictLabel(todoTypeItems.value, type) || type || "";
}
function getStatusClass(status) {
  return ["status-pending", "status-done", "status-ignored", "status-transferred"][status] || "status-pending";
}
function getStatusLabel(status) {
  return dict.getDictLabel(todoStatusItems.value, status) || ["待处理", "已处理", "已忽略", "已转交"][status] || "";
}
function getPriorityLabel(p) {
  return dict.getDictLabel(todoPriorityItems.value, p) || ["低", "中", "高", "紧急"][p] || "";
}
function priorityClass(p) {
  return ["", "", "high", "urgent"][p] || "";
}
function isOverdue(item) {
  if (!item.deadline || item.status !== 0) return false;
  return new Date(item.deadline).getTime() < Date.now();
}
function formatTime(time) {
  if (!time) return "";
  const date = new Date(time);
  const diff = Date.now() - date.getTime();
  if (diff > 0 && diff < 60000) return "刚刚";
  if (diff > 0 && diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
  if (diff > 0 && diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function buildParams() {
  const p = { pageNum: pageNum.value, pageSize: pageSize.value };
  if (currentTab.value === "pending") p.status = 0;
  else if (currentTab.value === "done") p.status = 1;
  return p;
}

async function load(reset) {
  if (loading.value) return;
  loading.value = true;
  if (reset) {
    pageNum.value = 1;
    rows.value = [];
    hasMore.value = true;
  }
  try {
    const res = await http.get(apiCfg.todo.list, buildParams(), { silent: true });
    const data = res.data || {};
    const records = data.records || data.list || data || [];
    if (reset) rows.value = records;
    else rows.value = rows.value.concat(records);
    total.value = data.total || 0;
    hasMore.value = rows.value.length < total.value;
  } catch (e) {
    if (reset) rows.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  try {
    const res = await http.get(apiCfg.todo.stats, null, { silent: true });
    stats.value = res.data || {};
    tabs.value[0].count = stats.value.pending || 0;
    tabs.value[1].count = stats.value.done || 0;
    tabs.value[2].count = (stats.value.pending || 0) + (stats.value.done || 0)
        + (stats.value.ignored || 0) + (stats.value.transferred || 0);
  } catch (e) {
    stats.value = {};
  }
}

function loadMore() {
  if (loading.value || !hasMore.value) return;
  pageNum.value += 1;
  load(false);
}

function onTabChange(v) {
  if (currentTab.value === v) return;
  currentTab.value = v;
  load(true);
}

function goToDetail(item) {
  uni.navigateTo({ url: `/pages/todo/detail?id=${item.id}` });
}

async function loadDicts() {
  const [t, p, s] = await Promise.all([
    dict.fetchDictData("todo_type"),
    dict.fetchDictData("todo_priority"),
    dict.fetchDictData("todo_status")
  ]);
  todoTypeItems.value = t;
  todoPriorityItems.value = p;
  todoStatusItems.value = s;
}

onMounted(async () => {
  await loadDicts();
  await loadStats();
  await load(true);
});
</script>

<style scoped>
.todo-container { height: 100%; display: flex; flex-direction: column; overflow: hidden; background-color: #f5f7fa; }
.header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 40px 20px 20px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.title { font-size: 20px; font-weight: bold; color: #fff; }
.header-actions { padding: 4px 12px; }
.action-text { color: #fff; font-size: 14px; opacity: 0.9; }

.stats-row { display: flex; gap: 8px; padding: 12px; background: #fff; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
.stat-card { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px 0; background: #f8fafc; border-radius: 8px; }
.stat-num { font-size: 18px; font-weight: bold; color: #3b82f6; }
.stat-num.warn { color: #ef4444; }
.stat-num.done { color: #10b981; }
.stat-label { font-size: 11px; color: #94a3b8; margin-top: 2px; }

.filter-tabs { display: flex; background-color: #fff; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
.tab { flex: 1; text-align: center; padding: 8px 0; font-size: 14px; color: #64748b; position: relative; display: flex; align-items: center; justify-content: center; gap: 4px; }
.tab.active { color: #3b82f6; font-weight: 500; }
.tab.active::after { content: ""; position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); width: 24px; height: 2px; background-color: #3b82f6; }
.badge { background-color: #ef4444; color: #fff; font-size: 10px; padding: 0 6px; border-radius: 10px; min-width: 16px; text-align: center; }

.todo-list { padding: 12px; flex: 1; min-height: 0; }
.empty-state { text-align: center; padding: 60px 20px; }
.empty-text { color: #94a3b8; font-size: 14px; }

.todo-item { background-color: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); position: relative; }
.todo-item.unread { border-left: 3px solid #3b82f6; }
.todo-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.todo-type { display: flex; align-items: center; gap: 8px; }
.type-tag { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.type-approval { background-color: #dbeafe; color: #3b82f6; }
.type-notice { background-color: #fef3c7; color: #f59e0b; }
.type-task { background-color: #d1fae5; color: #10b981; }
.type-cc { background-color: #ede9fe; color: #8b5cf6; }
.priority-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; }
.priority-tag.urgent { background-color: #fee2e2; color: #ef4444; }
.priority-tag.high { background-color: #ffedd5; color: #f97316; }
.todo-time { font-size: 12px; color: #94a3b8; }
.todo-content { margin-bottom: 12px; }
.todo-title { font-size: 16px; font-weight: 500; color: #1e293b; margin-bottom: 4px; display: block; }
.todo-desc { font-size: 13px; color: #64748b; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.todo-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #f1f5f9; }
.todo-source { display: flex; flex-direction: column; gap: 2px; }
.source-text { font-size: 12px; color: #94a3b8; }
.deadline { font-size: 11px; color: #94a3b8; }
.deadline.overdue { color: #ef4444; }
.todo-status { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.status-pending { background-color: #dbeafe; color: #3b82f6; }
.status-done { background-color: #d1fae5; color: #10b981; }
.status-ignored { background-color: #f1f5f9; color: #64748b; }
.status-transferred { background-color: #ede9fe; color: #8b5cf6; }
.loading-more { text-align: center; padding: 16px; color: #94a3b8; font-size: 13px; }
</style>
