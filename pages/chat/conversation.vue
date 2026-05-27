<template>
  <view class="chat-room">
    <!-- 自定义导航栏 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <view class="nav-center">
        <text class="nav-title">{{ convName }}</text>
        <text v-if="convType === 'GROUP'" class="nav-sub">{{ memberCount }}人</text>
      </view>
      <view class="nav-right">
        <text class="nav-action" @click="goDetail">•••</text>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view
      class="msg-scroll"
      scroll-y
      :scroll-top="scrollTop"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltoupper="onRefresh"
    >
      <view v-if="loadingHistory" class="loading-more">
        <text>加载历史消息...</text>
      </view>

      <view v-for="(msg, idx) in messages" :key="msg.id">
        <!-- 日期分隔线 -->
        <view v-if="shouldShowDate(idx)" class="date-divider">
          <text class="date-text">{{ formatDateDivider(msg.createdAt) }}</text>
        </view>

        <!-- 系统消息 -->
        <view v-if="msg.msgType === 'SYSTEM'" class="system-msg">
          <text class="system-text">{{ msg.content }}</text>
        </view>

        <!-- 普通消息 -->
        <view v-else :class="['msg-row', msg.senderId === myUserId ? 'mine' : 'other']">
          <view v-if="convType === 'GROUP' && msg.senderId !== myUserId" class="msg-avatar-left">
            <text class="avatar-char">{{ (msg.senderName || 'U').slice(0, 1) }}</text>
          </view>

          <view class="msg-body">
            <text v-if="convType === 'GROUP' && msg.senderId !== myUserId" class="msg-sender-name">{{ msg.senderName }}</text>

            <!-- 回复引用 -->
            <view v-if="msg.replyToId" class="reply-preview">
              <text class="reply-name">{{ msg.replySenderName }}</text>
              <text class="reply-content">{{ msg.replyPreview }}</text>
            </view>

            <!-- 消息气泡 -->
            <view
              :class="['bubble', msg.senderId === myUserId ? 'bubble-mine' : 'bubble-other', msg.recalled === 1 ? 'recalled-bubble' : '']"
              @longpress="onMsgLongPress(msg)"
            >
              <!-- 已撤回 -->
              <text v-if="msg.recalled === 1" class="recalled-text">消息已撤回</text>

              <!-- 文本消息 -->
              <text v-else-if="msg.msgType === 'TEXT'" class="bubble-text">{{ msg.content }}</text>

              <!-- 图片消息 -->
              <image
                v-else-if="msg.msgType === 'IMAGE'"
                class="bubble-image"
                :src="getImageUrl(msg.content)"
                mode="widthFix"
                :style="{ width: '200rpx' }"
                @click="previewImage(msg)"
              />

              <!-- 文件消息 -->
              <view v-else-if="msg.msgType === 'FILE'" class="bubble-file" @click="openFile(msg)">
                <text class="file-icon">📄</text>
                <view class="file-info">
                  <text class="file-name">{{ parseFileName(msg) }}</text>
                  <text class="file-size">{{ parseFileSize(msg) }}</text>
                </view>
              </view>

              <!-- fallback -->
              <text v-else class="bubble-text">{{ msg.content }}</text>
            </view>

            <!-- 消息元信息 -->
            <view class="msg-meta">
              <text v-if="msg.edited === 1" class="edited-tag">已编辑</text>
              <text class="msg-time">{{ formatMsgTime(msg.createdAt) }}</text>
            </view>
          </view>

          <view v-if="msg.senderId === myUserId" class="msg-avatar-right">
            <text class="avatar-char">{{ myAvatarText }}</text>
          </view>
        </view>
      </view>

      <view id="msg-bottom"></view>
    </scroll-view>

    <!-- 回复栏 -->
    <view v-if="replyTo" class="reply-bar">
      <view class="reply-bar-content">
        <text class="reply-bar-name">回复 {{ replyTo.senderName }}：</text>
        <text class="reply-bar-preview">{{ replyTo.msgType === 'IMAGE' ? '[图片]' : (replyTo.content || '').slice(0, 50) }}</text>
      </view>
      <text class="reply-bar-close" @click="replyTo = null">✕</text>
    </view>

    <!-- 底部输入区 -->
    <view class="input-area">
      <view class="input-row">
        <text class="tool-btn" @click="toggleEmoji">😊</text>
        <input
          class="text-input"
          v-model="inputText"
          placeholder="输入消息..."
          confirm-type="send"
          @confirm="sendText"
          :focus="inputFocus"
        />
        <text class="tool-btn" @click="chooseImage">📷</text>
        <text class="tool-btn" @click="chooseFile">📎</text>
        <view :class="['send-btn', inputText.trim() ? 'send-active' : '']" @click="sendText">
          <text class="send-text">发送</text>
        </view>
      </view>

      <!-- 表情面板 -->
      <view v-if="showEmoji" class="emoji-panel">
        <scroll-view scroll-y class="emoji-scroll">
          <view class="emoji-grid">
            <text v-for="e in emojis" :key="e" class="emoji-item" @click="insertEmoji(e)">{{ e }}</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { onLoad } from "@dcloudio/uni-app";
