<template>
  <view class="cf-container">
    <!-- 表单滚动区 -->
    <scroll-view scroll-y class="form-scroll">
      <view class="section">
        <view class="form-item">
          <text class="form-label">公司名称 <text class="required">*</text></text>
          <input v-model="form.customerName" class="form-input" placeholder="请输入客户公司名称" maxlength="128" />
        </view>

        <view class="form-item">
          <text class="form-label">联系人</text>
          <input v-model="form.contactPerson" class="form-input" placeholder="请输入联系人" maxlength="64" />
        </view>

        <view class="form-item">
          <text class="form-label">联系电话</text>
          <input v-model="form.contactPhone" class="form-input" placeholder="请输入联系电话" maxlength="20" />
        </view>

        <view class="form-item">
          <text class="form-label">地址</text>
          <input v-model="form.address" class="form-input" placeholder="请输入地址" maxlength="256" />
        </view>

        <view class="form-item">
          <text class="form-label">备注</text>
          <textarea v-model="form.remark" class="form-textarea" placeholder="请输入备注信息" maxlength="512" />
        </view>
      </view>

      <!-- 底部留白 -->
      <view style="height: 140rpx;"></view>
    </scroll-view>

    <!-- 底部操作栏 -->
    <view class="footer-bar">
      <button class="btn-cancel" @click="uni.navigateBack({ delta: 1 })">取消</button>
      <button class="btn-save" @click="handleSave" :disabled="submitting">
        {{ submitting ? '保存中...' : '保存' }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import * as http from "../../utils/request.js";
import apiCfg from "../../config/api.js";

const isEdit = ref(false);
const editingId = ref(null);
const submitting = ref(false);

const emptyForm = () => ({
  customerName: "",
  contactPerson: "",
  contactPhone: "",
  address: "",
  remark: "",
});

const form = reactive(emptyForm());

// 接收页面参数
onLoad((options) => {
  if (options && options.mode === "edit" && options.data) {
    try {
      const data = JSON.parse(decodeURIComponent(options.data));
      isEdit.value = true;
      editingId.value = data.id;
      form.customerName = data.customerName || "";
      form.contactPerson = data.contactPerson || "";
      form.contactPhone = data.contactPhone || "";
      form.address = data.address || "";
      form.remark = data.remark || "";
      // 动态更新标题
      uni.setNavigationBarTitle({ title: "编辑客户公司" });
    } catch (e) {
      // 数据解析失败，按新增处理
    }
  }
});

async function handleSave() {
  if (!form.customerName.trim()) {
    uni.showToast({ title: "请输入客户公司名称", icon: "none" });
    return;
  }
  if (submitting.value) return;
  submitting.value = true;
  try {
    if (isEdit.value) {
      await http.put(apiCfg.getUrl("/customers/" + editingId.value), { ...form });
      uni.showToast({ title: "客户公司已更新", icon: "success" });
    } else {
      await http.post(apiCfg.getUrl("/customers"), { ...form });
      uni.showToast({ title: "客户公司已创建", icon: "success" });
    }
    setTimeout(() => {
      uni.navigateBack({ delta: 1 });
    }, 800);
  } catch (err) {
    const msg = (err && err.data && err.data.msg) || "操作失败";
    uni.showToast({ title: msg, icon: "none" });
  } finally {
    submitting.value = false;
  }
}

</script>

<style>
page {
  background-color: #f2f4f8;
}
</style>

<style scoped>
.cf-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* ===== 滚动区 ===== */
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
}

/* ===== 表单项 ===== */
.form-item {
  margin-bottom: 24rpx;
}
.form-item:last-child {
  margin-bottom: 0;
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
}
.form-textarea {
  width: 100%;
  min-height: 140rpx;
  background: #f8fafc;
  border-radius: 14rpx;
  padding: 16rpx 20rpx;
  font-size: 28rpx;
  border: 1rpx solid #e8ecf1;
  box-sizing: border-box;
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
.btn-cancel {
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
.btn-cancel:active {
  background: #e2e8f0;
}
.btn-save {
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
.btn-save:active {
  transform: scale(0.97);
  box-shadow: 0 2rpx 8rpx rgba(59,130,246,0.25);
}
.btn-save[disabled] {
  opacity: 0.5;
  box-shadow: none;
}
</style>
