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
        <view v-for="item in flatDeptList" :key="'d-' + item.id"
          :class="['ct-tree-item', currentDeptId === item.id ? 'active' : '']"
          :style="{ paddingLeft: (12 + item.level * 16) + 'px' }"
          @click="onDeptClick(item)"
        >
          <!-- 展开/折叠箭头 -->
          <text v-if="item.hasChildren" class="ct-tree-arrow" @click.stop="toggleDept(item.id)">
            {{ isDeptExpanded(item.id) ? '▾' : '▸' }}
          </text>
          <text v-else class="ct-tree-arrow ct-tree-arrow-placeholder"></text>
          <text class="ct-tree-text">{{ item.deptName }}</text>
          <text class="ct-tree-count">{{ item.userCount || 0 }}</text>
        </view>
        <view v-if="!deptTree.length" class="ct-empty-tree">
          <text>暂无部门</text>
        </view>
      </scroll-view>

      <!-- 右侧员工列表 -->
      <scroll-view scroll-y class="ct-list" @scrolltolower="loadMore" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="onRefresh">
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
            <image v-if="getAvatarSrc(u)" :src="getAvatarSrc(u)" class="ct-avatar-img" mode="aspectFill" @error="onAvatarError(u)" />
            <text v-else>{{ initialOf(u) }}</text>
          </view>
          <view class="ct-user-main">
            <view class="ct-user-line">
              <text class="ct-user-name">{{ u.realName || u.username }}</text>
              <text v-if="u.position" class="ct-user-position">{{ u.position }}</text>
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
import { ref, watch, onMounted, computed } from "vue";
import * as http from "../../utils/request.js";
import * as auth from "../../utils/auth.js";
import apiCfg from "../../config/api.js";
import { getImageUrl } from "../../utils/image-url.js";
import { preloadImages } from "../../utils/image-preloader.js";

const keyword = ref("");
let searchTimer = null;
const deptTree = ref([]);
const currentDeptId = ref("");
// 已展开的部门 ID 集合（默认展开根节点）
const expandedDepts = ref(new Set());

/** 判断部门是否展开 */
function isDeptExpanded(id) {
  return expandedDepts.value.has(id);
}

/** 切换部门展开/折叠 */
function toggleDept(id) {
  const s = new Set(expandedDepts.value);
  if (s.has(id)) {
    s.delete(id);
  } else {
    s.add(id);
  }
  expandedDepts.value = s;
}

/** 扁平化部门树（仅展示展开的节点） */
const flatDeptList = computed(() => {
  const result = [];
  function walk(nodes, level) {
    if (!nodes || !nodes.length) return;
    for (const n of nodes) {
      const hasChildren = n.children && n.children.length > 0;
      result.push({
        id: n.id,
        deptName: n.deptName,
        userCount: n.userCount || 0,
        hasChildren,
        level,
        parentId: n.parentId
      });
      if (hasChildren && expandedDepts.value.has(n.id)) {
        walk(n.children, level + 1);
      }
    }
  }
  walk(deptTree.value, 0);
  return result;
});
const userList = ref([]);
const loading = ref(false);
const pageNum = ref(1);
const pageSize = ref(20);
const totalLoaded = ref(0);
const totalCount = ref(0);
const refreshing = ref(false);

// 头像预加载：URL -> 本地路径映射
const avatarMap = ref({});

/** 获取用户头像的显示路径（优先使用预加载的本地路径） */
function getAvatarSrc(u) {
  const remoteUrl = getImageUrl(u.avatarUrl);
  return avatarMap.value[remoteUrl] || "";
}

function initialOf(u) {
  const name = u.realName || u.username || "?";
  return String(name).slice(0, 1).toUpperCase();
}

/** 头像加载失败时清除缓存，回退到文字头像 */
function onAvatarError(u) {
  const remoteUrl = getImageUrl(u.avatarUrl);
  if (remoteUrl) {
    const map = { ...avatarMap.value };
    delete map[remoteUrl];
    avatarMap.value = map;
  }
}