const http = require("../../utils/request.js");
const auth = require("../../utils/auth.js");
const apiCfg = require("../../config/api.js");
const { uploadFile } = require("../../utils/file-upload.js");

const conversationId = ref(null);
const convName = ref("");
const convType = ref("SINGLE");
const memberCount = ref(0);
const messages = ref([]);
const inputText = ref("");
const inputFocus = ref(false);
const showEmoji = ref(false);
const replyTo = ref(null);
const scrollTop = ref(0);
const refreshing = ref(false);
const loadingHistory = ref(false);
const hasMoreHistory = ref(true);

const userInfo = ref(auth.getUserInfo() || {});
const myUserId = computed(() => userInfo.value.userId);
const myAvatarText = computed(() => (userInfo.value.realName || userInfo.value.username || "U").slice(0, 1).toUpperCase());

let pollTimer = null;

const emojis = [
  "😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊",
  "😋", "😎", "😍", "🥰", "😘", "😗", "😙", "😚", "🙂", "🤗",
  "🤔", "😐", "😑", "😶", "🙄", "😏", "😣", "😥", "😮", "🤐",
  "😯", "😪", "😫", "😴", "😌", "😛", "😜", "😝", "🤤", "😒",
  "😓", "😔", "😕", "🙃", "🤑", "😲", "🙁", "😖", "😞", "😟",
  "😤", "😢", "😭", "😦", "😧", "😨", "😩", "🤯", "😬", "😰",
  "😱", "🥵", "🥶", "😳", "🤪", "😵", "😡", "😠", "🤬", "😷",
  "🤒", "🤕", "🤢", "🤮", "🥴", "😇", "🥳", "🥺", "🤠", "🤡",
  "👍", "👎", "👏", "🙌", "🤝", "🙏", "💪", "❤️", "💔", "💯",
  "🎉", "🎊", "🔥", "⭐", "✅", "❌", "❓", "💤", "💬", "👋"
];

onLoad((query) => {
  conversationId.value = query.id ? Number(query.id) : null;
  convName.value = decodeURIComponent(query.name || "聊天");
  convType.value = query.convType || "SINGLE";
  if (conversationId.value) {
    loadMessages();
    markAsRead();
    startPolling();
  }
});

async function loadMessages(before) {
  if (!conversationId.value) return;
  const params = { limit: 30 };
  if (before) params.beforeId = before;
  try {
    if (before) loadingHistory.value = true;
    const url = apiCfg.fillPath(apiCfg.chat.messages, { id: conversationId.value });
    const res = await http.get(url, params, { silent: true });
    const list = res.data || [];
    if (before) {
      messages.value = [...list.reverse(), ...messages.value];
      hasMoreHistory.value = list.length >= 30;
    } else {
      messages.value = list.reverse();
      await nextTick();
      scrollToBottom();
    }
  } catch (e) { /* ignore */ }
  finally { loadingHistory.value = false; }
}

function onRefresh() {
  refreshing.value = true;
  if (messages.value.length > 0 && hasMoreHistory.value) {
    const oldest = messages.value[0];
    loadMessages(oldest.id).then(() => { refreshing.value = false; });
  } else {
    refreshing.value = false;
  }
}

async function sendText() {
  const text = inputText.value.trim();
  if (!text) return;
  inputText.value = "";
  showEmoji.value = false;
  try {
    const payload = {
      conversationId: conversationId.value,
      msgType: "TEXT",
      content: text
    };
    if (replyTo.value) {
      payload.replyToId = replyTo.value.id;
      replyTo.value = null;
    }
    const res = await http.post(apiCfg.chat.send, payload);
    if (res.data) {
      messages.value.push(res.data);
      await nextTick();
      scrollToBottom();
    }
  } catch (e) {
    inputText.value = text;
    uni.showToast({ title: "发送失败", icon: "none" });
  }
}

