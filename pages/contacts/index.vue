<template>
  <view class="ct-container">
    <!-- 顶部搜索 -->
    <view class="ct-search">
      <input
        class="ct-search-input"
        placeholder="搜索成员/部门"
        v-model="keyword"
        @confirm="onSearch"
      />
      <text class="ct-search-btn" @click="onSearch">搜索</text>
    </view>

    <view class="ct-body">
      <!-- 左侧部门树 -->
      <scroll-view scroll-y class="ct-tree">
        <view
          v-for="d in deptTree"
          :key="d.id"
          :class="['ct-tree-item', currentDeptId === d.id ? 'active' : '']"
          @click="onDeptClick(d)"
        >
          <text class="ct-tree-text">{{ d.deptName }}</text>
          <text class="ct-tree-count">{{ d.userCount || 0 }}</text>
        </view>
        <view v-if="!deptTree.length" class="ct-empty-tree">
          <text>暂无部门</text>
        </view>
      </scroll-view>

      <!-- 右侧员工列表 -->
      <scroll-view scroll-y class="ct-list" @scrolltolower="loadMore">
        <view v-if="!userList.length && !loading" class="ct-empty">
          <text>暂无成员</text>
        </view>

        <view
          v-for="u in userList"
          :key="u.id"
          class="ct-user"
          @click="goDetail(u)"
        >
          <view class="ct-avatar">
            <text>{{ initialOf(u) }}</text>
          </view>
          <view class="ct-user-main">
            <view class="ct-user-line">
              <text class="ct-user-name">{{ u.realName || u.username }}</text>
              <text v-if="u.positionName" class="ct-user-position">{{ u.positionName }}</text>
            </view>
            <text class="ct-user-sub">{{ u.deptName || "" }}{{ u.phone ? ' · ' + u.phone : '' }}</text>
          </view>
        </view>

        <view v-if="loading" class="ct-loading">
          <text>加载中...</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
import * as http from "../../utils/request.js";
import * as auth from "../../utils/auth.js";
import apiCfg from "../../config/api.js";

const keyword = ref("");
const deptTree = ref([]);
const currentDeptId = ref("");
const userList = ref([]);
const loading = ref(false);
const pageNum = ref(1);
const pageSize = ref(20);
const totalLoaded = ref(0);
const totalCount = ref(0);

function initialOf(u) {
  const name = u.realName || u.username || "?";
  return String(name).slice(0, 1).toUpperCase();
}

async function loadDept() {
  try {
    const res = await http.get(apiCfg.contacts.deptTree, null, { silent: true });
    deptTree.value = res.data || [];
  } catch (e) { deptTree.value = []; }
}

async function loadUsers(reset = true) {
  if (loading.value) return;
  loading.value = true;
  try {
    if (reset) {
      pageNum.value = 1;
      userList.value = [];
      totalLoaded.value = 0;
    }
    const params = {
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      deptId: currentDeptId.value || undefined
    };
    const res = await http.get(apiCfg.contacts.userList, params, { silent: true });
    const data = res.data || {};
    const records = data.records || data.list || [];
    userList.value = userList.value.concat(records);
    totalLoaded.value = userList.value.length;
    totalCount.value = data.total != null ? Number(data.total) : userList.value.length;
  } catch (e) { /* keep current */ }
  finally { loading.value = false; }
}

function onSearch() {
  loadUsers(true);
}

function onDeptClick(d) {
  // ID 字符串处理，避免 Long 精度
  currentDeptId.value = String(d.id || "");
  loadUsers(true);
}

function loadMore() {
  if (loading.value) return;
  if (totalLoaded.value >= totalCount.value) return;
  pageNum.value++;
  loadUsers(false);
}

function goDetail(u) {
  uni.navigateTo({ url: "/pages/contacts/detail?id=" + String(u.id) });
}

onMounted(() => {
  if (!auth.getToken()) {
    uni.reLaunch({ url: "/pages/auth/login" });
    return;
  }
  loadDept();
  loadUsers(true);
});
</script>

<style scoped>
.ct-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.ct-search {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  gap: 8px;
}

.ct-search-input {
  flex: 1;
  padding: 8px 12px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 13px;
  height: 32px;
  line-height: 32px;
}

.ct-search-btn {
  font-size: 13px;
  color: #3b82f6;
  padding: 0 8px;
}

.ct-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.ct-tree {
  width: 96px;
  background: #fff;
  border-right: 1px solid #e2e8f0;
}

.ct-tree-item {
  padding: 12px 10px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ct-tree-item.active {
  background: #eff6ff;
}

.ct-tree-text {
  font-size: 13px;
  color: #1e293b;
}

.ct-tree-item.active .ct-tree-text {
  color: #3b82f6;
  font-weight: 500;
}

.ct-tree-count {
  font-size: 11px;
  color: #94a3b8;
}

.ct-empty-tree {
  padding: 24px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
}

.ct-list {
  flex: 1;
  background: #fff;
}

.ct-empty {
  padding: 48px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.ct-user {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}

.ct-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin-right: 10px;
}

.ct-user-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ct-user-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ct-user-name {
  font-size: 14px;
  color: #1e293b;
  font-weight: 500;
}

.ct-user-position {
  font-size: 11px;
  color: #6366f1;
  background: #eef2ff;
  padding: 1px 6px;
  border-radius: 4px;
}

.ct-user-sub {
  font-size: 12px;
  color: #94a3b8;
}

.ct-loading {
  text-align: center;
  padding: 12px;
  color: #94a3b8;
  font-size: 12px;
}
</style>
