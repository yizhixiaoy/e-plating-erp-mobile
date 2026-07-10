<template>
  <view class="go-container">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input v-model="keyword" class="search-input" placeholder="搜索货物名称 / 开单编号" @confirm="doSearch" />
      </view>
      <view class="img-search-btn" @click="startImageSearch">
        <text class="img-search-icon">📷</text>
      </view>
    </view>

    <!-- 搜索结果列表 -->
    <scroll-view scroll-y class="result-scroll">
      <view v-if="searchResults.length === 0 && !searching" class="empty-state">
        <text class="empty-text">输入关键字搜索待加工货物</text>
      </view>

      <view v-for="r in searchResults" :key="r.orderId" class="result-card" :style="{ borderLeftColor: statusBorderColor(r.status) }" @click="selectResult(r)">
        <view class="result-card-head">
          <text class="result-order-no">{{ r.orderNo }}</text>
          <text :class="['result-status', statusClass(r.status)]">{{ statusLabel(r.status) }}</text>
        </view>
        <view class="result-card-body">
          <view class="result-info">
            <text class="result-label">客户</text>
            <text class="result-value">{{ r.customerName || '--' }}</text>
          </view>
          <view class="result-info">
            <text class="result-label">货物数</text>
            <text class="result-value">{{ r.totalItems || 0 }}项</text>
          </view>
          <view v-if="r.currentNode" class="result-info">
            <text class="result-label">当前阶段</text>
            <text class="result-value result-node-dept">{{ r.currentNode.departmentName }}</text>
            <text :class="['result-node-status', 'ns-' + r.currentNode.status]">{{ nodeStatusLabel(r.currentNode.status) }}</text>
          </view>
        </view>
        <view class="result-card-footer">
          <text class="result-time">{{ formatTime(r.createdAt) }}</text>
          <text class="result-arrow">›</text>
        </view>
      </view>

      <view v-if="hasMore && searchResults.length > 0" class="load-more" @click="loadMore">
        <text>加载更多...</text>
      </view>
    </scroll-view>

    <!-- 加工录入弹层 -->
    <view v-if="selectedOrder" class="img-overlay picker-overlay" @click="closeProcess">
      <view class="process-panel" @click.stop>
        <view class="process-panel-head">
          <text class="process-panel-title">录入加工数据</text>
          <text class="process-panel-close" @click="closeProcess">✕</text>
        </view>
        <scroll-view scroll-y class="process-body">
          <view class="order-summary">
            <text class="summary-no">{{ selectedOrder.orderNo }}</text>
            <text class="summary-customer">{{ selectedOrder.customerName }}</text>
          </view>

          <!-- 加工节点选择 -->
          <view v-if="selectedOrder.nodes && selectedOrder.nodes.length > 0" class="form-section">
            <text class="form-label">选择加工节点</text>
            <view v-for="node in selectedOrder.nodes" :key="node.id" :class="['node-option', currentNodeId === node.id ? 'active' : '']" @click="selectNode(node)">
              <view class="node-option-info">
                <text class="node-option-dept">{{ node.departmentName }}</text>
                <text class="node-option-status">{{ nodeStatusLabel(node.status) }}</text>
              </view>
              <view v-if="node.operatorName" class="node-option-operator">
                <text class="node-op-text">{{ node.operatorName }}</text>
                <text v-if="node.processedAt" class="node-op-time">{{ formatTime(node.processedAt) }}</text>
              </view>
              <text v-if="currentNodeId === node.id" class="node-check">✓</text>
            </view>
          </view>
          <view v-else class="form-section">
            <text class="no-nodes-text">暂无可加工的节点（请先分发开单）</text>
          </view>

          <!-- 加工表单 -->
          <template v-if="currentNodeId">
            <view class="form-section">
              <text class="form-label">原始数量</text>
              <text class="form-static-value">{{ currentNodeOriginalQty || '--' }}</text>
            </view>

            <view class="form-section">
              <text class="form-label">加工后数量 <text class="required">*</text></text>
              <input v-model="processForm.processedQuantity" class="form-input" type="digit" placeholder="请输入加工后数量" />
            </view>

            <view class="form-section">
              <text class="form-label">加工备注</text>
              <textarea v-model="processForm.remark" class="form-textarea" placeholder="选填" maxlength="512" />
            </view>

            <view class="form-section">
              <text class="form-label">加工后照片</text>
              <view class="photo-area">
                <view v-for="(url, pIdx) in processForm.afterPhotoUrls" :key="pIdx" class="photo-item">
                  <image :src="url" class="photo-img" mode="aspectFill" />
                  <text class="photo-del" @click="removeProcessPhoto(pIdx)">✕</text>
                </view>
                <view class="photo-add" @click="startPickProcessPhoto">
                  <text class="photo-add-icon">+</text>
                </view>
              </view>
            </view>

            <button class="btn-submit-full" @click="handleSubmitProcess" :disabled="submittingProcess">
              {{ submittingProcess ? '提交中...' : '确认录入' }}
            </button>

            <!-- 变更记录 -->
            <view class="change-log-section" v-if="selectedOrder">
              <view class="change-log-header">
                <text class="change-log-title">变更记录</text>
                <text class="link-btn" @click="loadChangeLogs">{{ changeLogLoading ? '加载中...' : '查看' }}</text>
              </view>
              <view v-if="changeLogLoading" style="text-align: center; padding: 20rpx 0; color: #94a3b8;">
                <text>加载中...</text>
              </view>
              <view v-else-if="orderChangeLogs && orderChangeLogs.length > 0">
                <view v-for="(log, idx) in orderChangeLogs" :key="idx" class="change-log-item">
                  <view class="change-log-item-head">
                    <text class="change-log-type">{{ log.changeTypeName || '变更' }}</text>
                    <text class="change-log-time">{{ formatTime(log.changedAt) }}</text>
                  </view>
                  <view class="change-log-item-body">
                    <!-- Map格式多字段 -->
                    <view v-if="parseChangeFields(log.oldValue, log.newValue).length > 0">
                      <view v-for="(f, fi) in parseChangeFields(log.oldValue, log.newValue)" :key="fi" class="change-log-field-row">
                        <text class="change-log-field-label">{{ f.label }}</text>
                        <text v-if="f.oldVal !== '—'" class="change-log-old">{{ f.oldVal }}</text>
                        <text v-if="f.oldVal !== '—' && f.newVal !== '—'" class="change-log-arrow"> → </text>
                        <text v-if="f.newVal !== '—'" class="change-log-new">{{ f.newVal }}</text>
                      </view>
                    </view>
                    <!-- 单字段旧格式 -->
                    <view v-else>
                      <text v-if="log.fieldName" class="change-log-field">{{ fieldLabel(log.fieldName) }}</text>
                      <view v-if="log.oldValue != null || log.newValue != null" class="change-log-values">
                        <text v-if="log.oldValue != null" class="change-log-old">{{ log.oldValue }}</text>
                        <text v-if="log.newValue != null" class="change-log-arrow"> → </text>
                        <text v-if="log.newValue != null" class="change-log-new">{{ log.newValue }}</text>
                      </view>
                    </view>
                    <text v-if="log.remark" class="change-log-remark">{{ log.remark }}</text>
                  </view>
                  <text class="change-log-operator">操作人: {{ log.changedByName || '--' }}</text>
                </view>
              </view>
              <view v-else-if="!changeLogLoading" style="text-align: center; padding: 20rpx 0; color: #94a3b8;">
                <text>暂无变更记录</text>
              </view>
            </view>
          </template>
        </scroll-view>
      </view>
    </view>

    <!-- 图片来源选择弹层 -->
    <view v-if="showSourcePicker" class="img-overlay" @click="showSourcePicker = false">
      <view class="src-panel" @click.stop>
        <view class="src-panel-head">
          <text class="src-panel-title">选择图片来源</text>
        </view>
        <view class="src-actions">
          <view class="src-btn camera" @click="doPickPhoto('camera')">
            <text class="src-btn-icon">📷</text>
            <text class="src-btn-label">拍照</text>
          </view>
          <view class="src-btn album" @click="doPickPhoto('album')">
            <text class="src-btn-icon">🖼️</text>
            <text class="src-btn-label">从相册选择</text>
          </view>
        </view>
        <view class="src-cancel" @click="showSourcePicker = false">取消</view>
      </view>
    </view>

    <!-- 图片搜索结果弹层 -->
    <view v-if="imgSearchVisible" class="img-overlay" @click="closeImageSearch">
      <view class="img-panel" @click.stop>
        <view class="img-panel-head">
          <text class="img-panel-title">图片搜索结果</text>
          <text class="img-panel-close" @click="closeImageSearch">✕</text>
        </view>
        <view v-if="imgSearching" class="img-loading">
          <text>正在识别图片...</text>
        </view>
        <view v-else-if="imgMatchResults.length === 0" class="img-empty">
          <text>未找到相似货物</text>
        </view>
        <scroll-view v-else scroll-y class="img-result-list">
          <view v-for="r in imgMatchResults" :key="r.itemId" class="img-result-card" @click="goImgResultOrder(r)">
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
import { ref, reactive } from "vue";
import * as http from "../../utils/request.js";
import { uploadFile } from "../../utils/file-upload.js";
import apiCfg from "../../config/api.js";

