<template>
  <view class="ct-container">
    <!-- 顶部搜索 + 操作栏 -->
    <view class="header-bar">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input v-model="keyword" class="search-input" placeholder="搜索公司 / 联系人 / 电话" @input="onSearchInput" />
      </view>
      <view class="bar-actions">
        <view class="bar-btn bar-add" @click="showAddDialog">＋</view>
        <view class="bar-btn bar-refresh" @click="load">↻</view>
      </view>
    </view>

    <!-- 客户列表 -->
    <scroll-view scroll-y class="ct-list" @scrolltolower="loadMore">
      <view v-if="rows.length === 0 && !loading" class="empty-state">
        <text class="empty-text">暂无客户数据</text>
      </view>

      <view v-for="item in rows" :key="item.id" class="ct-card" :style="{ borderLeftColor: avatarColor(item.customerName) }">
        <view class="ct-card-header">
          <view class="ct-avatar" :style="{ background: avatarColor(item.customerName) }">
            <text class="ct-avatar-text">{{ (item.customerName || '?')[0] }}</text>
          </view>
          <view class="ct-header-info">
            <text class="ct-name">{{ item.customerName }}</text>
            <text v-if="item.contactPerson" class="ct-contact-brief">{{ item.contactPerson }}{{ item.contactPhone ? ' · ' + item.contactPhone : '' }}</text>
          </view>
        </view>
        <view class="ct-card-body" v-if="item.address || item.remark">
          <view class="ct-info-row" v-if="item.address">
            <text class="ct-label">地址</text>
            <text class="ct-value">{{ item.address }}</text>
          </view>
          <view class="ct-info-row" v-if="item.remark">
            <text class="ct-label">备注</text>
            <text class="ct-value">{{ item.remark }}</text>
          </view>
        </view>
        <view class="ct-card-footer">
          <text class="ct-time">{{ formatTime(item.createdAt) }}</text>
          <view class="ct-card-actions">
            <text class="ct-action-edit" @click.stop="showEditDialog(item)">编辑</text>
            <text class="ct-action-del" @click.stop="handleDelete(item)">删除</text>
          </view>
        </view>
      </view>

      <view v-if="hasMore" class="load-more">
        <text>加载更多...</text>
      </view>
    </scroll-view>

    <ConfirmDialog />
  </view>
</template>

<script setup>
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import * as http from "../../utils/request.js";
import apiCfg from "../../config/api.js";
import { showConfirm } from "../../utils/dialog.js";

// ---------- 列表 ----------
const loading = ref(false);
const keyword = ref("");
const rows = ref([]);
const pageNum = ref(1);
const pageSize = ref(20);
const hasMore = ref(false);

async function load() {
  loading.value = true;
  pageNum.value = 1;
  try {
    const url = apiCfg.getUrl("/customers") + "?keyword=" + encodeURIComponent(keyword.value || "") + "&pageNum=" + pageNum.value + "&pageSize=" + pageSize.value;
    const res = await http.get(url);
    const data = res.data;
    if (data && data.records) {
      rows.value = data.records;
      hasMore.value = data.records.length >= pageSize.value;
    } else {
      rows.value = [];
      hasMore.value = false;
    }
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

// 实时搜索（防抖 300ms）
let searchTimer = null;
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    load();
  }, 300);
}

async function loadMore() {
  if (!hasMore.value || loading.value) return;
  loading.value = true;
  try {
    pageNum.value++;
    const url = apiCfg.getUrl("/customers") + "?keyword=" + encodeURIComponent(keyword.value || "") + "&pageNum=" + pageNum.value + "&pageSize=" + pageSize.value;
    const res = await http.get(url);
    const data = res.data;
    if (data && data.records && data.records.length > 0) {
      rows.value = rows.value.concat(data.records);
      hasMore.value = data.records.length >= pageSize.value;
    } else {
      hasMore.value = false;
    }
  } catch {
    hasMore.value = false;
  } finally {
    loading.value = false;
  }
}

// ---------- 新增/编辑 ----------
function showAddDialog() {
  uni.navigateTo({ url: "/pages/goods-order/customer-form" });
}

function showEditDialog(row) {
  const data = {
    id: row.id,
    customerName: row.customerName || "",
    contactPerson: row.contactPerson || "",
    contactPhone: row.contactPhone || "",
    address: row.address || "",
    remark: row.remark || "",
  };
  const encoded = encodeURIComponent(JSON.stringify(data));
  uni.navigateTo({ url: "/pages/goods-order/customer-form?mode=edit&data=" + encoded });
}