async function chooseImage() {
  showEmoji.value = false;
  try {
    const res = await uni.chooseImage({ count: 1, sizeType: ["compressed"] });
    const filePath = res.tempFilePaths[0];
    uni.showLoading({ title: "上传中..." });
    const uploadRes = await uploadFile(filePath, "chat");
    const ossPath = uploadRes.ossPath || uploadRes.url || uploadRes.path;
    await http.post(apiCfg.chat.send, {
      conversationId: conversationId.value,
      msgType: "IMAGE",
      content: ossPath,
      extraJson: JSON.stringify({ filename: uploadRes.originalFilename || "image" })
    });
    uni.hideLoading();
    loadMessages();
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: "图片发送失败", icon: "none" });
  }
}

async function chooseFile() {
  showEmoji.value = false;
  uni.showToast({ title: "文件选择暂仅支持图片", icon: "none" });
}

function toggleEmoji() {
  showEmoji.value = !showEmoji.value;
}

function insertEmoji(e) {
  inputText.value += e;
}

function onMsgLongPress(msg) {
  if (msg.recalled === 1 || msg.msgType === "SYSTEM") return;
  const actions = [];
  if (msg.msgType === "TEXT") actions.push("复制");
  actions.push("回复");
  if (msg.senderId === myUserId.value) {
    const age = Date.now() - new Date(msg.createdAt).getTime();
    if (age < 120000) actions.push("撤回");
  }
  actions.push("转发");
  uni.showActionSheet({
    itemList: actions,
    success(res) {
      const action = actions[res.tapIndex];
      if (action === "复制") copyText(msg);
      else if (action === "回复") startReply(msg);
      else if (action === "撤回") recallMessage(msg);
      else if (action === "转发") forwardMessage(msg);
    }
  });
}

function copyText(msg) {
  uni.setClipboardData({ data: msg.content });
}

function startReply(msg) {
  replyTo.value = msg;
  inputFocus.value = true;
}

async function recallMessage(msg) {
  try {
    const url = apiCfg.fillPath(apiCfg.chat.recall, { id: msg.id });
    await http.post(url, {});
    const idx = messages.value.findIndex(m => m.id === msg.id);
    if (idx >= 0) {
      messages.value[idx].recalled = 1;
      messages.value[idx].recalledAt = new Date().toISOString();
    }
  } catch (e) {
    uni.showToast({ title: "撤回失败", icon: "none" });
  }
}

function forwardMessage(msg) {
  const data = encodeURIComponent(JSON.stringify({
    msgType: msg.msgType,
    content: msg.content,
    extraJson: msg.extraJson
  }));
  uni.navigateTo({ url: "/pages/chat/forward?data=" + data });
}

async function markAsRead() {
  if (!conversationId.value || messages.value.length === 0) return;
  const lastMsg = messages.value[messages.value.length - 1];
  if (!lastMsg) return;
  try {
    await http.post(apiCfg.chat.read, {
      conversationId: conversationId.value,
      lastReadId: lastMsg.id
    }, { silent: true });
  } catch (e) { /* ignore */ }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    if (messages.value.length > 0) {
      const last = messages.value[messages.value.length - 1];
      loadMessages();
    }
  }, 15000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function shouldShowDate(idx) {
  if (idx === 0) return true;
  const curr = new Date(messages.value[idx].createdAt);
  const prev = new Date(messages.value[idx - 1].createdAt);
  return curr.toDateString() !== prev.toDateString();
}

function formatDateDivider(time) {
  if (!time) return "";
  const d = new Date(time);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today - msgDay) / 86400000;
  if (diff < 1) return "今天";
  if (diff < 2) return "昨天";
  return (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

function formatMsgTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}

function getImageUrl(content) {
  if (!content) return "";
  if (/^https?:\/\//i.test(content)) return content;
  return apiCfg.getUrl("/files/resource?path=" + encodeURIComponent(content));
}

function parseFileName(msg) {
  try {
    const extra = JSON.parse(msg.extraJson || "{}");
    return extra.filename || "文件";
  } catch (e) { return "文件"; }
}

function parseFileSize(msg) {
  try {
    const extra = JSON.parse(msg.extraJson || "{}");
    if (extra.size) {
      const s = Number(extra.size);
      if (s > 1048576) return (s / 1048576).toFixed(1) + "MB";
      return (s / 1024).toFixed(0) + "KB";
    }
  } catch (e) { /* ignore */ }
  return "";
}

function previewImage(msg) {
  const url = getImageUrl(msg.content);
  if (url) {
    uni.previewImage({ urls: [url], current: url });
  }
}

function openFile(msg) {
  uni.showToast({ title: "文件下载功能开发中", icon: "none" });
}

function scrollToBottom() {
  scrollTop.value = 999999;
}

function goBack() {
  uni.navigateBack();
}

function goDetail() {
  // TODO: 会话详情页（群成员、设置等）
  uni.showToast({ title: "详情页开发中", icon: "none" });
}

onUnmounted(() => {
  stopPolling();
  markAsRead();
});
</script>

<style scoped>
.chat-room {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f0f2f5;
}

.nav-bar {
  display: flex;
  align-items: center;
  padding: 50px 16px 12px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
}

.nav-back {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 20px;
  color: #fff;
}

.nav-center {
  flex: 1;
  text-align: center;
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
}

.nav-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  margin-left: 4px;
}

