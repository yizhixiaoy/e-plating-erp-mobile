<template>
  <view class="go-container">
    <!-- 顶部搜索 + 操作栏 -->
    <view class="header-bar">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input v-model="keyword" class="search-input" placeholder="搜索编号 / 客户 / 货物" @confirm="load" />
      </view>
      <view class="bar-actions">
        <view class="bar-btn bar-img" @click="startImageSearch">📷</view>
        <view class="bar-btn bar-add" @click="goCreate">＋</view>
        <view class="bar-btn bar-refresh" @click="load">↻</view>
      </view>
    </view>

    <!-- 状态筛选 -->
    <scroll-view scroll-x class="status-tabs" :show-scrollbar="false">
      <view
        v-for="s in statusList"
        :key="s.value"
        :class="['tab', currentStatus === s.value ? 'active' : '']"
        @click="onStatusChange(s.value)"
      >
        <text>{{ s.label }}</text>
      </view>
    </scroll-view>

    <!-- 开单列表 -->
    <scroll-view scroll-y class="go-list" @scrolltolower="loadMore">
      <view v-if="rows.length === 0 && !loading" class="empty-state">
        <text class="empty-text">暂无开单数据</text>
      </view>

      <view v-for="item in rows" :key="item.id" class="go-card" :style="{ borderLeftColor: statusBorderColor(item.status) }" @click="goDetail(item)">
        <view class="go-card-header">
          <text class="go-order-no">{{ item.orderNo }}</text>
          <text :class="['go-status', statusClass(item.status)]">{{ statusLabel(item.status) }}</text>
        </view>
        <view class="go-card-body">
          <view class="go-info-row">
            <text class="go-label">客户</text>
            <text class="go-value">{{ item.customerName || '--' }}</text>
          </view>
          <view class="go-info-row">
            <text class="go-label">部门</text>
            <text class="go-value">{{ item.departmentName || '--' }}</text>
          </view>
          <view class="go-info-row">
            <text class="go-label">数量</text>
            <text class="go-value">{{ item.totalQuantity || 0 }}（{{ item.totalItems || 0 }}项）</text>
          </view>
          <view class="go-info-row">
            <text class="go-label">操作人</text>
            <text class="go-value">{{ item.operatorName || '--' }}</text>
          </view>
        </view>
        <view class="go-card-footer">
          <text class="go-time">{{ formatTime(item.createdAt) }}</text>
        </view>
      </view>

      <view v-if="hasMore" class="load-more">
        <text>加载更多...</text>
      </view>
    </scroll-view>

    <!-- 图片来源选择弹层 -->
    <view v-if="showSourcePicker" class="img-overlay" @click="showSourcePicker = false">
      <view class="src-panel" @click.stop>
        <view class="src-panel-head">
          <text class="src-panel-title">选择图片来源</text>
        </view>
        <view class="src-actions">
          <view class="src-btn camera" @click="doPickImage('camera')">
            <text class="src-btn-icon">📷</text>
            <text class="src-btn-label">拍照</text>
          </view>
          <view class="src-btn album" @click="doPickImage('album')">
            <text class="src-btn-icon">🖼️</text>
            <text class="src-btn-label">从相册选择</text>
          </view>
        </view>
        <view class="src-cancel" @click="showSourcePicker = false">取消</view>
      </view>
    </view>

    <!-- 图片搜索弹层 -->
    <view v-if="imgSearchVisible" class="img-overlay" @click="closeImageSearch">
      <view class="img-panel" @click.stop>
        <view class="img-panel-head">
          <text class="img-panel-title">图片搜索</text>
          <text class="img-panel-close" @click="closeImageSearch">✕</text>
        </view>
        <view v-if="imgSearching" class="img-loading">
          <text>正在识别图片...</text>
        </view>
        <view v-else-if="imgResults.length === 0" class="img-empty">
          <text>未找到相似货物</text>
        </view>
        <scroll-view v-else scroll-y class="img-result-list">
          <view v-for="r in imgResults" :key="r.itemId" class="img-result-card" @click="goImageResultDetail(r)">
            <image v-if="r.thumbnailUrl" :src="r.thumbnailUrl" class="img-thumb" mode="aspectFill" />
            <view class="img-info">
              <text class="img-item-name">{{ r.itemName }}</text>
              <text class="img-order-no">{{ r.orderNo }}</text>
              <text class="img-similarity">相似度 {{ (r.similarity * 100).toFixed(1) }}%</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import * as http from "../../utils/request.js";
import { uploadFile } from "../../utils/file-upload.js";
import apiCfg from "../../config/api.js";

const keyword = ref("");
const currentStatus = ref("");
const loading = ref(false);
const rows = ref([]);
const pageNum = ref(1);
const pageSize = 20;
const hasMore = ref(true);

