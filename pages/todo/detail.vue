<template>
  <view class="detail-container">
    <!-- 顶部导航 -->
    <view class="header">
      <view class="back-btn" @click="goBack"><text class="back-icon">←</text></view>
      <text class="title">待办详情</text>
      <view class="placeholder"></view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="status-box">
      <text class="status-text">加载中...</text>
    </view>

    <!-- 加载失败 -->
    <view v-else-if="loadError" class="status-box">
      <text class="status-text error">加载失败</text>
      <view class="retry-btn" @click="loadDetail()"><text>重试</text></view>
    </view>

    <!-- 详情内容 -->
    <scroll-view v-else-if="detail" scroll-y class="detail-content">
      <!-- 类型和优先级 -->
      <view class="type-section">
        <text :class="['type-tag', getTypeClass(detail.todoType)]">{{ getTypeLabel(detail.todoType) }}</text>
        <text v-if="detail.priority >= 2" :class="['priority-tag', priorityClass(detail.priority)]">
          {{ getPriorityLabel(detail.priority) }}
        </text>
        <text v-if="isOverdue" class="overdue-tag">已逾期</text>
      </view>

      <!-- 标题 -->
      <view class="title-section"><text class="detail-title">{{ detail.title }}</text></view>

      <!-- 信息卡片 -->
      <view class="info-card">
        <view class="info-item">
          <view class="info-left">
            <text class="info-icon">📋</text>
            <text class="info-label">来源</text>
          </view>
          <text class="info-value">{{ getBizModuleLabel(detail.bizModule) }}</text>
        </view>
        <view class="info-item">
          <view class="info-left">
            <text class="info-icon">🕐</text>
            <text class="info-label">创建时间</text>
          </view>
          <text class="info-value">{{ formatTime(detail.createdAt) }}</text>
        </view>
        <view class="info-item" v-if="detail.deadline">
          <view class="info-left">
            <text class="info-icon">⏰</text>
            <text class="info-label">截止时间</text>
          </view>
          <text :class="['info-value', isOverdue ? 'overdue-text' : '']">{{ formatTime(detail.deadline) }}</text>
        </view>
        <view class="info-item">
          <view class="info-left">
            <text class="info-icon">🏷️</text>
            <text class="info-label">状态</text>
          </view>
          <text :class="['status-badge', getStatusClass(detail.status)]">{{ getStatusLabel(detail.status) }}</text>
        </view>
        <view class="info-item" v-if="detail.handleAction">
          <view class="info-left">
            <text class="info-icon">⚡</text>
            <text class="info-label">处理动作</text>
          </view>
          <text class="info-value">{{ getActionLabel(detail.handleAction) }}</text>
        </view>
        <view class="info-item" v-if="detail.handledAt">
          <view class="info-left">
            <text class="info-icon">✅</text>
            <text class="info-label">处理时间</text>
          </view>
          <text class="info-value">{{ formatTime(detail.handledAt) }}</text>
        </view>
      </view>

      <!-- 详情内容 -->
      <view class="desc-section">
        <text class="section-title">详情内容</text>
        <text class="desc-text">{{ detail.content || '-' }}</text>
      </view>

      <!-- 处理备注 -->
      <view class="desc-section" v-if="detail.handleRemark">
        <text class="section-title">处理备注</text>
        <text class="desc-text">{{ detail.handleRemark }}</text>
      </view>

      <!-- 底部占位（给固定底栏留空间） -->
      <view style="height: 80px;"></view>
    </scroll-view>

    <!-- 底部操作栏：仅未处理可用 -->
    <view class="footer-actions" v-if="detail && detail.status === 0">
      <view v-if="detail.todoType === 'APPROVAL'" class="approval-actions">
        <button class="action-btn reject" @click="doHandle('REJECT')">
          <text class="action-icon">✕</text>
          <text>拒绝</text>
        </button>
        <button class="action-btn ignore" @click="doHandle('IGNORE')">
          <text class="action-icon">⊘</text>
          <text>忽略</text>
        </button>
        <button class="action-btn approve" @click="doHandle('AGREE')">
          <text class="action-icon">✓</text>
          <text>同意</text>
        </button>
      </view>
      <view v-else class="normal-actions">
        <button class="action-btn ignore" @click="doHandle('IGNORE')">
          <text class="action-icon">⊘</text>
          <text>忽略</text>
        </button>
        <button class="action-btn approve full" @click="doHandle('COMPLETE')">
          <text class="action-icon">✓</text>
          <text>标记为已处理</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import * as http from "../../utils/request.js";
