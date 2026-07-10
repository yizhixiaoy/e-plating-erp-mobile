<template>
  <view :class="['go-container', showCustomerPicker || showDeptPicker ? 'dialog-open' : '']">
    <scroll-view scroll-y class="form-scroll">
      <!-- 基本信息 -->
      <view class="section">
        <view class="section-title">基本信息</view>

        <view class="form-item">
          <text class="form-label">开单日期 <text class="required">*</text></text>
          <picker mode="date" :value="form.orderDate" @change="onDateChange">
            <view class="form-picker">{{ form.orderDate || '请选择日期' }}</view>
          </picker>
        </view>

        <view class="form-item">
          <text class="form-label">客户公司 <text class="required">*</text></text>
          <view class="form-picker" @click="showCustomerPicker = true">
            <text :class="form.customerName ? '' : 'placeholder'">{{ form.customerName || '请选择客户' }}</text>
            <text class="arrow">›</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">开单部门 <text class="required">*</text></text>
          <view class="form-picker" @click="showDeptPicker = true">
            <text :class="form.departmentName ? '' : 'placeholder'">{{ form.departmentName || '请选择部门' }}</text>
            <text class="arrow">›</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">备注</text>
          <textarea v-model="form.remark" class="form-textarea" placeholder="选填备注" maxlength="512" />
        </view>
      </view>

      <!-- 货物明细 -->
      <view class="section">
        <view class="section-title">
          <text>货物明细</text>
          <text class="section-tip">（共 {{ form.items.length }} 项）</text>
        </view>

        <view v-for="(item, idx) in form.items" :key="idx" class="item-card">
          <view class="item-card-header">
            <text class="item-card-title">货物 {{ idx + 1 }}</text>
            <text class="item-card-del" @click="removeItem(idx)">删除</text>
          </view>

          <view class="form-item">
            <text class="form-label">货物名称 <text class="required">*</text></text>
            <input v-model="item.itemName" class="form-input" placeholder="请输入货物名称" maxlength="128" />
          </view>

          <view class="form-row">
            <view class="form-item half">
              <text class="form-label">数量 <text class="required">*</text></text>
              <input v-model="item.quantity" class="form-input" type="digit" placeholder="请输入数量" />
            </view>
            <view class="form-item half">
              <text class="form-label">单位</text>
              <picker :range="unitOptions" :range-key="'label'" @change="onUnitChange(idx, $event)">
                <view class="form-picker">
                  <text :class="item.unit ? '' : 'placeholder'">{{ item.unit || '个' }}</text>
                  <text class="arrow">›</text>
                </view>
              </picker>
            </view>
          </view>

          <view class="form-row">
            <view class="form-item half">
              <text class="form-label">单价（元）</text>
              <input v-model="item.unitPrice" class="form-input" type="digit" placeholder="请输入单价" />
            </view>
            <view class="form-item half">
              <text class="form-label">规格</text>
              <input v-model="item.specification" class="form-input" placeholder="选填" maxlength="128" />
            </view>
          </view>

          <view class="form-item">
            <text class="form-label">材质</text>
            <input v-model="item.material" class="form-input" placeholder="选填" maxlength="64" />
          </view>

          <view class="form-item">
            <text class="form-label">样品照片</text>
            <view class="photo-area">
              <view v-for="(url, pIdx) in item.photoUrls" :key="pIdx" class="photo-item">
                <image :src="url" class="photo-img" mode="aspectFill" />
                <text class="photo-del" @click="removePhoto(idx, pIdx)">✕</text>
              </view>
              <view class="photo-add" @click="startPickPhoto(idx)">
                <text class="photo-add-icon">+</text>
              </view>
            </view>
          </view>

          <view class="form-item">
            <text class="form-label">货物备注</text>
            <textarea v-model="item.remark" class="form-textarea" placeholder="选填" maxlength="512" />
          </view>
        </view>

        <view class="add-item-btn" @click="addItem">
          <text class="add-item-icon">+</text>
          <text>添加货物</text>
        </view>
      </view>

      <!-- 底部留白 -->
      <view style="height: 140rpx;"></view>
    </scroll-view>

    <!-- 底部操作栏（弹窗打开时隐藏，避免键盘弹出时被顶起） -->
    <view class="footer-bar" v-if="!showCustomerPicker && !showDeptPicker">
      <button class="btn-draft" @click="handleSaveDraft" :disabled="savingDraft || submitting">
        {{ savingDraft ? '保存中...' : (orderId ? '更新草稿' : '保存草稿') }}
      </button>
      <button class="btn-submit" @click="handleSubmitOrder" :disabled="submitting || savingDraft">
        {{ submitting ? '提交中...' : '提交开单' }}
      </button>
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

    <!-- 客户公司选择弹层 -->
    <view v-if="showCustomerPicker" class="img-overlay" @click="showCustomerPicker = false">
      <view class="dept-picker-panel" @click.stop :style="{ paddingBottom: keyboardHeight > 0 ? keyboardHeight + 'px' : '' }">
        <view class="dept-picker-head">
          <view class="dept-picker-head-line"></view>
          <text class="dept-picker-title">选择客户公司</text>
          <text class="dept-picker-close" @click="showCustomerPicker = false">✕</text>
        </view>
        <view class="dept-picker-search">
          <text class="dept-picker-search-icon">🔍</text>
          <input v-model="customerKeyword" class="dept-picker-search-input" placeholder="搜索客户名称" @input="searchCustomers" />
          <text v-if="customerKeyword" class="dept-picker-search-clear" @click="customerKeyword = ''; searchCustomers()">✕</text>
        </view>
        <scroll-view scroll-y class="dept-picker-list">
          <view v-if="customerOptions.length === 0" class="dept-picker-empty">
            <text class="dept-picker-empty-icon">🏢</text>
            <text>暂无匹配客户</text>
          </view>
          <view v-for="c in customerOptions" :key="c.id"
            :class="['dept-picker-item', form.customerId === c.id ? 'selected' : '']"
            @click="selectCustomer(c)">
            <view class="dept-picker-avatar" :style="{ background: avatarColor(c.customerName) }">{{ c.customerName.charAt(0) }}</view>
            <view style="flex:1;margin-left:20rpx;">
              <text class="dept-picker-name" style="display:block;">{{ c.customerName }}</text>
              <text style="font-size:24rpx;color:#94a3b8;" v-if="c.contactPerson">{{ c.contactPerson }}</text>
            </view>
            <view class="dept-picker-check" :class="{ checked: form.customerId === c.id }">
              <text v-if="form.customerId === c.id">✓</text>
            </view>
          </view>
        </scroll-view>
        <view class="dept-picker-footer">
          <button class="dept-picker-cancel-btn" @click="showCustomerPicker = false">关闭</button>
        </view>
      </view>
    </view>

    <!-- 部门选择弹层 -->
    <view v-if="showDeptPicker" class="img-overlay" @click="showDeptPicker = false">
      <view class="dept-picker-panel" @click.stop :style="{ paddingBottom: keyboardHeight > 0 ? keyboardHeight + 'px' : '' }">
        <view class="dept-picker-head">
          <view class="dept-picker-head-line"></view>
          <text class="dept-picker-title">选择开单部门</text>
          <text class="dept-picker-close" @click="showDeptPicker = false">✕</text>
        </view>
        <!-- 搜索框 -->
        <view class="dept-picker-search">
          <text class="dept-picker-search-icon">🔍</text>
          <input v-model="deptKeyword" class="dept-picker-search-input" placeholder="搜索部门名称" @input="onDeptSearch" />
          <text v-if="deptKeyword" class="dept-picker-search-clear" @click="deptKeyword = ''">✕</text>
        </view>
        <!-- 部门列表 -->
        <scroll-view scroll-y class="dept-picker-list">
          <view v-if="filteredDeptOptions.length === 0" class="dept-picker-empty">
            <text class="dept-picker-empty-icon">📋</text>
            <text>{{ deptOptions.length === 0 ? '暂无部门数据' : '无匹配部门' }}</text>
          </view>
          <view v-for="d in filteredDeptOptions" :key="d.id"
            :class="['dept-picker-item', form.departmentId === d.id ? 'selected' : '']"
            @click="selectDept(d)">
            <view class="dept-picker-avatar" :style="{ background: avatarColor(d.deptName) }">{{ d.deptName.charAt(0) }}</view>
            <text class="dept-picker-name">{{ d.deptName }}</text>
            <view class="dept-picker-check" :class="{ checked: form.departmentId === d.id }">
              <text v-if="form.departmentId === d.id">✓</text>
            </view>
          </view>
        </scroll-view>
        <!-- 底部 -->
        <view class="dept-picker-footer">
          <button class="dept-picker-cancel-btn" @click="showDeptPicker = false">关闭</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, computed } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { onMounted, onUnmounted } from "vue";