.nav-right {
  width: 36px;
  display: flex;
  justify-content: center;
}

.nav-action {
  font-size: 16px;
  color: #fff;
  letter-spacing: 2px;
}

.msg-scroll {
  flex: 1;
  padding: 12px;
}

.loading-more {
  text-align: center;
  padding: 12px;
  color: #94a3b8;
  font-size: 13px;
}

.date-divider {
  text-align: center;
  padding: 16px 0 8px;
}

.date-text {
  font-size: 12px;
  color: #94a3b8;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 12px;
  border-radius: 10px;
}

.system-msg {
  text-align: center;
  padding: 8px 0;
}

.system-text {
  font-size: 12px;
  color: #94a3b8;
  background: rgba(0, 0, 0, 0.05);
  padding: 4px 12px;
  border-radius: 10px;
}

.msg-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
  padding: 0 8px;
}

.msg-row.mine {
  justify-content: flex-end;
}

.msg-row.other {
  justify-content: flex-start;
}

.msg-avatar-left, .msg-avatar-right {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.msg-avatar-left {
  margin-right: 8px;
}

.msg-avatar-right {
  margin-left: 8px;
}

.avatar-char {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.msg-body {
  max-width: 70%;
}

.msg-sender-name {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
  display: block;
}

.reply-preview {
  background: rgba(0, 0, 0, 0.05);
  border-left: 3px solid #3b82f6;
  padding: 4px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
}

.reply-name {
  font-size: 11px;
  color: #3b82f6;
  display: block;
}

.reply-content {
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
  display: block;
}

.bubble {
  padding: 10px 14px;
  border-radius: 12px;
  word-break: break-all;
}

.bubble-mine {
  background: #3b82f6;
  border-top-right-radius: 4px;
  color: #fff;
}

.bubble-other {
  background: #fff;
  border-top-left-radius: 4px;
  color: #1e293b;
}

.recalled-bubble {
  background: rgba(0, 0, 0, 0.05) !important;
  color: #94a3b8 !important;
}

.bubble-text {
  font-size: 15px;
  line-height: 1.5;
}

.recalled-text {
  font-size: 13px;
  color: #94a3b8;
  font-style: italic;
}

.bubble-image {
  border-radius: 8px;
  max-width: 200px;
}

.bubble-file {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 180px;
}

.file-icon {
  font-size: 28px;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 11px;
  opacity: 0.7;
  display: block;
}

.msg-meta {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 4px;
}

.msg-row.other .msg-meta {
  justify-content: flex-start;
}

.msg-time {
  font-size: 11px;
  color: #94a3b8;
}

.edited-tag {
  font-size: 11px;
  color: #94a3b8;
}

/* 回复栏 */
.reply-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
}

.reply-bar-content {
  flex: 1;
  min-width: 0;
}

.reply-bar-name {
  font-size: 12px;
  color: #3b82f6;
}

.reply-bar-preview {
  font-size: 12px;
  color: #64748b;
  margin-left: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reply-bar-close {
  font-size: 16px;
  color: #94a3b8;
  padding: 4px 8px;
}

/* 底部输入区 */
.input-area {
  background: #fff;
  padding-bottom: env(safe-area-inset-bottom);
}

.input-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
}

.tool-btn {
  font-size: 22px;
  padding: 4px;
}

.text-input {
  flex: 1;
  background: #f1f5f9;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 15px;
}

.send-btn {
  padding: 6px 14px;
  border-radius: 20px;
  background: #e2e8f0;
}

.send-active {
  background: #3b82f6;
}

.send-text {
  font-size: 14px;
  color: #fff;
  font-weight: 500;
}

.emoji-panel {
  height: 220px;
  border-top: 1px solid #e2e8f0;
}

.emoji-scroll {
  height: 220px;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 8px;
}

.emoji-item {
  width: 10%;
  text-align: center;
  font-size: 24px;
  padding: 8px 0;
}
</style>
