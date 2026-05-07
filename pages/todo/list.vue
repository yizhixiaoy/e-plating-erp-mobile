<template>
  <view class="todo-container">
    <!-- 顶部导航 -->
    <view class="header">
      <text class="title">我的待办</text>
    </view>

    <!-- 筛选标签 -->
    <view class="filter-tabs">
      <view 
        v-for="tab in tabs" 
        :key="tab.value"
        :class="['tab', currentTab === tab.value ? 'active' : '']"
        @click="currentTab = tab.value"
      >
        <text>{{ tab.label }}</text>
        <text v-if="tab.count > 0" class="badge">{{ tab.count }}</text>
      </view>
    </view>

    <!-- 待办列表 -->
    <scroll-view scroll-y class="todo-list" @scrolltolower="loadMore">
      <view v-if="filteredList.length === 0" class="empty-state">
        <text class="empty-text">暂无待办事项</text>
      </view>
      
      <view 
        v-for="item in filteredList" 
        :key="item.id"
        class="todo-item"
        @click="goToDetail(item)"
      >
        <view class="todo-header">
          <view class="todo-type">
            <text :class="['type-tag', getTypeClass(item.type)]">{{ item.typeName }}</text>
            <text v-if="item.priority === 1" class="priority-tag urgent">紧急</text>
          </view>
          <text class="todo-time">{{ item.createTime }}</text>
        </view>
        
        <view class="todo-content">
          <text class="todo-title">{{ item.title }}</text>
          <text class="todo-desc">{{ item.description }}</text>
        </view>
        
        <view class="todo-footer">
          <view class="todo-source">
            <text class="source-text">来自：{{ item.source }}</text>
          </view>
          <view :class="['todo-status', getStatusClass(item.status)]">
            <text>{{ getStatusText(item.status) }}</text>
          </view>
        </view>
      </view>

      <!-- 加载更多 -->
      <view v-if="loading" class="loading-more">
        <text>加载中...</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";

const currentTab = ref("pending");
const loading = ref(false);
const todoList = ref([]);

const tabs = [
  { label: "待处理", value: "pending", count: 0 },
  { label: "已处理", value: "done", count: 0 },
  { label: "全部", value: "all", count: 0 }
];

// 模拟数据
const mockData = [
  {
    id: 1,
    type: "approval",
    typeName: "审批",
    priority: 1,
    title: "请假申请审批",
    description: "张三申请2026-04-15至2026-04-17请假3天",
    source: "人事系统",
    status: "pending",
    createTime: "2026-04-14 09:30"
  },
  {
    id: 2,
    type: "notice",
    typeName: "通知",
    priority: 0,
    title: "系统维护通知",
    description: "本周六23:00-24:00进行系统维护",
    source: "系统管理员",
    status: "pending",
    createTime: "2026-04-14 08:00"
  },
  {
    id: 3,
    type: "task",
    typeName: "任务",
    priority: 0,
    title: "月度报表提交",
    description: "请于4月20日前提交上月度生产报表",
    source: "生产部",
    status: "pending",
    createTime: "2026-04-13 14:00"
  },
  {
    id: 4,
    type: "approval",
    typeName: "审批",
    priority: 0,
    title: "采购申请审批",
    description: "申请采购办公用品，预算5000元",
    source: "行政部",
    status: "done",
    createTime: "2026-04-12 10:00"
  }
];

const filteredList = computed(() => {
  if (currentTab.value === "all") {
    return todoList.value;
  }
  return todoList.value.filter(item => item.status === currentTab.value);
});

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

function goToDetail(item) {
  uni.navigateTo({
    url: `/pages/todo/detail?id=${item.id}`
  });
}

function loadMore() {
  if (loading.value) return;
  loading.value = true;
  setTimeout(() => {
    loading.value = false;
  }, 1000);
}

function fetchData() {
  // 实际应调用API
  todoList.value = mockData;
  // 更新标签计数
  tabs[0].count = mockData.filter(item => item.status === "pending").length;
  tabs[1].count = mockData.filter(item => item.status === "done").length;
  tabs[2].count = mockData.length;
}

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.todo-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.header {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  padding: 40px 20px 30px;
  text-align: center;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
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

.badge {
  background-color: #ef4444;
  color: #fff;
  font-size: 10px;
  padding: 0 6px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
}

.todo-list {
  padding: 12px;
  height: calc(100vh - 140px);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-text {
  color: #94a3b8;
  font-size: 14px;
}

.todo-item {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.todo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.todo-type {
  display: flex;
  align-items: center;
  gap: 8px;
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

.todo-time {
  font-size: 12px;
  color: #94a3b8;
}

.todo-content {
  margin-bottom: 12px;
}

.todo-title {
  font-size: 16px;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 4px;
  display: block;
}

.todo-desc {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  display: block;
}

.todo-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.source-text {
  font-size: 12px;
  color: #94a3b8;
}

.todo-status {
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

.loading-more {
  text-align: center;
  padding: 16px;
  color: #94a3b8;
  font-size: 13px;
}
</style>