import * as http from "../../utils/request.js";
import * as auth from "../../utils/auth.js";
import { uploadFile } from "../../utils/file-upload.js";
import { fetchDictData } from "../../utils/dict.js";
import apiCfg from "../../config/api.js";

const form = reactive({
  orderDate: "",
  customerId: null,
  customerName: "",
  departmentId: null,
  departmentName: "",
  remark: "",
  items: []
});

const submitting = ref(false);
const savingDraft = ref(false);
const orderId = ref(null); // 编辑模式时有值

// 图片来源选择
const showSourcePicker = ref(false);
const currentPhotoIdx = ref(0);

// 客户选择
const showCustomerPicker = ref(false);
const customerKeyword = ref("");
const customerOptions = ref([]);

// 部门选择
const showDeptPicker = ref(false);
const deptOptions = ref([]);
const deptKeyword = ref("");
const keyboardHeight = ref(0);

/** 模糊筛选后的部门列表 */
const filteredDeptOptions = computed(() => {
  const kw = deptKeyword.value.trim().toLowerCase();
  if (!kw) return deptOptions.value;
  return deptOptions.value.filter(d => (d.deptName || "").toLowerCase().includes(kw));
});

/** 根据名称生成颜色 */
function avatarColor(name) {
  const colors = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#14b8a6"];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/** 搜索输入 */
function onDeptSearch() { /* 计算属性自动响应，无需额外处理 */ }

// 单位选项（字典）
const unitOptions = ref([]);

async function loadUnitOptions() {
  const list = await fetchDictData("goods_unit");
  if (list && list.length > 0) {
    unitOptions.value = list;
  } else {
    unitOptions.value = [
      { label: "个", value: "个" },
      { label: "件", value: "件" },
      { label: "kg", value: "kg" },
      { label: "米", value: "米" },
      { label: "盒", value: "盒" },
      { label: "套", value: "套" },
      { label: "台", value: "台" },
      { label: "张", value: "张" }
    ];
  }
}

function onUnitChange(idx, e) {
  const option = unitOptions.value[e.detail.value];
  if (option) {
    form.items[idx].unit = option.value;
  }
}

// 初始化日期（今天）
function initDate() {
  if (!form.orderDate) {
    const d = new Date();
    form.orderDate = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
}

// 加载客户列表
async function searchCustomers() {
  try {
    const url = apiCfg.getUrl("/customers") + "?keyword=" + encodeURIComponent(customerKeyword.value || "") + "&page=1&size=50";
    const res = await http.get(url);
    const data = res.data;
    customerOptions.value = (data && data.records) ? data.records : [];
  } catch {
    customerOptions.value = [];
  }
}

// 加载部门选项（开单部门）
async function loadDepts() {
  try {
    const userInfo = auth.getUserInfo();
    const tenantId = userInfo?.tenantId;
    const params = tenantId ? { tenantId } : null;
    const url = apiCfg.getUrl("/depts/options");
    const res = await http.get(url, params, { silent: true });
    deptOptions.value = res.data || [];
    if (deptOptions.value.length === 0) {
      console.warn("[order] 部门列表为空，请检查租户下是否已创建部门");
    }
  } catch (e) {
    console.error("[order] 加载部门选项失败:", e);
    deptOptions.value = [];
  }
}

function selectCustomer(c) {
  form.customerId = c.id;
  form.customerName = c.customerName;
  showCustomerPicker.value = false;
}

function selectDept(d) {
  form.departmentId = d.id;
  form.departmentName = d.deptName;
  showDeptPicker.value = false;
}

function addItem() {
  form.items.push({
    itemName: "",
    quantity: "",
    unit: "",
    unitPrice: "",
    specification: "",
    material: "",
    photoUrls: [],
    remark: ""
  });
}

function removeItem(idx) {
  form.items.splice(idx, 1);
}

// 照片相关
function startPickPhoto(idx) {
  currentPhotoIdx.value = idx;
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
    for (const fp of files) {
      const uploadRes = await uploadFile(fp, "goods");
      const url = uploadRes.ossPath || uploadRes.url || uploadRes.path;
      const item = form.items[currentPhotoIdx.value];
      if (item && !item.photoUrls.includes(url)) {
        item.photoUrls.push(url);
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

function removePhoto(itemIdx, photoIdx) {
  form.items[itemIdx].photoUrls.splice(photoIdx, 1);
}

function onDateChange(e) {
  form.orderDate = e.detail.value;
}

// 构建提交数据
function buildSubmitData() {
  return {
    orderDate: form.orderDate,
    customerId: form.customerId,
    customerName: form.customerName,
    departmentId: form.departmentId,
    departmentName: form.departmentName,
    remark: form.remark || "",
    items: form.items.map(item => ({
      itemName: item.itemName,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || "个",
      unitPrice: Number(item.unitPrice) || 0,
      specification: item.specification || "",
      material: item.material || "",
      photoUrls: item.photoUrls || [],
      remark: item.remark || ""
    }))
  };
}

// 校验
function validate() {
  if (!form.orderDate) { uni.showToast({ title: "请选择开单日期", icon: "none" }); return false; }
  if (!form.customerId) { uni.showToast({ title: "请选择客户公司", icon: "none" }); return false; }
  if (!form.departmentId) { uni.showToast({ title: "请选择开单部门", icon: "none" }); return false; }
  if (form.items.length === 0) { uni.showToast({ title: "请添加至少一行货物明细", icon: "none" }); return false; }
  for (let i = 0; i < form.items.length; i++) {
    const item = form.items[i];
    if (!item.itemName) { uni.showToast({ title: "第" + (i + 1) + "项货物名称不能为空", icon: "none" }); return false; }
    if (!item.quantity || Number(item.quantity) <= 0) { uni.showToast({ title: "第" + (i + 1) + "项数量必须大于0", icon: "none" }); return false; }
  }
  return true;
}

async function loadOrder(id) {
  try {
    uni.showLoading({ title: "加载中..." });
    const url = apiCfg.getUrl("/goods/orders/" + id);
    const res = await http.get(url);
    const data = res.data;
    if (data) {
      form.orderDate = data.orderDate || "";
      form.customerId = data.customerId || null;
      form.customerName = data.customerName || "";
      form.departmentId = data.departmentId || null;
      form.departmentName = data.departmentName || "";
      form.remark = data.remark || "";
      form.items = (data.items || []).map(item => ({
        itemName: item.itemName || "",
        quantity: item.quantity != null ? String(item.quantity) : "",
        unit: item.unit || "",
        unitPrice: item.unitPrice != null ? String(item.unitPrice) : "",
        specification: item.specification || "",
        material: item.material || "",
        photoUrls: item.photoUrls || [],
        remark: item.remark || ""
      }));
      orderId.value = id;
    }
    uni.hideLoading();
  } catch {
    uni.hideLoading();
    uni.showToast({ title: "加载失败", icon: "none" });
  }
}

async function handleSaveDraft() {
  if (!validate()) return;
  savingDraft.value = true;
  try {
    if (orderId.value) {
      // 编辑模式：PUT 更新已有草稿
      const url = apiCfg.getUrl("/goods/orders/" + orderId.value);
      await http.put(url, buildSubmitData());
    } else {
      // 新建模式：POST 创建
      const url = apiCfg.getUrl("/goods/orders");
      const res = await http.post(url, buildSubmitData());
      orderId.value = (res.data && res.data.orderId) ? res.data.orderId : null;
    }
    uni.showToast({ title: "保存成功", icon: "success" });
    setTimeout(() => goBack(), 800);
  } finally {
    savingDraft.value = false;
  }
}

async function handleSubmitOrder() {
  if (!validate()) return;
  submitting.value = true;
  try {
    let targetId = orderId.value;
    if (!targetId) {
      // 新建：先创建再提交
      const url = apiCfg.getUrl("/goods/orders");
      const res = await http.post(url, buildSubmitData());
      targetId = (res.data && res.data.orderId) ? res.data.orderId : null;
    } else {
      // 编辑：先更新再提交
      const updateUrl = apiCfg.getUrl("/goods/orders/" + targetId);
      await http.put(updateUrl, buildSubmitData());
    }
    if (targetId) {
      const submitUrl = apiCfg.getUrl("/goods/orders/" + targetId + "/submit");
      await http.post(submitUrl, { operatorId: 0 });
    }
    uni.showToast({ title: "开单成功", icon: "success" });
    setTimeout(() => goBack(), 800);
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  uni.navigateBack({ delta: 1 });
}

onLoad((options) => {
  if (options && options.id) {
    uni.setNavigationBarTitle({ title: "编辑开单" });
    loadOrder(options.id);
  }
});

onShow(() => {
  initDate();
  loadDepts();
  searchCustomers();
  loadUnitOptions();
});

let _kbHandler = null;
onMounted(() => {
  _kbHandler = uni.onKeyboardHeightChange(res => {
    keyboardHeight.value = res.height || 0;
  });
});
onUnmounted(() => {
  if (_kbHandler) _kbHandler();
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

/* ===== 滚动区（height:0 配合 flex:1 保证可滚动） ===== */
.form-scroll {
  flex: 1;
  height: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 20rpx 0;
}

/* ===== 分区卡片 ===== */
.section {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin: 0 24rpx 20rpx;
  box-shadow: 0 2rpx 16rpx rgba(0,0,0,0.06);
  transition: background 0.2s;
}
/* 弹窗打开时卡片变暗 */
.dialog-open .section { background: #e4e6eb; box-shadow: none; }
.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f1f5f9;
}
.section-tip {
  font-size: 26rpx;
  font-weight: 400;
  color: #94a3b8;
  margin-left: 8rpx;
}

/* ===== 表单项 ===== */
.form-item {
  margin-bottom: 20rpx;
}
.form-item.half {
  flex: 1;
  margin-right: 16rpx;
}
.form-item.half:last-child {
  margin-right: 0;
}
.form-row {
  display: flex;
}
.form-label {
  font-size: 28rpx;
  color: #334155;
  display: block;
  margin-bottom: 8rpx;
}
.required {
  color: #ef4444;
}
.form-input {
  height: 76rpx;
  line-height: 76rpx;
  background: #f8fafc;
  border-radius: 14rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  border: 1rpx solid #e8ecf1;
  transition: border-color 0.2s;
}
.form-textarea {
  width: 100%;
  min-height: 120rpx;
  background: #f8fafc;
  border-radius: 14rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  border: 1rpx solid #e8ecf1;
  box-sizing: border-box;
}
.form-picker {
  height: 76rpx;
  line-height: 76rpx;
  background: #f8fafc;
  border-radius: 14rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  border: 1rpx solid #e8ecf1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: border-color 0.2s;
}
.form-picker > text:first-child {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.form-picker .placeholder {
  color: #94a3b8;
}
.form-picker .arrow {
  font-size: 36rpx;
  color: #94a3b8;
  flex-shrink: 0;
  margin-left: 12rpx;
}

/* ===== 货物条目卡片 ===== */
.item-card {
  background: #f8fafc;
  border-radius: 14rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  border-left: 5rpx solid #3b82f6;
  border-right: 5rpx solid transparent;
  box-shadow: 0 1rpx 4rpx rgba(0,0,0,0.04);
}
.item-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.item-card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1e293b;
}
.item-card-del {
  font-size: 26rpx;
  color: #ef4444;
  padding: 4rpx 12rpx;
}
.item-card-del:active {
  opacity: 0.7;
}

/* ===== 添加货物按钮 ===== */
.add-item-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 28rpx 0;
  margin: 0 24rpx;
  font-size: 28rpx;
  color: #3b82f6;
  border: 2rpx dashed #bfdbfe;
  border-radius: 14rpx;
  background: #f8fafc;
  transition: all 0.2s;
}
.add-item-btn:active {
  background: #eff6ff;
  border-color: #3b82f6;
}
.add-item-icon {
  font-size: 34rpx;
  font-weight: 300;
  line-height: 1;
}

/* ===== 照片区 ===== */
.photo-area {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.photo-item {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  overflow: hidden;
}
.photo-img {
  width: 100%;
  height: 100%;
}
.photo-del {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 36rpx;
  height: 36rpx;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 50%;
  text-align: center;
  line-height: 36rpx;
  font-size: 24rpx;
}
.photo-add {
  width: 120rpx;
  height: 120rpx;
  border: 2rpx dashed #cbd5e1;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  transition: all 0.2s;
}
.photo-add:active {
  border-color: #3b82f6;
  background: #eff6ff;
}
.photo-add-icon {
  font-size: 48rpx;
  color: #94a3b8;
}

/* ===== 底部操作栏 ===== */
.footer-bar {
  display: flex;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 16rpx rgba(0,0,0,0.06);
  gap: 20rpx;
}
.btn-draft {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  text-align: center;
  background: #f1f5f9;
  color: #475569;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
  border: none;
  transition: all 0.15s;
}
.btn-draft:active {
  background: #e2e8f0;
}
.btn-draft[disabled] {
  opacity: 0.5;
}
.btn-submit {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  text-align: center;
  background: #3b82f6;
  color: #fff;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  box-shadow: 0 4rpx 16rpx rgba(59,130,246,0.35);
  transition: all 0.15s;
}
.btn-submit:active {
  transform: scale(0.97);
  box-shadow: 0 2rpx 8rpx rgba(59,130,246,0.25);
}
.btn-submit[disabled] {
  opacity: 0.5;
  box-shadow: none;
}

/* ===== 弹层 ===== */
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

/* 图片来源弹层 */
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

/* ===== 部门选择弹层（底部弹出） ===== */
.dept-picker-panel {
  width: 100%;
  max-height: 70vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
}

.dept-picker-head {
  display: flex;
  align-items: center;
  padding: 28rpx 30rpx 20rpx;
  border-bottom: 1rpx solid #f1f5f9;
  position: relative;
}
.dept-picker-head-line {
  position: absolute;
  top: 12rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 60rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background: #e2e8f0;
}
.dept-picker-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 700;
  color: #1e293b;
}
.dept-picker-close {
  font-size: 32rpx;
  color: #94a3b8;
  padding: 8rpx;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dept-picker-search {
  margin: 16rpx 24rpx;
  display: flex;
  align-items: center;
  background: #f1f5f9;
  border-radius: 16rpx;
  padding: 0 20rpx;
  height: 72rpx;
}
.dept-picker-search-icon { font-size: 28rpx; margin-right: 12rpx; }
.dept-picker-search-input {
  flex: 1;
  font-size: 28rpx;
  color: #334155;
  height: 72rpx;
}
.dept-picker-search-clear {
  font-size: 28rpx;
  color: #94a3b8;
  padding: 8rpx;
  margin-left: 8rpx;
}

.dept-picker-list {
  max-height: 42vh;
  padding: 0 24rpx;
}

.dept-picker-empty {
  text-align: center;
  padding: 80rpx 0;
  color: #94a3b8;
  font-size: 28rpx;
}
.dept-picker-empty-icon { font-size: 56rpx; display: block; margin-bottom: 16rpx; }

.dept-picker-item {
  display: flex;
  align-items: center;
  padding: 20rpx 16rpx;
  border-radius: 16rpx;
  margin-bottom: 8rpx;
  transition: background 0.15s;
}
.dept-picker-item:active { background: #f8fafc; }
.dept-picker-item.selected { background: #eff6ff; }

.dept-picker-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
  flex-shrink: 0;
}
.dept-picker-name {
  flex: 1;
  font-size: 30rpx;
  color: #1e293b;
  font-weight: 500;
  margin-left: 20rpx;
}
.dept-picker-item.selected .dept-picker-name { color: #2563eb; font-weight: 600; }

.dept-picker-check {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2rpx solid #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #fff;
  flex-shrink: 0;
  transition: all 0.2s;
}
.dept-picker-check.checked {
  background: #3b82f6;
  border-color: #3b82f6;
}

.dept-picker-footer {
  padding: 16rpx 24rpx;
  border-top: 1rpx solid #f1f5f9;
}
.dept-picker-cancel-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  background: #f1f5f9;
  color: #64748b;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
  border: none;
}
</style>
