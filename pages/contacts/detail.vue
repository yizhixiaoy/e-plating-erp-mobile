<template>
  <view class="cd-container">
    <view class="cd-card">
      <view class="cd-avatar">
        <image v-if="getImageUrl(detail.avatarUrl)" :src="getImageUrl(detail.avatarUrl)" class="cd-avatar-img" mode="aspectFill" />
        <text v-else>{{ initialOf(detail) }}</text>
      </view>
      <text class="cd-name">{{ detail.realName || detail.username || "成员" }}</text>
      <text v-if="detail.position" class="cd-position">{{ detail.position }}</text>
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

    <view class="cd-actions">
      <view class="cd-btn primary" @click="startChat">发起会话</view>
      <view v-if="detail.phone" class="cd-btn ghost" @click="callPhone">拨打电话</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import * as http from "../../utils/request.js";
import * as dict from "../../utils/dict.js";
import apiCfg from "../../config/api.js";
import { getImageUrl } from "../../utils/image-url.js";

const detail = ref({});
const statusItems = ref([]);
const chatLoading = ref(false);

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
  min-height: 100%;
  background: var(--bg-page);
  padding-bottom: 24px;
}

.cd-card {
  background: var(--color-gradient);
  padding: 40px 16px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
}

.cd-avatar {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 14px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
}

.cd-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.cd-name {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.3px;
}

.cd-position {
  font-size: 13px;
  color: var(--text-white-secondary);
  margin-top: 4px;
}

.cd-section {
  background: var(--bg-card);
  margin: 12px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.cd-row {
  display: flex;
  align-items: center;
  padding: 15px 16px;
  border-bottom: 1px solid var(--border-light);
  gap: 16px;
}

.cd-row:last-child {
  border-bottom: none;
}

.cd-row:active {
  background-color: var(--bg-hover);
  transition: background-color var(--transition-fast);
}

.cd-label {
  width: 70px;
  color: var(--text-secondary);
  font-size: 14px;
  flex-shrink: 0;
}

.cd-value {
  flex: 1;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
}

.cd-link {
  color: var(--color-primary);
}

.cd-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-weight: 600;
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
  padding: 13px 0;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 600;
  transition: transform var(--transition-fast);
}

.cd-btn:active {
  transform: scale(0.97);
}

.cd-btn.primary {
  background: var(--color-gradient);
  color: #fff;
  box-shadow: var(--shadow-sm);
}

.cd-btn.ghost {
  background: var(--bg-card);
  color: var(--color-primary);
  border: 1.5px solid var(--color-primary);
}
</style>