// ---------- 删除 ----------
async function handleDelete(row) {
  const confirmed = await showConfirm({
    title: "删除确认",
    content: "确认删除客户公司「" + row.customerName + "」？"
  });
  if (!confirmed) return;
  try {
    await http.del(apiCfg.getUrl("/customers/" + row.id));
    uni.showToast({ title: "已删除", icon: "success" });
    await load();
  } catch (err) {
    const msg = (err && err.data && err.data.msg) || "删除失败";
    uni.showToast({ title: msg, icon: "none" });
  }
}

// ---------- 工具函数 ----------
function formatTime(val) {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  } catch {
    return String(val);
  }
}

const avatarPalette = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
function avatarColor(name) {
  if (!name) return avatarPalette[0];
  const code = name.charCodeAt(0);
  return avatarPalette[code % avatarPalette.length];
}

// 初始化
onShow(() => {
  load();
});
</script>

<style>
page {
  background-color: #f2f4f8;
}
</style>

<style scoped>
.ct-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* ===== 顶部搜索+操作栏（单行整合） ===== */
.header-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background: #fff;
  gap: 12rpx;
}
.search-box {
  flex: 1;
  min-width: 0;
  height: 68rpx;
  background: #f8fafc;
  border-radius: 34rpx;
  border: 1.5rpx solid #e8ecf1;
  display: flex;
  align-items: center;
  padding-left: 20rpx;
  transition: border-color 0.2s;
}
.search-icon {
  font-size: 26rpx;
  color: #94a3b8;
  margin-right: 8rpx;
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  height: 68rpx;
  font-size: 28rpx;
  background: transparent;
}
.bar-actions {
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-shrink: 0;
}
.bar-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  transition: all 0.15s;
}
.bar-add {
  background: #3b82f6;
  color: #fff;
  box-shadow: 0 3rpx 10rpx rgba(59,130,246,0.35);
  font-weight: 600;
}
.bar-add:active {
  transform: scale(0.9);
  box-shadow: 0 1rpx 4rpx rgba(59,130,246,0.2);
}
.bar-refresh {
  background: #fff;
  color: #64748b;
  border: 1.5rpx solid #e2e8f0;
}
.bar-refresh:active {
  background: #f8fafc;
  border-color: #cbd5e1;
}

/* ===== 列表（height:0+flex:1 保证可滚动） ===== */
.ct-list {
  flex: 1;
  height: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 20rpx 0;
}
.empty-state {
  text-align: center;
  padding: 160rpx 0;
  margin: 0 24rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #94a3b8;
}

/* ===== 卡片 ===== */
.ct-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin: 0 24rpx 20rpx;
  box-shadow: 0 2rpx 16rpx rgba(0,0,0,0.06);
  border-left: 4rpx solid transparent;
  border-right: 4rpx solid transparent;
  transition: transform 0.15s, box-shadow 0.15s;
}
.ct-card:active {
  transform: scale(0.985);
}

.ct-card-header {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}
.ct-avatar {
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.12);
}
.ct-avatar-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #fff;
}
.ct-header-info {
  flex: 1;
  min-width: 0;
}
.ct-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #1e293b;
  display: block;
}
.ct-contact-brief {
  font-size: 26rpx;
  color: #64748b;
  margin-top: 4rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ct-card-body {
  padding: 8rpx 0;
  margin-left: 100rpx;
}
.ct-info-row {
  display: flex;
  padding: 4rpx 0;
}
.ct-label {
  width: 80rpx;
  font-size: 24rpx;
  color: #94a3b8;
  flex-shrink: 0;
}
.ct-value {
  flex: 1;
  font-size: 26rpx;
  color: #475569;
}

.ct-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #f1f5f9;
}
.ct-time {
  font-size: 24rpx;
  color: #94a3b8;
}
.ct-card-actions {
  display: flex;
  gap: 24rpx;
}
.ct-action-edit {
  font-size: 26rpx;
  color: #3b82f6;
  padding: 6rpx 12rpx;
}
.ct-action-edit:active {
  opacity: 0.7;
}
.ct-action-del {
  font-size: 26rpx;
  color: #ef4444;
  padding: 6rpx 12rpx;
}
.ct-action-del:active {
  opacity: 0.7;
}

.load-more {
  text-align: center;
  padding: 24rpx 0;
  color: #94a3b8;
  font-size: 26rpx;
  margin: 0 24rpx;
}


</style>
