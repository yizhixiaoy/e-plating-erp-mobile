<template>
  <view class="detail-container">
    <!-- 顶部导航 -->
    <view class="header">
      <view class="back-btn" @click="goBack"><text class="back-icon">←</text></view>
      <text class="title">待办详情</text>
      <view class="placeholder"></view>
    </view>

    <!-- 详情内容 -->
    <scroll-view scroll-y class="detail-content" v-if="detail">
      <view class="type-section">
        <text :class="['type-tag', getTypeClass(detail.todoType)]">{{ getTypeLabel(detail.todoType) }}</text>
        <text v-if="detail.priority >= 2" :class="['priority-tag', priorityClass(detail.priority)]">
          {{ getPriorityLabel(detail.priority) }}
        </text>
      </view>

      <view class="title-section"><text class="detail-title">{{ detail.title }}</text></view>

      <view class="info-card">
        <view class="info-item">
          <text class="info-label">来源</text>
          <text class="info-value">{{ detail.bizModule || '系统' }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">创建时间</text>
          <text class="info-value">{{ formatTime(detail.createdAt) }}</text>
        </view>
        <view class="info-item" v-if="detail.deadline">
          <text class="info-label">截止时间</text>
          <text :class="['info-value', isOverdue ? 'overdue-text' : '']">{{ formatTime(detail.deadline) }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">状态</text>
          <text :class="['status-value', getStatusClass(detail.status)]">{{ getStatusLabel(detail.status) }}</text>
        </view>
        <view class="info-item" v-if="detail.handleAction">
          <text class="info-label">处理动作</text>
          <text class="info-value">{{ getActionLabel(detail.handleAction) }}</text>
        </view>
        <view class="info-item" v-if="detail.handledAt">
          <text class="info-label">处理时间</text>
          <text class="info-value">{{ formatTime(detail.handledAt) }}</text>
        </view>
      </view>

      <view class="desc-section">
        <text class="section-title">详情内容</text>
        <text class="desc-text">{{ detail.content || '-' }}</text>
      </view>

      <view class="desc-section" v-if="detail.handleRemark">
        <text class="section-title">处理备注</text>
        <text class="desc-text">{{ detail.handleRemark }}</text>
      </view>
    </scroll-view>

    <!-- 底部操作栏：仅未处理可用 -->
    <view class="footer-actions" v-if="detail && detail.status === 0">
      <view v-if="detail.todoType === 'APPROVAL'" class="approval-actions">
        <button class="reject-btn" @click="doHandle('REJECT')">拒绝</button>
        <button class="ignore-btn" @click="doHandle('IGNORE')">忽略</button>
        <button class="approve-btn" @click="doHandle('AGREE')">同意</button>
      </view>
      <view v-else class="normal-actions">
        <button class="ignore-btn" @click="doHandle('IGNORE')">忽略</button>
        <button class="complete-btn" @click="doHandle('COMPLETE')">标记为已处理</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import * as http from "../../utils/request.js";
import * as dict from "../../utils/dict.js";
import apiCfg from "../../config/api.js";

const detail = ref(null);
const todoId = ref(null);
const todoTypeItems = ref([]);
const todoPriorityItems = ref([]);
const todoStatusItems = ref([]);
const todoActionItems = ref([]);

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

function formatTime(time) {
  if (!time) return "";
  const date = new Date(time);
  return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function goBack() { uni.navigateBack(); }

async function loadDetail() {
  if (!todoId.value) return;
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
    uni.showToast({ title: "加载失败", icon: "none" });
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
  const [t, p, s, a] = await Promise.all([
    dict.fetchDictData("todo_type"),
    dict.fetchDictData("todo_priority"),
    dict.fetchDictData("todo_status"),
    dict.fetchDictData("todo_action")
  ]);
  todoTypeItems.value = t;
  todoPriorityItems.value = p;
  todoStatusItems.value = s;
  todoActionItems.value = a;
}

onMounted(async () => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  todoId.value = currentPage.options && currentPage.options.id;
  await loadDicts();
  await loadDetail();
});
</script>

<style scoped>
.detail-container { min-height: 100vh; background-color: #f5f7fa; padding-bottom: 80px; }
.header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
.back-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { color: #fff; font-size: 20px; }
.title { font-size: 18px; font-weight: 500; color: #fff; }
.placeholder { width: 32px; }
.detail-content { padding: 16px; }

.type-section { display: flex; gap: 8px; margin-bottom: 12px; }
.type-tag { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.type-approval { background-color: #dbeafe; color: #3b82f6; }
.type-notice { background-color: #fef3c7; color: #f59e0b; }
.type-task { background-color: #d1fae5; color: #10b981; }
.type-cc { background-color: #ede9fe; color: #8b5cf6; }
.priority-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; }
.priority-tag.urgent { background-color: #fee2e2; color: #ef4444; }
.priority-tag.high { background-color: #ffedd5; color: #f97316; }

.title-section { margin-bottom: 16px; }
.detail-title { font-size: 20px; font-weight: bold; color: #1e293b; line-height: 1.4; }

.info-card { background-color: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.info-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
.info-item:last-child { border-bottom: none; }
.info-label { font-size: 14px; color: #64748b; }
.info-value { font-size: 14px; color: #1e293b; }
.info-value.overdue-text { color: #ef4444; }
.status-value { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.status-pending { background-color: #dbeafe; color: #3b82f6; }
.status-done { background-color: #d1fae5; color: #10b981; }
.status-ignored { background-color: #f1f5f9; color: #64748b; }
.status-transferred { background-color: #ede9fe; color: #8b5cf6; }

.desc-section { background-color: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.section-title { font-size: 16px; font-weight: 500; color: #1e293b; margin-bottom: 12px; display: block; }
.desc-text { font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-line; }

.footer-actions { position: fixed; bottom: 0; left: 0; right: 0; background-color: #fff; padding: 12px 16px; box-shadow: 0 -2px 8px rgba(0,0,0,0.05); }
.approval-actions, .normal-actions { display: flex; gap: 8px; }
.reject-btn, .approve-btn, .complete-btn, .ignore-btn { flex: 1; height: 44px; border-radius: 8px; font-size: 15px; border: none; }
.reject-btn { background-color: #fee2e2; color: #ef4444; }
.ignore-btn { background-color: #f1f5f9; color: #64748b; }
.approve-btn { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; }
.complete-btn { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; }
</style>