import * as dict from "../../utils/dict.js";
import apiCfg from "../../config/api.js";

const detail = ref(null);
const todoId = ref(null);
const loading = ref(true);
const loadError = ref(false);
const todoTypeItems = ref([]);
const todoPriorityItems = ref([]);
const todoStatusItems = ref([]);
const todoActionItems = ref([]);
const bizModuleItems = ref([]);

const isOverdue = computed(() => {
  if (!detail.value || !detail.value.deadline || detail.value.status !== 0) return false;
  return new Date(detail.value.deadline).getTime() < Date.now();
});

function getTypeClass(type) {
  const map = { APPROVAL: "type-approval", TASK: "type-task", REMIND: "type-notice", CC: "type-cc" };
  return map[type] || "type-task";
}
function getTypeLabel(type) { return dict.getDictLabel(todoTypeItems.value, type) || type || ""; }
function getStatusClass(status) {
  return ["status-pending", "status-done", "status-ignored", "status-transferred"][status] || "status-pending";
}
function getStatusLabel(status) {
  return dict.getDictLabel(todoStatusItems.value, status) || ["待处理", "已处理", "已忽略", "已转交"][status] || "";
}
function getPriorityLabel(p) {
  return dict.getDictLabel(todoPriorityItems.value, p) || ["低", "中", "高", "紧急"][p] || "";
}
function priorityClass(p) { return ["", "", "high", "urgent"][p] || ""; }
function getActionLabel(a) { return dict.getDictLabel(todoActionItems.value, a) || a || ""; }
function getBizModuleLabel(m) { return dict.getDictLabel(bizModuleItems.value, m) || m || "系统"; }