// 图片来源选择器
const showSourcePicker = ref(false);

// 图片搜索状态
const imgSearchVisible = ref(false);
const imgSearching = ref(false);
const imgResults = ref([]);

const statusList = [
  { label: "全部", value: "" },
  { label: "草稿", value: "DRAFT" },
  { label: "待分发", value: "PENDING_DISTRIBUTE" },
  { label: "加工中", value: "PROCESSING" },
  { label: "已完成", value: "COMPLETED" },
  { label: "已取消", value: "CANCELLED" }
];

function statusClass(status) {
  const map = { DRAFT: "draft", PENDING_DISTRIBUTE: "pending", PROCESSING: "processing", COMPLETED: "completed", CANCELLED: "cancelled" };
  return map[status] || "";
}

function statusLabel(status) {
  const map = { DRAFT: "草稿", PENDING_DISTRIBUTE: "待分发", PROCESSING: "加工中", COMPLETED: "已完成", CANCELLED: "已取消" };
  return map[status] || status;
}

function statusBorderColor(status) {
  const map = { DRAFT: "#cbd5e1", PENDING_DISTRIBUTE: "#f59e0b", PROCESSING: "#3b82f6", COMPLETED: "#10b981", CANCELLED: "#ef4444" };
  return map[status] || "#cbd5e1";
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return month + "月" + day + "日";
}

function onStatusChange(val) {
  currentStatus.value = val;
  pageNum.value = 1;
  hasMore.value = true;
  load();
}

async function load() {
  if (loading.value) return;
  loading.value = true;
  pageNum.value = 1;
  try {
    const url = apiCfg.getUrl("/goods/orders");
    const res = await http.get(url, {
      page: pageNum.value,
      size: pageSize,
      keyword: keyword.value || undefined,
      status: currentStatus.value || undefined
    });
    const data = res.data;
    if (data && data.records) {
      rows.value = data.records;
      hasMore.value = data.records.length >= pageSize;
    } else {
      rows.value = [];
      hasMore.value = false;
    }
  } catch (e) {
    rows.value = [];
    hasMore.value = false;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loading.value || !hasMore.value) return;
  loading.value = true;
  pageNum.value++;
  try {
    const url = apiCfg.getUrl("/goods/orders");
    const res = await http.get(url, {
      page: pageNum.value,
      size: pageSize,
      keyword: keyword.value || undefined,
      status: currentStatus.value || undefined
    });
    const data = res.data;
    if (data && data.records) {
      rows.value.push(...data.records);
      hasMore.value = data.records.length >= pageSize;
    } else {
      hasMore.value = false;
    }
  } catch {
    pageNum.value--;
    hasMore.value = false;
  } finally {
    loading.value = false;
  }
}

function goDetail(item) {
  uni.navigateTo({
    url: "/pages/goods-order/detail?id=" + item.id + "&orderNo=" + item.orderNo
  });
}

function goCreate() {
  uni.navigateTo({ url: "/pages/goods-order/order" });
}

async function startImageSearch() {
  showSourcePicker.value = true;
}

async function doPickImage(type) {
  showSourcePicker.value = false;
  // 延迟一帧确保弹层关闭后再打开相机，避免 UI 遮挡
  setTimeout(() => {
    doImageSearch([type]);
  }, 100);
}

async function doImageSearch(sourceType) {
  try {
    const res = await uni.chooseImage({ count: 1, sizeType: ["compressed"], sourceType });
    const filePath = res.tempFilePaths[0];
    imgSearchVisible.value = true;
    imgSearching.value = true;
    imgResults.value = [];
    uni.showLoading({ title: "上传中..." });
    const uploadRes = await uploadFile(filePath, "goods");
    const imageUrl = uploadRes.ossPath || uploadRes.url || uploadRes.path;
    uni.hideLoading();
    uni.showLoading({ title: "搜索中..." });
    const searchUrl = apiCfg.getUrl("/goods/process/search/image") + "?imageUrl=" + encodeURIComponent(imageUrl) + "&threshold=0.7";
    const searchRes = await http.post(searchUrl);
    uni.hideLoading();
    const data = searchRes.data;
    if (data && Array.isArray(data)) {
      imgResults.value = data;
    } else if (data && data.data && Array.isArray(data.data)) {
      imgResults.value = data.data;
    } else {
      imgResults.value = [];
    }
  } catch (e) {
    uni.hideLoading();
    imgResults.value = [];
    const msg = e.message || "图片搜索失败";
    if (msg !== "UNAUTHORIZED") {
      uni.showToast({ title: msg, icon: "none" });
    }
  } finally {
    imgSearching.value = false;
  }
}

function closeImageSearch() {
  imgSearchVisible.value = false;
  imgResults.value = [];
}

