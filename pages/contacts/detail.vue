<template>
  <view class="cd-container">
    <!-- 头部个人信息卡 -->
    <view class="cd-hero">
      <view class="cd-avatar-wrap">
        <image
          v-if="avatarSrc"
          :src="avatarSrc"
          class="cd-avatar-img"
          mode="aspectFill"
          @error="onAvatarError"
        />
        <text v-else class="cd-avatar-text">{{ initialOf(detail) }}</text>
      </view>
      <text class="cd-name">{{ detail.realName || detail.username || "成员" }}</text>
      <text v-if="detail.position" class="cd-position">{{ detail.position }}</text>
      <view v-if="detail.status !== undefined" class="cd-status-row">
        <view :class="['cd-status-dot', detail.status === 0 ? 'dot-active' : 'dot-inactive']"></view>
        <text :class="['cd-status-text', detail.status === 0 ? '' : 'inactive']">{{ statusLabel }}</text>
      </view>
    </view>

    <!-- 信息卡片 -->
    <view class="cd-info-card">
      <view class="cd-info-item">
        <view class="cd-info-icon">🏢</view>
        <view class="cd-info-body">
          <text class="cd-info-label">所在部门</text>
          <text class="cd-info-value">{{ detail.deptName || "—" }}</text>
        </view>
      </view>
      <view class="cd-info-item">
        <view class="cd-info-icon">🆔</view>
        <view class="cd-info-body">
          <text class="cd-info-label">工号</text>
          <text class="cd-info-value">{{ detail.username || "—" }}</text>
        </view>
      </view>
      <view class="cd-info-item cd-tappable" @click="callPhone">
        <view class="cd-info-icon">📞</view>
        <view class="cd-info-body">
          <text class="cd-info-label">手机</text>
          <text class="cd-info-value cd-link">{{ detail.phone || "—" }}</text>
        </view>
        <text v-if="detail.phone" class="cd-info-arrow">›</text>
      </view>
      <view class="cd-info-item cd-tappable" @click="copyEmail">
        <view class="cd-info-icon">📧</view>
        <view class="cd-info-body">
          <text class="cd-info-label">邮箱</text>
          <text class="cd-info-value cd-link">{{ detail.email || "—" }}</text>
        </view>
        <text v-if="detail.email" class="cd-info-arrow">›</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="cd-actions">
      <view class="cd-btn primary" @click="startChat">
        <text class="cd-btn-icon">💬</text>
        <text>发起会话</text>
      </view>
      <view v-if="detail.phone" class="cd-btn outline" @click="callPhone">
        <text class="cd-btn-icon">📞</text>
        <text>拨打电话</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import * as http from "../../utils/request.js";
import * as dict from "../../utils/dict.js";
import apiCfg from "../../config/api.js";
import { getImageUrl } from "../../utils/image-url.js";
import { loadImage } from "../../utils/image-preloader.js";

const detail = ref({});
const statusItems = ref([]);
const chatLoading = ref(false);
const avatarSrc = ref("");
const avatarError = ref(false);

const statusLabel = computed(() => {
  return dict.getDictLabel(statusItems.value, detail.value.status) || (detail.value.status === 0 ? "正常" : "停用");
});

function initialOf(u) {
  const name = u.realName || u.username || "?";
  return String(name).slice(0, 1).toUpperCase();
}

function onAvatarError() {
  avatarError.value = true;
  avatarSrc.value = "";
}

async function loadDetail(id) {
  try {
    const url = apiCfg.fillPath(apiCfg.contacts.userDetail, { id });
    const res = await http.get(url, null, { silent: true });
    detail.value = res.data || {};

    // 预加载头像
    const remoteUrl = getImageUrl(detail.value.avatarUrl);
    if (remoteUrl && !avatarError.value) {
      avatarSrc.value = await loadImage(remoteUrl);
    }
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

async function startChat() {
  if (!detail.value.id || chatLoading.value) return;
  chatLoading.value = true;
  try {
    const res = await http.post(apiCfg.chat.createSingle, { peerUserId: detail.value.id }, { silent: true });
    const conv = res.data;
    if (conv && conv.id) {
      const name = encodeURIComponent(detail.value.realName || detail.value.username || "聊天");
      const meta = encodeURIComponent(JSON.stringify({
        peerUserId: detail.value.id,
        peerAvatar: detail.value.avatarUrl || "",
        memberCount: conv.memberCount || 2,
        pinned: 0,
        muted: 0
      }));
      uni.navigateTo({ url: "/pages/chat/conversation?id=" + String(conv.id) + "&name=" + name + "&convType=SINGLE&meta=" + meta });
    } else {
      uni.showToast({ title: "创建会话失败", icon: "none" });
    }
  } catch (e) {
    uni.showToast({ title: "创建会话失败", icon: "none" });
  } finally {
    chatLoading.value = false;
  }
}

onLoad((options) => {
  const id = (options && options.id) || "";
  if (id) loadDetail(id);
  dict.fetchDictData("sys_status").then((items) => { statusItems.value = items; });
});
</script>

<style scoped>
.cd-container {
  min-height: 100%;
  background: var(--bg-page);
  padding-bottom: 40px;
}

/* ===== 头部个人信息卡 ===== */
.cd-hero {
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%);
  padding: 48px 20px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.cd-hero::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 32px;
  background: var(--bg-page);
  border-radius: 24px 24px 0 0;
}

.cd-avatar-wrap {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  border: 3px solid rgba(255, 255, 255, 0.4);
}

.cd-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.cd-avatar-text {
  font-size: 34px;
  font-weight: 700;
  color: #fff;
}

.cd-name {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.cd-position {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 12px;
}

.cd-status-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cd-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-active { background: #4ade80; box-shadow: 0 0 6px rgba(74, 222, 128, 0.5); }
.dot-inactive { background: rgba(255, 255, 255, 0.4); }

.cd-status-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

.cd-status-text.inactive {
  color: rgba(255, 255, 255, 0.5);
}

/* ===== 信息卡片 ===== */
.cd-info-card {
  background: var(--bg-card);
  margin: -8px 16px 0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  position: relative;
  z-index: 1;
}

.cd-info-item {
  display: flex;
  align-items: center;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border-light);
  gap: 14px;
}

.cd-info-item:last-child {
  border-bottom: none;
}

.cd-tappable:active {
  background-color: var(--bg-hover);
  transition: background-color var(--transition-fast);
}

.cd-info-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.cd-info-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cd-info-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.cd-info-value {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
}

.cd-link {
  color: var(--color-primary);
}

.cd-info-arrow {
  font-size: 18px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* ===== 操作按钮 ===== */
.cd-actions {
  margin: 24px 16px 0;
  display: flex;
  gap: 12px;
}

.cd-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px 0;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.cd-btn:active {
  transform: scale(0.97);
}

.cd-btn.primary {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
}

.cd-btn.outline {
  background: var(--bg-card);
  color: var(--color-primary);
  border: 1.5px solid rgba(59, 130, 246, 0.3);
}

.cd-btn-icon {
  font-size: 16px;
}
</style>
