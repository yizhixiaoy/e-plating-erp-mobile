<template>
  <view class="detail-container">
    <!-- 顶部导航 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="title">待办详情</text>
      <view class="placeholder"></view>
    </view>

    <!-- 详情内容 -->
    <scroll-view scroll-y class="detail-content" v-if="detail">
      <!-- 类型标签 -->
      <view class="type-section">
        <text :class="['type-tag', getTypeClass(detail.type)]">{{ detail.typeName }}</text>
        <text v-if="detail.priority === 1" class="priority-tag urgent">紧急</text>
      </view>

      <!-- 标题 -->
      <view class="title-section">
        <text class="detail-title">{{ detail.title }}</text>
      </view>

      <!-- 信息卡片 -->
      <view class="info-card">
        <view class="info-item">
          <text class="info-label">来源</text>
          <text class="info-value">{{ detail.source }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">创建时间</text>
          <text class="info-value">{{ detail.createTime }}</text>
        </view>
        <view class="info-item">
          <text class="info-label">状态</text>
          <text :class="['status-value', getStatusClass(detail.status)]">
            {{ getStatusText(detail.status) }}
          </text>
        </view>
      </view>

      <!-- 详情描述 -->
      <view class="desc-section">
        <text class="section-title">详情内容</text>
        <text class="desc-text">{{ detail.description }}</text>
      </view>

      <!-- 附件列表（如果有） -->
      <view class="attachment-section" v-if="detail.attachments && detail.attachments.length > 0">
        <text class="section-title">附件</text>
        <view 
          v-for="(file, index) in detail.attachments" 
          :key="index"
          class="attachment-item"
        >
          <text class="file-icon">📎</text>
          <text class="file-name">{{ file.name }}</text>
        </view>
      </view>

      <!-- 审批记录（如果是审批类型） -->
      <view class="approval-section" v-if="detail.type === 'approval' && detail.approvalLogs">
        <text class="section-title">审批记录</text>
        <view class="timeline">
          <view 
            v-for="(log, index) in detail.approvalLogs" 
            :key="index"
            class="timeline-item"
          >
            <view class="timeline-dot" :class="log.status"></view>
            <view class="timeline-content">
              <text class="timeline-title">{{ log.title }}</text>
              <text class="timeline-time">{{ log.time }}</text>
              <text v-if="log.remark" class="timeline-remark">{{ log.remark }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="footer-actions" v-if="detail && detail.status === 'pending'">
      <view v-if="detail.type === 'approval'" class="approval-actions">
        <button class="reject-btn" @click="handleReject">拒绝</button>
        <button class="approve-btn" @click="handleApprove">同意</button>
      </view>
      <view v-else class="normal-actions">
        <button class="complete-btn" @click="handleComplete">标记为已处理</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";

const detail = ref(null);
const todoId = ref(null);

// 模拟数据
const mockDetail = {
  id: 1,
  type: "approval",
  typeName: "审批",
  priority: 1,
  title: "请假申请审批",
  description: "张三申请2026-04-15至2026-04-17请假3天，请假事由：家中有事。\n\n请审批。",
  source: "人事系统",
  status: "pending",
  createTime: "2026-04-14 09:30",
  attachments: [
    { name: "请假单.pdf", size: "256KB" }
  ],
  approvalLogs: [
    { title: "张三提交申请", time: "2026-04-14 09:30", status: "done" },
    { title: "等待审批", time: "2026-04-14 09:31", status: "pending" }
  ]
};

function getTypeClass(type) {
  const map = {
    approval: "type-approval",
    notice: "type-notice",
    task: "type-task"
  };
  return map[type] || "";
}

function getStatusClass(status) {
  return status === "pending" ? "status-pending" : "status-done";
}

function getStatusText(status) {
  return status === "pending" ? "待处理" : "已处理";
}

function goBack() {
  uni.navigateBack();
}

function handleApprove() {
  uni.showModal({
    title: "确认同意",
    content: "确定同意该申请吗？",
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: "审批成功", icon: "success" });
        setTimeout(() => {
          goBack();
        }, 1500);
      }
    }
  });
}

function handleReject() {
  uni.showModal({
    title: "确认拒绝",
    content: "确定拒绝该申请吗？",
    editable: true,
    placeholderText: "请输入拒绝原因（可选）",
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: "已拒绝", icon: "success" });
        setTimeout(() => {
          goBack();
        }, 1500);
      }
    }
  });
}

function handleComplete() {
  uni.showModal({
    title: "确认",
    content: "确定标记为已处理吗？",
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: "操作成功", icon: "success" });
        setTimeout(() => {
          goBack();
        }, 1500);
      }
    }
  });
}

function fetchDetail() {
  // 实际应调用API
  detail.value = mockDetail;
}

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  todoId.value = currentPage.options.id;
  fetchDetail();
});
</script>

<style scoped>
.detail-container {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding-bottom: 80px;
}

.header {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  color: #fff;
  font-size: 20px;
}

.title {
  font-size: 18px;
  font-weight: 500;
  color: #fff;
}

.placeholder {
  width: 32px;
}

.detail-content {
  padding: 16px;
}

.type-section {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.type-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.type-approval {
  background-color: #dbeafe;
  color: #3b82f6;
}

.type-notice {
  background-color: #fef3c7;
  color: #f59e0b;
}

.type-task {
  background-color: #d1fae5;
  color: #10b981;
}

.priority-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
}

.priority-tag.urgent {
  background-color: #fee2e2;
  color: #ef4444;
}

.title-section {
  margin-bottom: 16px;
}

.detail-title {
  font-size: 20px;
  font-weight: bold;
  color: #1e293b;
  line-height: 1.4;
}

.info-card {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 14px;
  color: #64748b;
}

.info-value {
  font-size: 14px;
  color: #1e293b;
}

.status-value {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-pending {
  background-color: #dbeafe;
  color: #3b82f6;
}

.status-done {
  background-color: #d1fae5;
  color: #10b981;
}

.desc-section,
.attachment-section,
.approval-section {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 12px;
  display: block;
}

.desc-text {
  font-size: 14px;
  color: #334155;
  line-height: 1.6;
  white-space: pre-line;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background-color: #f8fafc;
  border-radius: 4px;
}

.file-icon {
  font-size: 16px;
}

.file-name {
  font-size: 14px;
  color: #3b82f6;
}

.timeline {
  position: relative;
  padding-left: 24px;
}

.timeline::before {
  content: "";
  position: absolute;
  left: 6px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background-color: #e2e8f0;
}

.timeline-item {
  position: relative;
  padding-bottom: 16px;
}

.timeline-dot {
  position: absolute;
  left: -22px;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #cbd5e1;
}

.timeline-dot.done {
  background-color: #10b981;
}

.timeline-dot.pending {
  background-color: #3b82f6;
}

.timeline-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-title {
  font-size: 14px;
  color: #1e293b;
}

.timeline-time {
  font-size: 12px;
  color: #94a3b8;
}

.timeline-remark {
  font-size: 12px;
  color: #64748b;
  background-color: #f8fafc;
  padding: 4px 8px;
  border-radius: 4px;
}

.footer-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #fff;
  padding: 12px 16px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
}

.approval-actions {
  display: flex;
  gap: 12px;
}

.reject-btn,
.approve-btn,
.complete-btn {
  flex: 1;
  height: 44px;
  border-radius: 8px;
  font-size: 16px;
  border: none;
}

.reject-btn {
  background-color: #fee2e2;
  color: #ef4444;
}

.approve-btn {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
}

.complete-btn {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
}
</style>
