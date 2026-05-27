<template>
  <view class="record-container">
    <!-- 顶部导航 -->
    <view class="header">
      <text class="title">短信记录</text>
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
        <text class="empty-icon">💬</text>
        <text class="empty-text">暂无短信记录</text>
      </view>

      <view v-for="item in list" :key="item.id" class="record-item">
        <view class="record-header">
          <text class="record-phone">{{ item.receiverPhone }}</text>
          <text :class="['status-tag', item.sendStatus === 1 ? 'status-success' : 'status-fail']">
            {{ item.sendStatus === 1 ? '已发送' : '发送失败' }}
          </text>
        </view>
        <text class="record-content">{{ item.content }}</text>
        <view class="record-footer">
          <text class="record-time">{{ formatTime(item.sentTime || item.createdAt) }}</text>
          <text class="record-type">{{ getSmsTypeLabel(item.smsType) }}</text>
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
const http = require("../../utils/request.js");
const auth = require("../../utils/auth.js");
const apiCfg = require("../../config/api.js");

const list = ref([]);
const currentTab = ref("all");
const loading = ref(false);
const pageNum = ref(1);
const hasMore = ref(true);

const tabs = [
  { label: "全部", value: "all" },
  { label: "已发送", value: "success" },
  { label: "发送失败", value: "fail" }
];

const smsTypeMap = {
  "NEW_USER_NOTIFY": "新用户通知",
  "RESET_PASSWORD_NOTIFY": "重置密码",
  "VERIFY_CODE": "验证码",
  "LOGIN_NOTIFY": "登录通知"
};

function getSmsTypeLabel(type) {
  return smsTypeMap[type] || type || "";
}

function getSendStatus() {
  if (currentTab.value === "success") return 1;
  if (currentTab.value === "fail") return 0;
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
    const res = await http.get(apiCfg.me.smsRecords, params, { silent: true });
    const data = res.data || {};
    const records = data.records || [];
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

onMounted(() => {
  if (!auth.getToken()) {
    uni.reLaunch({ url: "/pages/auth/login" });
    return;
  }
  loadRecords();
});
</script>

<style scoped>
.record-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.header {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  padding: 40px 20px 20px;
}

.title {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.filter-tabs {
  display: flex;
  background-color: #fff;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 14px;
  color: #64748b;
  position: relative;
}

.tab.active {
  color: #3b82f6;
  font-weight: 500;
}

.tab.active::after {
  content: "";
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  background-color: #3b82f6;
}

.record-list {
  padding: 12px;
  height: calc(100vh - 140px);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  display: block;
}

.empty-text {
  color: #94a3b8;
  font-size: 14px;
}

.record-item {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.record-phone {
  font-size: 14px;
  color: #1e293b;
  font-weight: 500;
}

.status-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-success {
  background-color: #dcfce7;
  color: #16a34a;
}

.status-fail {
  background-color: #fee2e2;
  color: #ef4444;
}

.record-content {
  font-size: 13px;
  color: #64748b;
  display: block;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.5;
}

.record-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-time {
  font-size: 12px;
  color: #94a3b8;
}

.record-type {
  font-size: 11px;
  color: #3b82f6;
  background: #dbeafe;
  padding: 1px 6px;
  border-radius: 4px;
}

.loading-more {
  text-align: center;
  padding: 16px;
  color: #94a3b8;
  font-size: 13px;
}
</style>