const keyword = ref("");
const searching = ref(false);
const searchResults = ref([]);
const pageNum = ref(1);
const pageSize = 20;
const hasMore = ref(true);

// 选中订单及节点
const selectedOrder = ref(null);
const currentNodeId = ref(null);
const currentNodeOriginalQty = ref(null);
const submittingProcess = ref(false);

// 变更记录
const orderChangeLogs = ref(null);
const changeLogLoading = ref(false);

const processForm = reactive({
  processedQuantity: "",
  remark: "",
  afterPhotoUrls: []
});

// 图片来源选择器
const showSourcePicker = ref(false);
const pickMode = ref("search"); // "search" for image search, "process" for process photos

// 图片搜索
const imgSearchVisible = ref(false);
const imgSearching = ref(false);
const imgMatchResults = ref([]);

function statusClass(status) {
  const map = { DRAFT: "draft", PENDING_DISTRIBUTE: "pending", PROCESSING: "processing", COMPLETED: "completed", CANCELLED: "cancelled" };
  return map[status] || "";
}

function statusBorderColor(status) {
  const map = { DRAFT: "#cbd5e1", PENDING_DISTRIBUTE: "#f59e0b", PROCESSING: "#3b82f6", COMPLETED: "#10b981", CANCELLED: "#ef4444" };
  return map[status] || "#cbd5e1";
}