function goImageResultDetail(r) {
  closeImageSearch();
  uni.navigateTo({
    url: "/pages/goods-order/detail?itemId=" + r.itemId + "&orderNo=" + r.orderNo
  });
}

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
.go-container {
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
.bar-img {
  background: #f8fafc;
  border: 1.5rpx solid #e8ecf1;
}
.bar-img:active {
  background: #eff6ff;
  border-color: #3b82f6;
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

/* ===== 状态筛选 ===== */
.status-tabs {
  display: flex;
  white-space: nowrap;
  padding: 12rpx 24rpx 20rpx;
  background: #fff;
}
.status-tabs .tab {
  display: inline-flex;
  align-items: center;
  padding: 12rpx 28rpx;
  margin-right: 16rpx;
  font-size: 26rpx;
  color: #64748b;
  border-radius: 32rpx;
  background: #f0f2f5;
  transition: all 0.2s;
}
.status-tabs .tab.active {
  color: #fff;
  background: #3b82f6;
  box-shadow: 0 4rpx 12rpx rgba(59,130,246,0.35);
  font-weight: 500;
}

/* ===== 列表（关键：scroll-view 必须可滚动） ===== */
.go-list {
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
.go-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin: 0 24rpx 20rpx;
  box-shadow: 0 2rpx 16rpx rgba(0,0,0,0.06);
  border-left: 4rpx solid transparent;
  border-right: 4rpx solid transparent;
  transition: transform 0.15s, box-shadow 0.15s;
}
.go-card:active {
  transform: scale(0.985);
  box-shadow: 0 1rpx 8rpx rgba(0,0,0,0.04);
}
.go-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.go-order-no {
  font-size: 30rpx;
  font-weight: 700;
  color: #1e293b;
}
.go-status {
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}
.go-status.draft { background: #f1f5f9; color: #64748b; }
.go-status.pending { background: #fef3c7; color: #b45309; }
.go-status.processing { background: #dbeafe; color: #2563eb; }
.go-status.completed { background: #d1fae5; color: #059669; }
.go-status.cancelled { background: #fee2e2; color: #dc2626; }

.go-card-body {
  padding: 8rpx 0;
}
.go-info-row {
  display: flex;
  padding: 6rpx 0;
}
.go-label {
  width: 100rpx;
  font-size: 26rpx;
  color: #94a3b8;
}
.go-value {
  flex: 1;
  font-size: 26rpx;
  color: #334155;
}
.go-card-footer {
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.go-time {
  font-size: 24rpx;
  color: #94a3b8;
}
.go-card-arrow {
  font-size: 28rpx;
  color: #cbd5e1;
}

.load-more {
  text-align: center;
  padding: 24rpx 0;
  color: #94a3b8;
  font-size: 26rpx;
  margin: 0 24rpx;
}

/* 图片搜索弹层 */
.img-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}
.img-panel {
  width: 100%;
  max-height: 70vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}
.img-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 30rpx;
  border-bottom: 1rpx solid #e2e8f0;
}
.img-panel-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1e293b;
}
.img-panel-close {
  font-size: 36rpx;
  color: #94a3b8;
  padding: 8rpx;
}
.img-loading {
  text-align: center;
  padding: 80rpx 0;
  color: #64748b;
  font-size: 28rpx;
}
.img-empty {
  text-align: center;
  padding: 80rpx 0;
  color: #94a3b8;
  font-size: 28rpx;
}
.img-result-list {
  padding: 16rpx 30rpx;
  max-height: 60vh;
}
.img-result-card {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f1f5f9;
}
.img-thumb {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  background: #f1f5f9;
  flex-shrink: 0;
}
.img-info {
  flex: 1;
  margin-left: 20rpx;
}
.img-item-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1e293b;
}
.img-order-no {
  font-size: 26rpx;
  color: #64748b;
  margin-top: 4rpx;
}
.img-similarity {
  font-size: 24rpx;
  color: #3b82f6;
  margin-top: 4rpx;
}

/* 图片来源选择弹层 */
.src-panel {
  width: 100%;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}
.src-panel-head {
  text-align: center;
  padding: 24rpx 30rpx 16rpx;
  border-bottom: 1rpx solid #f1f5f9;
}
.src-panel-title {
  font-size: 28rpx;
  color: #64748b;
}
.src-actions {
  display: flex;
  padding: 30rpx;
  gap: 30rpx;
}
.src-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36rpx 0;
  border-radius: 16rpx;
  background: #f8fafc;
}
.src-btn-icon {
  font-size: 48rpx;
  margin-bottom: 12rpx;
}
.src-btn-label {
  font-size: 28rpx;
  color: #334155;
  font-weight: 500;
}
.src-cancel {
  text-align: center;
  padding: 24rpx 30rpx;
  font-size: 30rpx;
  color: #94a3b8;
  border-top: 1rpx solid #f1f5f9;
}
</style>