async function loadDept() {
  try {
    const res = await http.get(apiCfg.contacts.deptTree, null, { silent: true });
    deptTree.value = res.data || [];
    // 默认展开第一层节点
    if (deptTree.value.length > 0) {
      const rootIds = new Set(deptTree.value.map(d => d.id));
      expandedDepts.value = rootIds;
    }
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

    // 预加载新加载用户的头像
    preloadUserAvatars(records);
  } catch (e) { /* keep current */ }
  finally { loading.value = false; }
}

/** 批量预加载用户头像 */
async function preloadUserAvatars(users) {
  const urls = users
    .map(u => getImageUrl(u.avatarUrl))
    .filter(Boolean);
  if (!urls.length) return;
  try {
    const results = await preloadImages(urls);
    const map = { ...avatarMap.value };
    results.forEach((localPath, url) => {
      map[url] = localPath;
    });
    avatarMap.value = map;
  } catch (e) {
    // 预加载失败，回退到直接加载
    console.warn('[contacts] avatar preload failed:', e);
  }
}

function onSearch() {
  loadUsers(true);
}

// 实时搜索：输入变化 300ms 后自动触发
watch(keyword, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadUsers(true);
  }, 300);
});

function onDeptClick(d) {
  // 如果点击的部门有子部门，先切换展开
  if (d.hasChildren) {
    toggleDept(d.id);
  }
  // 切换当前选中部门来筛选用户
  const newId = String(d.id || "");
  currentDeptId.value = currentDeptId.value === newId ? "" : newId;
  loadUsers(true);
}

function loadMore() {
  if (loading.value) return;
  if (totalLoaded.value >= totalCount.value) return;
  pageNum.value++;
  loadUsers(false);
}

async function onRefresh() {
  if (refreshing.value) return;
  refreshing.value = true;
  try {
    await Promise.all([loadDept(), loadUsers(true)]);
  } finally {
    refreshing.value = false;
  }
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
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-page);
}

/* ===== 搜索栏 —— 独立白色卡片 ===== */
.ct-search {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-light);
  gap: 8px;
  flex-shrink: 0;
}

.ct-search-input {
  flex: 1;
  padding: 9px 14px;
  background: var(--bg-input);
  border-radius: var(--radius-full);
  font-size: 14px;
  height: 36px;
  line-height: 36px;
  color: var(--text-primary);
}

.ct-search-input::placeholder {
  color: var(--text-tertiary);
  font-size: 13px;
}

.ct-search-btn {
  font-size: 14px;
  color: var(--color-primary);
  padding: 0 8px;
  font-weight: 500;
}

.ct-search-btn:active {
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

/* ===== 主体区域 ===== */
.ct-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ===== 左侧部门树 ===== */
.ct-tree {
  width: 130px;
  background: var(--bg-card);
  border-right: 1px solid var(--border-light);
  flex-shrink: 0;
}

.ct-tree-item {
  padding: 10px 10px 10px 4px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
  cursor: pointer;
  min-height: 36px;
}

.ct-tree-item:active {
  background: var(--bg-hover);
  transition: background var(--transition-fast);
}

.ct-tree-item.active {
  background: #eff6ff;
}

.ct-tree-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--color-primary);
  border-radius: 0 2px 2px 0;
}

.ct-tree-arrow {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  line-height: 1;
}

.ct-tree-arrow-placeholder {
  visibility: hidden;
}

.ct-tree-text {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.ct-tree-item.active .ct-tree-text {
  color: var(--color-primary);
  font-weight: 600;
}

.ct-tree-count {
  font-size: 10px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.ct-empty-tree {
  padding: 24px 0;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 12px;
}

/* ===== 右侧员工列表 ===== */
.ct-list {
  flex: 1;
  background: var(--bg-card);
}

.ct-empty {
  padding: 48px 0;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
}

.ct-user {
  display: flex;
  align-items: center;
  padding: 14px 14px;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
}

.ct-user:active {
  background: var(--bg-hover);
  transition: background var(--transition-fast);
}

.ct-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin-right: 12px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.ct-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.ct-user-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ct-user-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ct-user-name {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 600;
}

.ct-user-position {
  font-size: 10px;
  color: var(--color-primary);
  background: #eff6ff;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  font-weight: 500;
  white-space: nowrap;
}

.ct-user-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ct-loading {
  text-align: center;
  padding: 12px;
  color: var(--text-tertiary);
  font-size: 12px;
}
</style>
