<template>
  <view class="cd-container">
    <view class="cd-card">
      <view class="cd-avatar">
        <text>{{ initialOf(detail) }}</text>
      </view>
      <text class="cd-name">{{ detail.realName || detail.username || "成员" }}</text>
      <text v-if="detail.positionName" class="cd-position">{{ detail.positionName }}</text>
    </view>

    <view class="cd-section">
      <view class="cd-row">
        <text class="cd-label">所在部门</text>
        <text class="cd-value">{{ detail.deptName || "—" }}</text>
      </view>
      <view class="cd-row">
        <text class="cd-label">工号</text>
        <text class="cd-value">{{ detail.username || "—" }}</text>
      </view>
      <view class="cd-row" @click="callPhone">
        <text class="cd-label">手机</text>
        <text class="cd-value cd-link">{{ detail.phone || "—" }}</text>
      </view>
      <view class="cd-row" @click="copyEmail">
        <text class="cd-label">邮箱</text>
        <text class="cd-value cd-link">{{ detail.email || "—" }}</text>
      </view>
      <view class="cd-row">
        <text class="cd-label">状态</text>
        <text :class="['cd-tag', detail.status === 0 ? 'tag-on' : 'tag-off']">
          {{ statusLabel }}
        </text>
      </view>
    </view>

    <view v-if="detail.phone" class="cd-actions">
      <view class="cd-btn primary" @click="callPhone">拨打电话</view>
      <view class="cd-btn ghost" @click="copyEmail">复制邮箱</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import * as http from "../../utils/request.js";
import * as dict from "../../utils/dict.js";
import apiCfg from "../../config/api.js";

const detail = ref({});
const statusItems = ref([]);

const statusLabel = computed(() => {
  return dict.getDictLabel(statusItems.value, detail.value.status) || (detail.value.status === 0 ? "正常" : "停用");
});

function initialOf(u) {
  const name = u.realName || u.username || "?";
  return String(name).slice(0, 1).toUpperCase();
}

async function loadDetail(id) {
  try {
    const url = apiCfg.fillPath(apiCfg.contacts.userDetail, { id });
    const res = await http.get(url, null, { silent: true });
    detail.value = res.data || {};
  } catch (e) { detail.value = {}; }
}

function callPhone() {
  if (!detail.value.phone) return;
  uni.makePhoneCall({ phoneNumber: String(detail.value.phone) });
}

function copyEmail() {
  if (!detail.value.email) return;
  uni.setClipboardData({
    data: String(detail.value.email),
    success: () => uni.showToast({ title: "已复制邮箱", icon: "none" })
  });
}

onMounted(() => {
  // ID 全程字符串处理
  // eslint-disable-next-line no-undef
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1];
  const id = (cur && cur.options && cur.options.id) || "";
  if (id) loadDetail(id);
  dict.fetchDictData("sys_status").then((items) => { statusItems.value = items; });
});
</script>

<style scoped>
.cd-container {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 24px;
}

.cd-card {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
}

.cd-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 12px;
}

.cd-name {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.cd-position {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 4px;
}

.cd-section {
  background: #fff;
  margin: 12px;
  border-radius: 12px;
  overflow: hidden;
}

.cd-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
  gap: 16px;
}
.cd-row:last-child {
  border-bottom: none;
}

.cd-label {
  width: 70px;
  color: #64748b;
  font-size: 13px;
}

.cd-value {
  flex: 1;
  color: #1e293b;
  font-size: 14px;
}

.cd-link {
  color: #3b82f6;
}

.cd-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.tag-on {
  background: #d1fae5;
  color: #10b981;
}

.tag-off {
  background: #fee2e2;
  color: #ef4444;
}

.cd-actions {
  margin: 16px 12px 0;
  display: flex;
  gap: 12px;
}

.cd-btn {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  border-radius: 8px;
  font-size: 14px;
}

.cd-btn.primary {
  background: #3b82f6;
  color: #fff;
}

.cd-btn.ghost {
  background: #fff;
  color: #3b82f6;
  border: 1px solid #3b82f6;
}
</style>