function statusLabel(status) {
  const map = { DRAFT: "草稿", PENDING_DISTRIBUTE: "待分发", PROCESSING: "加工中", COMPLETED: "已完成", CANCELLED: "已取消" };
  return map[status] || status;
}

function nodeStatusLabel(status) {
  const map = { PENDING: "待处理", ACCEPTING: "接货中", PROCESSING: "加工中", PROCESSED: "已加工", DELIVERING: "送货中", DRIVER_DELIVERED: "已送达", COMPLETED: "已完成" };
  return map[status] || status;
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
  return (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

function fieldLabel(f) {
  const map = { processedQuantity: '加工后数量', lossQuantity: '损耗数量', remark: '备注', status: '状态', operatorName: '操作人', processedAt: '加工时间', rollback: '回退', deleted: '删除' };
  return map[f] || f;
}

function parseChangeFields(oldValue, newValue) {
  const result = [];
  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(oldValue) && !isObj(newValue)) return result;
  const keys = new Set([...Object.keys(isObj(oldValue) ? oldValue : {}), ...Object.keys(isObj(newValue) ? newValue : {})]);
  keys.forEach(k => {
    const o = isObj(oldValue) ? oldValue[k] : undefined;
    const n = isObj(newValue) ? newValue[k] : undefined;
    result.push({ label: fieldLabel(k), oldVal: (o == null || o === '') ? '—' : String(o), newVal: (n == null || n === '') ? '—' : String(n) });
  });
  return result;
}

async function doSearch() {
  pageNum.value = 1;
  hasMore.value = true;
  searching.value = true;
  try {
    const url = apiCfg.getUrl("/goods/process/search") + "?keyword=" + encodeURIComponent(keyword.value || "") + "&page=1&size=" + pageSize;
    const res = await http.get(url);
    const data = res.data;
    searchResults.value = (data && data.records) ? data.records : [];
    hasMore.value = searchResults.value.length >= pageSize;
    // 批量加载当前流程节点信息
    await loadCurrentNodes();
  } catch {
    searchResults.value = [];
  } finally {
    searching.value = false;
  }
}

async function loadCurrentNodes() {
  for (const r of searchResults.value) {
    try {
      const url = apiCfg.getUrl("/goods/process/" + r.orderId + "/nodes");
      const nodesRes = await http.get(url);
      const nodes = nodesRes.data || [];
      // 找到第一个未完成的节点作为当前阶段
      const active = nodes.find(n => n.status !== "COMPLETED" && n.status !== "PROCESSED" && n.status !== "DELIVERING" && n.status !== "DRIVER_DELIVERED");
      r.currentNode = active || (nodes.length > 0 ? nodes[nodes.length - 1] : null);
    } catch {
      r.currentNode = null;
    }
  }
}

async function loadMore() {
  if (searching.value || !hasMore.value) return;
  searching.value = true;
  pageNum.value++;
  try {
    const url = apiCfg.getUrl("/goods/process/search") + "?keyword=" + encodeURIComponent(keyword.value || "") + "&page=" + pageNum.value + "&size=" + pageSize;
    const res = await http.get(url);
    const data = res.data;
    if (data && data.records) {
      searchResults.value.push(...data.records);
      hasMore.value = data.records.length >= pageSize;
    } else {
      hasMore.value = false;
    }
  } catch {
    pageNum.value--;
    hasMore.value = false;
  } finally {
    searching.value = false;
  }
}

async function selectResult(r) {
  // 加载该开单的节点
  try {
    const url = apiCfg.getUrl("/goods/process/" + r.orderId + "/nodes");
    const res = await http.get(url);
    r.nodes = res.data || [];
    selectedOrder.value = r;
    currentNodeId.value = null;
    currentNodeOriginalQty.value = null;
    resetProcessForm();
  } catch {
    uni.showToast({ title: "加载节点失败", icon: "none" });
  }
}

function selectNode(node) {
  // 允许 PENDING、ACCEPTING、PROCESSING 状态的节点更新
  if (node.status === "COMPLETED" || node.status === "PROCESSED" || node.status === "DELIVERING" || node.status === "DRIVER_DELIVERED") {
    uni.showToast({ title: "该节点已处理完成", icon: "none" });
    return;
  }
  currentNodeId.value = node.id;
  currentNodeOriginalQty.value = node.originalQuantity;
}

function resetProcessForm() {
  processForm.processedQuantity = "";
  processForm.remark = "";
  processForm.afterPhotoUrls = [];
}

function closeProcess() {
  selectedOrder.value = null;
  resetProcessForm();
}

// 加载变更记录
async function loadChangeLogs() {
  if (!selectedOrder.value || changeLogLoading.value) return;
  changeLogLoading.value = true;
  try {
    const url = apiCfg.getUrl("/goods/versions/orders/" + selectedOrder.value.orderId + "/logs");
    const res = await http.get(url);
    orderChangeLogs.value = res.data || [];
  } catch {
    orderChangeLogs.value = [];
  } finally {
    changeLogLoading.value = false;
  }
}

// 加工照片上传
function startPickProcessPhoto() {
  pickMode.value = "process";
  showSourcePicker.value = true;
}

async function doPickPhoto(type) {
  showSourcePicker.value = false;
  setTimeout(() => {
    doUploadPhoto([type]);
  }, 100);
}

async function doUploadPhoto(sourceType) {
  try {
    const res = await uni.chooseImage({ count: 3, sizeType: ["compressed"], sourceType });
    const files = res.tempFilePaths;
    uni.showLoading({ title: "上传中..." });
    if (pickMode.value === "search") {
      // 图片搜索模式：上传后触发搜索
      const fp = files[0]; // 搜索只用第一张
      const uploadRes = await uploadFile(fp, "goods");
      const url = uploadRes.ossPath || uploadRes.url || uploadRes.path;
      uni.hideLoading();
      await searchByImageFilePath(url);
      return;
    }
    // 加工照片模式
    for (const fp of files) {
      const uploadRes = await uploadFile(fp, "goods");
      const url = uploadRes.ossPath || uploadRes.url || uploadRes.path;
      if (pickMode.value === "process") {
        processForm.afterPhotoUrls.push(url);
      }
    }
    uni.hideLoading();
  } catch (e) {
    uni.hideLoading();
    const msg = e.message || "上传失败";
    if (msg !== "UNAUTHORIZED") {
      uni.showToast({ title: msg, icon: "none" });
    }
  }
}

function removeProcessPhoto(idx) {
  processForm.afterPhotoUrls.splice(idx, 1);
}

// 提交加工数据
async function handleSubmitProcess() {
  if (!currentNodeId.value) {
    uni.showToast({ title: "请选择加工节点", icon: "none" });
    return;
  }
  if (!processForm.processedQuantity || Number(processForm.processedQuantity) <= 0) {
    uni.showToast({ title: "请输入有效的加工后数量", icon: "none" });
    return;
  }
  submittingProcess.value = true;
  try {
    const url = apiCfg.getUrl("/goods/process");
    await http.post(url, {
      nodeId: currentNodeId.value,
      processedQuantity: Number(processForm.processedQuantity),
      remark: processForm.remark,
      afterPhotoUrls: processForm.afterPhotoUrls,
      operatorId: 0
    });
    uni.showToast({ title: "录入成功", icon: "success" });
    closeProcess();
    doSearch();
  } catch { /* handled */ }
  finally {
    submittingProcess.value = false;
  }
}

// 图片搜索
function startImageSearch() {
  pickMode.value = "search";
  showSourcePicker.value = true;
}

async function searchByImageFilePath(imageUrl) {
  imgSearchVisible.value = true;
  imgSearching.value = true;
  imgMatchResults.value = [];
  uni.showLoading({ title: "搜索中..." });
  try {
    const searchUrl = apiCfg.getUrl("/goods/process/search/image") + "?imageUrl=" + encodeURIComponent(imageUrl) + "&threshold=0.7";
    const searchRes = await http.post(searchUrl);
    uni.hideLoading();
    const data = searchRes.data;
    if (data && Array.isArray(data)) {
      imgMatchResults.value = data;
    } else if (data && data.data && Array.isArray(data.data)) {
      imgMatchResults.value = data.data;
    } else {
      imgMatchResults.value = [];
    }
  } catch (e) {
    uni.hideLoading();
    imgMatchResults.value = [];
    const msg = e.message || "图片搜索失败";
    if (msg !== "UNAUTHORIZED") {
      uni.showToast({ title: msg, icon: "none" });
    }
  } finally {
    imgSearching.value = false;
  }
}

async function searchByImage(filePath) {
  imgSearchVisible.value = true;
  imgSearching.value = true;
  imgMatchResults.value = [];
  uni.showLoading({ title: "上传中..." });
  try {
    const uploadRes = await uploadFile(filePath, "goods");
    const imageUrl = uploadRes.ossPath || uploadRes.url || uploadRes.path;
    uni.hideLoading();
    uni.showLoading({ title: "搜索中..." });
    const searchUrl = apiCfg.getUrl("/goods/process/search/image") + "?imageUrl=" + encodeURIComponent(imageUrl) + "&threshold=0.7";
    const searchRes = await http.post(searchUrl);
    uni.hideLoading();
    const data = searchRes.data;
    if (data && Array.isArray(data)) {
      imgMatchResults.value = data;
    } else if (data && data.data && Array.isArray(data.data)) {
      imgMatchResults.value = data.data;
    } else {
      imgMatchResults.value = [];
    }
  } catch (e) {
    uni.hideLoading();
    imgMatchResults.value = [];
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
  imgMatchResults.value = [];
}

function goImgResultOrder(r) {
  closeImageSearch();
  // 按 orderNo 查找并选中
  keyword.value = r.orderNo;
  doSearch();
}

</script>

<style>
page { background-color: #f2f4f8; }
</style>

<style scoped>
.go-container { display: flex; flex-direction: column; height: 100vh; }

/* ===== 搜索栏 ===== */
.search-bar {
  display: flex;
  align-items: center;
  padding: 0 24rpx 16rpx;
  background: #fff;
  gap: 12rpx;
}
.search-input-wrap {
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
.img-search-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 32rpx;
  background: #f8fafc;
  border: 1.5rpx solid #e8ecf1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}
.img-search-btn:active {
  background: #eff6ff;
  border-color: #3b82f6;
}
.img-search-icon {
  font-size: 28rpx;
  line-height: 1;
}

.result-scroll { flex: 1; height: 0; width: 100%; box-sizing: border-box; padding: 20rpx 0; }
.empty-state { text-align: center; padding: 160rpx 0; margin: 0 24rpx; }
.empty-text { font-size: 28rpx; color: #94a3b8; }

.result-card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin: 0 24rpx 20rpx; box-shadow: 0 2rpx 16rpx rgba(0,0,0,0.06); border-left: 4rpx solid transparent; border-right: 4rpx solid transparent; transition: transform 0.15s, box-shadow 0.15s; }
.result-card:active { transform: scale(0.985); box-shadow: 0 1rpx 8rpx rgba(0,0,0,0.04); }
.result-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.result-order-no { font-size: 30rpx; font-weight: 700; color: #1e293b; }
.result-status { font-size: 24rpx; padding: 6rpx 16rpx; border-radius: 20rpx; font-weight: 500; }
.result-status.draft { background: #f1f5f9; color: #64748b; }
.result-status.pending { background: #fef3c7; color: #b45309; }
.result-status.processing { background: #dbeafe; color: #2563eb; }
.result-status.completed { background: #d1fae5; color: #059669; }
.result-status.cancelled { background: #fee2e2; color: #dc2626; }
.result-card-body { padding: 8rpx 0; }
.result-info { display: flex; padding: 4rpx 0; align-items: center; }
.result-label { width: 80rpx; font-size: 24rpx; color: #94a3b8; }
.result-value { font-size: 26rpx; color: #334155; }
.result-node-dept { font-weight: 500; color: #1e293b; }
.result-node-status { font-size: 20rpx; padding: 2rpx 10rpx; border-radius: 16rpx; margin-left: 8rpx; }
.ns-PENDING { background: #f1f5f9; color: #64748b; }
.ns-ACCEPTING { background: #fef3c7; color: #b45309; }
.ns-PROCESSING { background: #dbeafe; color: #2563eb; }
.result-card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 14rpx; padding-top: 14rpx; border-top: 1rpx solid #f1f5f9; }
.result-time { font-size: 24rpx; color: #94a3b8; }
.result-arrow { font-size: 32rpx; color: #cbd5e1; }
.load-more { text-align: center; padding: 24rpx 0; color: #94a3b8; font-size: 26rpx; margin: 0 24rpx; }

/* 加工弹层 */
.img-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: flex-end; }
.picker-overlay { align-items: flex-start; padding-top: calc(var(--status-bar-height) + 88rpx); }
.process-panel { width: 100%; max-height: 65vh; background: #fff; border-radius: 0 0 24rpx 24rpx; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
.process-panel-head { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 30rpx; border-bottom: 1rpx solid #e2e8f0; }
.process-panel-title { font-size: 32rpx; font-weight: 600; color: #1e293b; }
.process-panel-close { font-size: 36rpx; color: #94a3b8; padding: 8rpx; }
.process-body { padding: 20rpx 30rpx; max-height: 65vh; }
.order-summary { padding: 20rpx 24rpx; background: #f0f4ff; border-radius: 14rpx; margin-bottom: 24rpx; border-left: 4rpx solid #3b82f6; }
.summary-no { font-size: 28rpx; font-weight: 600; color: #1e293b; display: block; }
.summary-customer { font-size: 24rpx; color: #64748b; margin-top: 4rpx; }

.form-section { margin-bottom: 24rpx; }
.form-label { font-size: 28rpx; color: #334155; display: block; margin-bottom: 8rpx; }
.required { color: #ef4444; }
.form-input { height: 76rpx; background: #f8fafc; border-radius: 14rpx; padding: 0 20rpx; font-size: 28rpx; border: 1rpx solid #e8ecf1; }
.form-textarea { width: 100%; min-height: 120rpx; background: #f8fafc; border-radius: 14rpx; padding: 16rpx 20rpx; font-size: 28rpx; border: 1rpx solid #e8ecf1; box-sizing: border-box; }
.form-static-value { font-size: 28rpx; color: #64748b; padding: 16rpx 0; }

.node-option { display: flex; justify-content: space-between; align-items: center; padding: 22rpx 24rpx; background: #f8fafc; border-radius: 14rpx; margin-bottom: 12rpx; border: 2rpx solid transparent; transition: all 0.2s; }
.node-option.active { border-color: #3b82f6; background: #eff6ff; box-shadow: 0 2rpx 8rpx rgba(59,130,246,0.12); }
.node-option-dept { font-size: 28rpx; font-weight: 500; color: #1e293b; }
.node-option-status { font-size: 24rpx; color: #94a3b8; }
.node-check { font-size: 32rpx; color: #3b82f6; font-weight: 600; }
.no-nodes-text { font-size: 26rpx; color: #94a3b8; text-align: center; padding: 24rpx 0; }

.photo-area { display: flex; flex-wrap: wrap; gap: 16rpx; }
.photo-item { position: relative; width: 120rpx; height: 120rpx; border-radius: 12rpx; overflow: hidden; }
.photo-img { width: 100%; height: 100%; }
.photo-del { position: absolute; top: 4rpx; right: 4rpx; width: 36rpx; height: 36rpx; background: rgba(0,0,0,0.5); color: #fff; border-radius: 50%; text-align: center; line-height: 36rpx; font-size: 24rpx; }
.photo-add { width: 120rpx; height: 120rpx; border: 2rpx dashed #cbd5e1; border-radius: 14rpx; display: flex; align-items: center; justify-content: center; background: #f8fafc; transition: all 0.2s; }
.photo-add:active { border-color: #3b82f6; background: #eff6ff; }
.photo-add-icon { font-size: 48rpx; color: #94a3b8; }

.btn-submit-full { width: 100%; height: 84rpx; line-height: 84rpx; text-align: center; background: #3b82f6; color: #fff; border-radius: 16rpx; font-size: 30rpx; font-weight: 600; border: none; margin-top: 16rpx; box-shadow: 0 4rpx 16rpx rgba(59,130,246,0.35); transition: all 0.15s; }
.btn-submit-full:active { transform: scale(0.97); box-shadow: 0 2rpx 8rpx rgba(59,130,246,0.25); }
.btn-submit-full[disabled] { opacity: 0.5; box-shadow: none; }

/* 图片来源弹层 */
.src-panel { width: 100%; background: #fff; border-radius: 24rpx 24rpx 0 0; padding-bottom: env(safe-area-inset-bottom); }
.src-panel-head { text-align: center; padding: 24rpx 30rpx 16rpx; border-bottom: 1rpx solid #f1f5f9; }
.src-panel-title { font-size: 28rpx; color: #64748b; }
.src-actions { display: flex; padding: 30rpx; gap: 30rpx; }
.src-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36rpx 0; border-radius: 16rpx; background: #f8fafc; }
.src-btn-icon { font-size: 48rpx; margin-bottom: 12rpx; }
.src-btn-label { font-size: 28rpx; color: #334155; font-weight: 500; }
.src-cancel { text-align: center; padding: 24rpx 30rpx; font-size: 30rpx; color: #94a3b8; border-top: 1rpx solid #f1f5f9; }

/* 图片搜索弹层 */
.img-panel { width: 100%; max-height: 70vh; background: #fff; border-radius: 24rpx 24rpx 0 0; display: flex; flex-direction: column; }
.img-panel-head { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 30rpx; border-bottom: 1rpx solid #e2e8f0; }
.img-panel-title { font-size: 32rpx; font-weight: 600; color: #1e293b; }
.img-panel-close { font-size: 36rpx; color: #94a3b8; padding: 8rpx; }
.img-loading { text-align: center; padding: 80rpx 0; color: #64748b; font-size: 28rpx; }
.img-empty { text-align: center; padding: 80rpx 0; color: #94a3b8; font-size: 28rpx; }
.img-result-list { padding: 16rpx 30rpx; max-height: 60vh; }
.img-result-card { display: flex; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid #f1f5f9; }
.img-thumb { width: 100rpx; height: 100rpx; border-radius: 12rpx; background: #f1f5f9; flex-shrink: 0; }
.img-info { flex: 1; margin-left: 20rpx; }
.img-item-name { font-size: 30rpx; font-weight: 600; color: #1e293b; }
.img-order-no { font-size: 26rpx; color: #64748b; margin-top: 4rpx; }
.img-similarity { font-size: 24rpx; color: #3b82f6; margin-top: 4rpx; }

/* 加工节点操作人信息 */
.node-option-operator {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 6rpx;
  border-top: 1rpx solid #f1f5f9;
  margin-top: 6rpx;
}
.node-op-text { font-size: 22rpx; color: #64748b; }
.node-op-time { font-size: 22rpx; color: #94a3b8; }

/* 变更记录 */
.link-btn { font-size: 26rpx; color: #3b82f6; padding: 4rpx 12rpx; }
.change-log-section {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #e2e8f0;
}
.change-log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.change-log-title { font-size: 28rpx; font-weight: 600; color: #1e293b; }
.change-log-item {
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 18rpx;
  margin-bottom: 10rpx;
  border-left: 4rpx solid #3b82f6;
}
.change-log-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6rpx;
}
.change-log-type { font-size: 24rpx; font-weight: 600; color: #1e293b; }
.change-log-time { font-size: 22rpx; color: #94a3b8; }
.change-log-item-body { margin-bottom: 6rpx; }
.change-log-field { font-size: 22rpx; color: #64748b; display: block; }
.change-log-values { display: flex; align-items: center; flex-wrap: wrap; }
.change-log-field-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; padding: 6rpx 12rpx; background: #fff; border-radius: 8rpx; margin-bottom: 6rpx; font-size: 24rpx; }
.change-log-field-label { color: #334155; font-weight: 500; min-width: 120rpx; }
.change-log-old { font-size: 24rpx; color: #ef4444; text-decoration: line-through; }
.change-log-arrow { font-size: 22rpx; color: #94a3b8; margin: 0 6rpx; }
.change-log-new { font-size: 24rpx; color: #10b981; }
.change-log-remark { font-size: 22rpx; color: #94a3b8; display: block; margin-top: 4rpx; }
.change-log-operator { font-size: 22rpx; color: #94a3b8; }
</style>
