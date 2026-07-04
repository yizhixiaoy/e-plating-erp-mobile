<template>
  <view class="record-container">
    <!-- 顶部导航 -->
    <view class="header">
      <text class="title">邮件记录</text>
    </view>

    <!-- 筛选标签 -->
    <view class="filter-tabs">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        :class="['tab', currentTab === tab.value ? 'active' : '']"
        @click="switchTab(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <!-- 记录列表 -->
    <scroll-view scroll-y class="record-list" @scrolltolower="loadMore">
      <view v-if="list.length === 0 && !loading" class="empty-state">
        <text class="empty-icon">📧</text>
        <text class="empty-text">暂无邮件记录</text>
      </view>

      <view v-for="item in list" :key="item.id" class="record-item">
        <view class="record-header">
          <text class="record-email">{{ item.receiverEmail }}</text>
          <text :class="['status-tag', item.sendStatus === 1 ? 'status-success' : item.sendStatus === 2 ? 'status-fail' : 'status-pending']">
            {{ getStatusLabel(item.sendStatus) }}
          </text>
        </view>
        <text class="record-subject">{{ item.subject }}</text>
        <view class="record-footer">
          <text class="record-time">{{ formatTime(item.sentTime || item.createdAt) }}</text>
          <text v-if="item.failReason" class="fail-reason">{{ item.failReason }}</text>
        </view>
      </view>

      <view v-if="loading" class="loading-more">
        <text>加载中...</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
import * as http from "../../utils/request.js";
import * as auth from "../../utils/auth.js";
import apiCfg from "../../config/api.js";
import { fetchDictData, getDictLabel } from "../../utils/dict.js";

const list = ref([]);
const currentTab = ref("all");
const loading = ref(false);
const pageNum = ref(1);
const hasMore = ref(true);
const sendStatusDict = ref([]);

const tabs = [
  { label: "全部", value: "all" },
  { label: "已发送", value: "success" },
  { label: "发送失败", value: "fail" }
];

function getStatusLabel(status) {
  return getDictLabel(sendStatusDict.value, status);
}

function getSendStatus() {
  if (currentTab.value === "success") return 1;
  // "fail" tab: fetch all and filter client-side (failed = 0 or 2)
  return null;
}

function switchTab(val) {
  currentTab.value = val;
  pageNum.value = 1;
  hasMore.value = true;
  list.value = [];
  loadRecords();
}

async function loadRecords() {
  if (loading.value || !hasMore.value) return;
  loading.value = true;
  try {
    const params = { pageNum: pageNum.value, pageSize: 20 };
    const status = getSendStatus();
    if (status !== null) params.sendStatus = status;
    const res = await http.get(apiCfg.me.emailRecords, params, { silent: true });
    const data = res.data || {};
    let records = data.records || [];
    // "fail" tab: client-side filter for non-success (status 0 or 2)
    if (currentTab.value === "fail") {
      records = records.filter(r => r.sendStatus !== 1);
    }
    if (pageNum.value === 1) {
      list.value = records;
    } else {
      list.value = [...list.value, ...records];
    }
    hasMore.value = records.length >= 20;
  } catch (e) {
    hasMore.value = false;
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  if (loading.value || !hasMore.value) return;
  pageNum.value++;
  loadRecords();
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0") + " " +
    String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

onMounted(async () => {
  if (!auth.getToken()) {
    uni.reLaunch({ url: "/pages/auth/login" });
    return;
  }
  sendStatusDict.value = await fetchDictData("send_status");
  loadRecords();
});
</script>

<style scoped>
.record-container {
  min-height: 100%;
  background-color: var(--bg-page);
}

.header {
  background: var(--color-gradient);
  padding: 40px 20px 20px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
}

.filter-tabs {
  display: flex;
  background-color: var(--bg-card);
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-light);
  gap: 6px;
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
}

.tab.active {
  color: var(--color-primary);
  font-weight: 600;
  background: #eff6ff;
  border-color: #bfdbfe;
}

.record-list {
  padding: 12px;
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

.record-item {
  background-color: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.record-item:active {
  transform: scale(0.98);
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.record-email {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  margin-left: 8px;
  flex-shrink: 0;
  font-weight: 500;
}

.status-success {
  background-color: #d1fae5;
  color: #10b981;
}

.status-fail {
  background-color: #fee2e2;
  color: #ef4444;
}

.status-pending {
  background-color: #fef3c7;
  color: #d97706;
}

.record-subject {
  font-size: 13px;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.fail-reason {
  font-size: 11px;
  color: var(--color-danger);
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-more {
  text-align: center;
  padding: 16px;
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