function formatTime(time) {
  if (!time) return "";
  const date = new Date(time);
  return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function goBack() { uni.navigateBack(); }

async function loadDetail() {
  if (!todoId.value) {
    loading.value = false;
    loadError.value = true;
    return;
  }
  loading.value = true;
  loadError.value = false;
  try {
    const url = apiCfg.fillPath(apiCfg.todo.detail, { id: todoId.value });
    const res = await http.get(url, null, { silent: true });
    detail.value = res.data || null;
    if (detail.value && detail.value.readStatus === 0) {
      // 自动标记已读（静默）
      const rurl = apiCfg.fillPath(apiCfg.todo.read, { id: todoId.value });
      http.patch(rurl, null, { silent: true }).catch(() => {});
    }
  } catch (e) {
    detail.value = null;
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function doHandle(action) {
  const labelMap = { AGREE: "确认同意", REJECT: "确认拒绝", COMPLETE: "确认完成", IGNORE: "确认忽略" };
  uni.showModal({
    title: labelMap[action] || "确认操作",
    content: "确定执行该操作吗？",
    editable: action === "REJECT" || action === "IGNORE",
    placeholderText: "请输入备注（可选）",
    success: async (res) => {
      if (!res.confirm) return;
      try {
        const url = apiCfg.fillPath(apiCfg.todo.handle, { id: todoId.value });
        await http.post(url, { action, remark: res.content || "" });
        uni.showToast({ title: "操作成功", icon: "success" });
        setTimeout(() => goBack(), 1200);
      } catch (e) {
        // 错误提示由 request 拦截器统一处理
      }
    }
  });
}

async function loadDicts() {
  const [t, p, s, a, b] = await Promise.all([
    dict.fetchDictData("todo_type"),
    dict.fetchDictData("todo_priority"),
    dict.fetchDictData("todo_status"),
    dict.fetchDictData("todo_action"),
    dict.fetchDictData("biz_module").catch(() => [])
  ]);
  todoTypeItems.value = t;
  todoPriorityItems.value = p;
  todoStatusItems.value = s;
  todoActionItems.value = a;
  bizModuleItems.value = b;
}

onLoad(async (options) => {
  todoId.value = (options && options.id) || null;
  await loadDicts();
  await loadDetail();
});
</script>

<style scoped>
.detail-container {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 90px;
}

/* ===== 状态提示 ===== */
.status-box {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 320px;
  gap: 16px;
}

.status-text {
  font-size: 15px;
  color: #94a3b8;
}

.status-text.error {
  color: #ef4444;
}

.retry-btn {
  padding: 10px 32px;
  border: 1px solid #3b82f6;
  border-radius: 20px;
  color: #3b82f6;
  font-size: 14px;
  font-weight: 500;
  background: #fff;
}

/* ===== 顶部导航 ===== */
.header {
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  padding: calc(var(--status-bar-height) + 8px) 16px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  color: #fff;
  font-size: 20px;
  font-weight: 300;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.5px;
}

.placeholder {
  width: 36px;
}

/* ===== 内容区 ===== */
.detail-content {
  padding: 16px;
}

/* ===== 类型区 ===== */
.type-section {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.type-tag {
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 20px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.type-approval {
  background: #eff6ff;
  color: #2563eb;
}

.type-notice {
  background: #fffbeb;
  color: #d97706;
}

.type-task {
  background: #ecfdf5;
  color: #059669;
}

.type-cc {
  background: #f5f3ff;
  color: #7c3aed;
}

.priority-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 600;
}

.priority-tag.urgent {
  background: #fef2f2;
  color: #dc2626;
}

.priority-tag.high {
  background: #fff7ed;
  color: #ea580c;
}

.overdue-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  background: #fef2f2;
  color: #dc2626;
  font-weight: 600;
}

/* ===== 标题 ===== */
.title-section {
  margin-bottom: 20px;
  padding: 0 2px;
}

.detail-title {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.45;
  letter-spacing: 0.2px;
}

/* ===== 信息卡片 ===== */
.info-card {
  background: #fff;
  border-radius: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 18px;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item:active {
  background: #f8fafc;
}

.info-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.info-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

/* 不同信息项的图标底色 */
.info-item:nth-child(1) .info-icon { background: #eff6ff; }
.info-item:nth-child(2) .info-icon { background: #f0fdf4; }
.info-item:nth-child(3) .info-icon { background: #fff7ed; }
.info-item:nth-child(4) .info-icon { background: #f5f3ff; }
.info-item:nth-child(5) .info-icon { background: #fef2f2; }
.info-item:nth-child(6) .info-icon { background: #ecfdf5; }

.info-label {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.info-value {
  font-size: 14px;
  color: #334155;
  font-weight: 600;
  max-width: 50%;
  text-align: right;
  word-break: break-all;
  line-height: 1.4;
}

.info-value.overdue-text {
  color: #dc2626;
}

/* 状态徽章 */
.status-badge {
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 20px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.status-pending {
  background: #eff6ff;
  color: #2563eb;
}

.status-done {
  background: #ecfdf5;
  color: #059669;
}

.status-ignored {
  background: #f1f5f9;
  color: #94a3b8;
}

.status-transferred {
  background: #f5f3ff;
  color: #7c3aed;
}

/* ===== 描述区 ===== */
.desc-section {
  background: #fff;
  border-radius: 16px;
  padding: 18px 18px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03);
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title::before {
  content: "";
  width: 4px;
  height: 18px;
  background: #3b82f6;
  border-radius: 2px;
  display: inline-block;
  flex-shrink: 0;
}

.desc-text {
  font-size: 15px;
  color: #475569;
  line-height: 1.8;
  white-space: pre-line;
  word-break: break-word;
}

/* ===== 底部操作栏 ===== */
.footer-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 12px 16px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.06);
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 10;
}

.approval-actions,
.normal-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  height: 48px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: transform 0.15s, opacity 0.15s;
}

.action-btn:active {
  transform: scale(0.96);
  opacity: 0.85;
}

.action-btn .action-icon {
  font-size: 16px;
  font-weight: 700;
}

.action-btn.reject {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.action-btn.ignore {
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.action-btn.approve {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
}

.action-btn.approve.full {
  flex: 2;
}
</style>
