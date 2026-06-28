<template>
  <view class="chat-room">
    <!-- 自定义导航栏 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <view class="nav-center" @click="onHeaderClick">
        <view v-if="convType === 'SINGLE'" class="nav-avatar">
          <image v-if="peerAvatarUrl" :src="peerAvatarUrl" class="nav-avatar-img" mode="aspectFill" />
          <text v-else class="nav-avatar-char">{{ convName.slice(0, 1) }}</text>
        </view>
        <view class="nav-title-wrap">
          <text class="nav-title">{{ convName }}</text>
          <text v-if="convType === 'GROUP'" class="nav-sub">{{ memberCount }}人</text>
        </view>
      </view>
      <view class="nav-right">
        <text class="nav-action" @click="showDetail = true">•••</text>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view
      class="msg-scroll"
      scroll-y
      :scroll-into-view="scrollIntoView"
      @scrolltoupper="onScrollToUpper"
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

        <!-- 已撤回消息：居中显示，与钉钉/微信一致，不重复展现在页面 -->
        <view v-else-if="msg.recalled === 1" class="system-msg">
          <text class="system-text">{{ msg.senderId === myUserId ? '你撤回了一条消息' : (msg.senderName || '对方') + '撤回了一条消息' }}</text>
        </view>

        <!-- 普通消息 -->
        <view
          v-else
          :class="['msg-row', msg.senderId === myUserId ? 'mine' : 'other']"
          :data-msg-id="msg.id"
          @touchstart="onMsgTouchStart($event, msg)"
          @touchend="onMsgTouchEnd"
          @touchmove="onMsgTouchMove"
        >
          <view v-if="convType === 'GROUP' && msg.senderId !== myUserId" class="msg-avatar-left" @click="showUserProfile(msg.senderId)">
            <image v-if="getImageUrl(msg.senderAvatar)" :src="getImageUrl(msg.senderAvatar)" class="msg-avatar-img" mode="aspectFill" />
            <text v-else class="avatar-char">{{ (msg.senderName || 'U').slice(0, 1) }}</text>
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
              :class="['bubble', msg.senderId === myUserId ? 'bubble-mine' : 'bubble-other']"
            >
              <!-- 文本消息 -->
              <text v-if="msg.msgType === 'TEXT'" class="bubble-text">{{ msg.content }}</text>

              <!-- 图片消息 -->
              <image
                v-else-if="msg.msgType === 'IMAGE'"
                class="bubble-image"
                :src="getMsgImageUrl(msg.content)"
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
              <text v-if="msg.edited === 1" class="edited-tag" @click="showEditHistory(msg)">已编辑</text>
              <text class="msg-time">{{ formatMsgTime(msg.createdAt) }}</text>
            </view>
          </view>

          <view v-if="msg.senderId === myUserId" class="msg-avatar-right" @click="showMyProfile">
            <image v-if="myAvatarUrl" :src="myAvatarUrl" class="msg-avatar-img" mode="aspectFill" />
            <text v-else class="avatar-char">{{ myAvatarText }}</text>
          </view>
        </view>
      </view>

      <view id="msg-bottom"></view>
    </scroll-view>

    <!-- 会话详情弹窗（替代原生 actionSheet，参考钉钉微信风格） -->
    <view v-if="showDetail" class="popup-overlay" @click="showDetail = false">
      <view class="popup-sheet" @click.stop>
        <view class="popup-sheet-header">
          <image v-if="peerAvatarUrl" :src="peerAvatarUrl" class="popup-sheet-avatar" mode="aspectFill" />
          <text v-else class="popup-sheet-avatar-char">{{ convName.slice(0, 1) }}</text>
          <text class="popup-sheet-name">{{ convName }}</text>
          <text class="popup-sheet-sub">{{ convType === 'SINGLE' ? '单聊' : '群聊' }}{{ convType === 'GROUP' ? ' · ' + memberCount + '人' : '' }}</text>
        </view>
        <view class="popup-sheet-list">
          <view class="popup-sheet-row">
            <text class="popup-sheet-row-label">置顶会话</text>
            <switch :checked="pinned === 1" @change="togglePin($event.detail.value ? 1 : 0)" color="#3b82f6" />
          </view>
          <view class="popup-sheet-row">
            <text class="popup-sheet-row-label">消息免打扰</text>
            <switch :checked="muted === 1" @change="toggleMute($event.detail.value ? 1 : 0)" color="#3b82f6" />
          </view>
        </view>
        <view class="popup-sheet-actions">
          <view v-if="convType === 'SINGLE' && peerUserId" class="popup-sheet-btn" @click="showDetail = false; goPeerProfile()">
            <text>查看资料</text>
          </view>
          <view class="popup-sheet-btn danger" @click="showDetail = false; deleteConversation()">
            <text>删除会话</text>
          </view>
        </view>
        <view class="popup-sheet-cancel" @click="showDetail = false">
          <text>取消</text>
        </view>
      </view>
    </view>

    <!-- 编辑历史弹窗（替代原生 actionSheet，参考钉钉风格） -->
    <view v-if="editHistoryVisible" class="popup-overlay" @click="editHistoryVisible = false">
      <view class="popup-sheet" @click.stop>
        <view class="popup-sheet-header">
          <text class="popup-sheet-title">编辑记录</text>
          <text class="popup-sheet-close-btn" @click="editHistoryVisible = false">✕</text>
        </view>
        <scroll-view scroll-y class="history-scroll">
          <view v-for="(h, i) in currentEditHistory" :key="i" class="history-item">
            <view class="history-item-header">
              <text class="history-item-idx">{{ i === currentEditHistory.length - 1 ? '当前版本' : ('第' + (i + 1) + '版') }}</text>
              <text class="history-item-time">{{ h.editedAt ? formatMsgTime(h.editedAt) : '' }}</text>
            </view>
            <text class="history-item-content">{{ h.content }}</text>
          </view>
          <view v-if="currentEditHistory.length === 0" class="history-empty">暂无编辑记录</view>
        </scroll-view>
        <view class="popup-sheet-cancel" @click="editHistoryVisible = false">
          <text>关闭</text>
        </view>
      </view>
    </view>

    <!-- 个人信息预览弹窗（点击自己头像，与 Web 端 showUserProfile 一致） -->
    <view v-if="profileVisible" class="popup-overlay" @click="profileVisible = false">
      <view class="popup-sheet" @click.stop>
        <view class="popup-sheet-header">
          <image v-if="myAvatarUrl" :src="myAvatarUrl" class="popup-sheet-avatar" mode="aspectFill" />
          <text v-else class="popup-sheet-avatar-char">{{ myAvatarText }}</text>
          <text class="popup-sheet-name">{{ userInfo.realName || userInfo.username || '我' }}</text>
          <text v-if="userInfo.position" class="popup-sheet-sub">{{ userInfo.position }}</text>
          <text v-if="userInfo.deptName" class="popup-sheet-sub">{{ userInfo.deptName }}</text>
        </view>
        <view class="popup-sheet-list">
          <view class="popup-sheet-row">
            <text class="popup-sheet-row-label">工号</text>
            <text class="popup-sheet-row-value">{{ userInfo.username || '—' }}</text>
          </view>
          <view class="popup-sheet-row" v-if="userInfo.phone">
            <text class="popup-sheet-row-label">手机</text>
            <text class="popup-sheet-row-value cd-link">{{ userInfo.phone }}</text>
          </view>
          <view class="popup-sheet-row" v-if="userInfo.email">
            <text class="popup-sheet-row-label">邮箱</text>
            <text class="popup-sheet-row-value">{{ userInfo.email }}</text>
          </view>
        </view>
        <view class="popup-sheet-cancel" @click="profileVisible = false">
          <text>关闭</text>
        </view>
      </view>
    </view>

    <!-- 回复栏 -->
    <view v-if="replyTo && !editingMsg" class="reply-bar">
      <view class="reply-bar-content">
        <text class="reply-bar-name">回复 {{ replyTo.senderName }}：</text>
        <text class="reply-bar-preview">{{ replyTo.msgType === 'IMAGE' ? '[图片]' : (replyTo.content || '').slice(0, 50) }}</text>
      </view>
      <text class="reply-bar-close" @click="replyTo = null">✕</text>
    </view>

    <!-- 编辑栏（与 Web 端一致：显示编辑提示 + 关闭按钮） -->
    <view v-if="editingMsg" class="edit-bar">
      <view class="edit-bar-content">
        <text class="edit-bar-label">✏️ 编辑消息</text>
        <text class="edit-bar-preview">仅可编辑本人发送的文本消息</text>
      </view>
      <text class="edit-bar-close" @click="cancelEdit">✕</text>
    </view>

    <!-- 底部输入区 -->
    <view class="input-area">
      <view class="input-row">
        <text class="tool-btn" @click="toggleEmoji">😊</text>
        <input
          class="text-input"
          v-model="inputText"
          :placeholder="editingMsg ? '编辑消息...' : '输入消息...'"
          confirm-type="send"
          @confirm="editingMsg ? submitEdit() : sendText()"
          :focus="inputFocus"
        />
        <text class="tool-btn" @click="chooseImage">📷</text>
        <text class="tool-btn" @click="chooseFile">📎</text>
        <view :class="['send-btn', inputText.trim() ? 'send-active' : '']" @click="editingMsg ? submitEdit() : sendText()">
          <text class="send-text">{{ editingMsg ? '保存' : (replyTo ? '回复' : '发送') }}</text>
        </view>
      </view>

      <!-- 表情面板（从后端字典 emoji 加载，与 Web 端分类一致） -->
      <view v-if="showEmoji" class="emoji-panel">
        <scroll-view scroll-x class="emoji-tabs">
          <view class="emoji-tabs-inner">
            <text
              v-for="cat in emojiCategories"
              :key="cat.name"
              :class="['emoji-tab', emojiActiveCat === cat.name ? 'emoji-tab-active' : '']"
              @click="emojiActiveCat = cat.name"
            >{{ cat.icon }}</text>
          </view>
        </scroll-view>
        <scroll-view scroll-y class="emoji-scroll">
          <block v-for="cat in emojiCategories" :key="cat.name">
            <view v-show="cat.name === emojiActiveCat">
              <text class="emoji-cat-name">{{ cat.name }}</text>
              <view class="emoji-grid">
                <text v-for="e in cat.emojis" :key="e" class="emoji-item" @click="insertEmoji(e)">{{ e }}</text>
              </view>
            </view>
          </block>
          <view v-if="emojiCategories.length === 0" class="emoji-empty">表情加载中...</view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import * as http from "../../utils/request.js";
import * as auth from "../../utils/auth.js";
import apiCfg from "../../config/api.js";
import { uploadFile } from "../../utils/file-upload.js";
import { getImageUrl } from "../../utils/image-url.js";
import { fetchDictData } from "../../utils/dict.js";

const conversationId = ref(null);
const convName = ref("");
const convType = ref("SINGLE");
const memberCount = ref(0);
const peerUserId = ref(null);
const peerAvatar = ref("");
const pinned = ref(0);
const muted = ref(0);
const messages = ref([]);
const inputText = ref("");
const inputFocus = ref(false);
const showEmoji = ref(false);
const replyTo = ref(null);
const editingMsg = ref(null);
const scrollIntoView = ref("");
const loadingHistory = ref(false);
const hasMoreHistory = ref(true);
const showDetail = ref(false);
const editHistoryVisible = ref(false);
const currentEditHistory = ref([]);
const profileVisible = ref(false);

// emoji 分类数据（从后端字典加载，与 Web 端 emojis.ts 一致）
const emojiCategories = ref([]);
const emojiActiveCat = ref("face");

const EMOJI_CATEGORY_META = {
  face: { name: "表情", icon: "😊" },
  gesture: { name: "手势", icon: "👋" },
  people: { name: "人物", icon: "👶" },
  animal_nature: { name: "动植物", icon: "🐶" },
  food: { name: "食物", icon: "🍎" },
  activity: { name: "活动", icon: "⚽" },
  travel: { name: "旅行", icon: "🚗" },
  objects: { name: "物品", icon: "💡" },
  symbols: { name: "符号", icon: "❤️" },
};
const EMOJI_CATEGORY_ORDER = ["face", "gesture", "people", "animal_nature", "food", "activity", "travel", "objects", "symbols"];

async function loadEmojis() {
  try {
    const items = await fetchDictData("emoji");
    if (!items || !items.length) return;
    const grouped = {};
    for (const item of items) {
      const cat = item.value.includes(":") ? item.value.split(":")[0] : item.value;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item.label);
    }
    const result = [];
    for (const code of EMOJI_CATEGORY_ORDER) {
      const list = grouped[code];
      const meta = EMOJI_CATEGORY_META[code];
      if (list && list.length > 0 && meta) {
        result.push({ name: meta.name, icon: meta.icon, emojis: list });
      }
    }
    emojiCategories.value = result;
    if (result.length > 0) emojiActiveCat.value = result[0].name;
  } catch (e) { /* ignore */ }
}

const userInfo = ref(auth.getUserInfo() || {});
const myUserId = computed(() => userInfo.value.userId);
const myAvatarText = computed(() => (userInfo.value.realName || userInfo.value.username || "U").slice(0, 1).toUpperCase());
const myAvatarUrl = computed(() => getImageUrl(userInfo.value.avatarUrl, "avatar.jpg"));
const peerAvatarUrl = computed(() => getImageUrl(peerAvatar.value, "avatar.jpg"));

let pollTimer = null;

const urlName = ref("");

onLoad((query) => {
  // 重置页面状态
  messages.value = [];
  showEmoji.value = false;
  replyTo.value = null;
  editingMsg.value = null;
  hasMoreHistory.value = true;
  showDetail.value = false;
  editHistoryVisible.value = false;
  profileVisible.value = false;
  inputText.value = "";
  scrollIntoView.value = "";

  // 保持 String 类型：后端 Jackson Long→String 序列化，Number() 会丢失大ID精度
  conversationId.value = query.id || null;
  convName.value = decodeURIComponent(query.name || "聊天");
  urlName.value = query.name || "";
  convType.value = query.convType || "SINGLE";
  // 从 list.vue 传递的会话元数据中提取信息（Web 端 selectConversation 行为一致）
  if (query.meta) {
    try {
      const meta = JSON.parse(decodeURIComponent(query.meta));
      peerUserId.value = meta.peerUserId || null;
      peerAvatar.value = meta.peerAvatar || "";
      memberCount.value = meta.memberCount || 0;
      pinned.value = meta.pinned || 0;
      muted.value = meta.muted || 0;
    } catch (e) { /* parse error, ignore */ }
  }
  if (conversationId.value) {
    loadMessages();
    startPolling();
  }
  loadEmojis();
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
      // 记录 prepend 前第一个元素，用于保持滚动位置
      const firstId = messages.value.length > 0 ? messages.value[0].id : null;
      messages.value = [...list, ...messages.value];
      hasMoreHistory.value = list.length >= 30;
      // 保持滚动位置：滚动到之前第一条消息
      if (firstId) {
        await nextTick();
        scrollIntoView.value = "msg-" + firstId;
        setTimeout(() => { scrollIntoView.value = ""; }, 150);
      }
    } else {
      messages.value = list;
      hasMoreHistory.value = list.length >= 30;
      await nextTick();
      // 首次加载或发送消息后都滚动到底部
      scrollToBottom();
      markAsRead();
    }
  } catch (e) { /* ignore */ }
  finally { loadingHistory.value = false; }
}

function onScrollToUpper() {
  if (loadingHistory.value || !hasMoreHistory.value || messages.value.length === 0) return;
  const oldest = messages.value[0];
  loadMessages(oldest.id);
}

async function sendText() {
  const text = inputText.value.trim();
  if (!text) return;
  if (text.length > 4000) {
    uni.showToast({ title: "消息超出4000字符上限", icon: "none" });
    return;
  }
  inputText.value = "";
  showEmoji.value = false;
  editingMsg.value = null;
  try {
    const payload = {
      conversationId: conversationId.value,
      msgType: "TEXT",
      content: text
    };
    if (replyTo.value) {
      payload.replyToId = replyTo.value.id;
    }
    await http.post(apiCfg.chat.send, payload);
    replyTo.value = null;
    // 发送后重新加载消息列表，与 Web 端对齐（保证 senderName/avatar 等完整字段）
    await loadMessages();
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
  if (showEmoji.value) {
    // 收起键盘，展示表情面板（与钉钉/微信一致：点表情按钮时关闭键盘）
    inputFocus.value = false;
  }
  // 等待 flex 布局重新计算完成后，滚动消息列表到底部
  // 用 setTimeout 确保 DOM 已更新 + 布局已稳定（约 1-2 帧）
  nextTick(() => {
    setTimeout(() => scrollToBottom(), 50);
  });
}

function insertEmoji(e) {
  inputText.value += e;
}

// ====== 自定义长按检测（与钉钉/微信一致：10px 移动阈值 + 按压视觉反馈）======
let longPressTimer = null;
let longPressTarget = null;
let touchStartX = 0;
let touchStartY = 0;
const TOUCH_MOVE_THRESHOLD = 10; // 钉钉/微信标准：手指移动超过 10px 才取消长按，允许自然微动

function onMsgTouchStart(e, msg) {
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  if (!touch) return;
  touchStartX = touch.clientX || touch.pageX || 0;
  touchStartY = touch.clientY || touch.pageY || 0;
  longPressTarget = msg;
  clearLongPressTimer();
  longPressTimer = setTimeout(() => {
    if (longPressTarget) {
      onMsgLongPress(longPressTarget);
    }
    clearLongPressTimer();
  }, 500);
}

function onMsgTouchEnd() {
  clearLongPressTimer();
}

function onMsgTouchMove(e) {
  if (!longPressTimer) return; // 计时器已清除则忽略
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  if (!touch) return;
  const dx = (touch.clientX || touch.pageX || 0) - touchStartX;
  const dy = (touch.clientY || touch.pageY || 0) - touchStartY;
  // 只有移动超过阈值才取消（与钉钉/微信一致：允许手指自然微动 1-2px）
  if (Math.abs(dx) > TOUCH_MOVE_THRESHOLD || Math.abs(dy) > TOUCH_MOVE_THRESHOLD) {
    clearLongPressTimer();
  }
}

function clearLongPressTimer() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  longPressTarget = null;
}

function onMsgLongPress(msg) {
  if (msg.recalled === 1 || msg.msgType === "SYSTEM") return;
  const actions = [];
  if (msg.msgType === "TEXT") actions.push("复制");
  actions.push("回复");
  if (msg.senderId === myUserId.value) {
    const age = Date.now() - new Date(msg.createdAt).getTime();
    if (age < 120000) actions.push("撤回");
    // 编辑：自己的文本消息且未撤回（与 Web 端 canEdit 一致）
    if (msg.msgType === "TEXT") actions.push("编辑");
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
      else if (action === "编辑") startEdit(msg);
    }
  });
}

function copyText(msg) {
  uni.setClipboardData({ data: msg.content });
}

function startReply(msg) {
  if (msg.recalled === 1) return;
  replyTo.value = msg;
  editingMsg.value = null;  // 与 Web 端一致：回复时退出编辑模式
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

// ====== 编辑消息（与 Web 端 startEdit / cancelEdit / submitEdit 一致）======
function startEdit(msg) {
  if (!msg || msg.recalled === 1 || msg.msgType !== "TEXT" || msg.senderId !== myUserId.value) return;
  editingMsg.value = msg;
  replyTo.value = null;
  inputText.value = msg.content || "";
  inputFocus.value = true;
}

function cancelEdit() {
  editingMsg.value = null;
  inputText.value = "";
}

async function submitEdit() {
  if (!editingMsg.value) return;
  const text = inputText.value.trim();
  if (!text) return;
  if (text.length > 4000) {
    uni.showToast({ title: "消息超出4000字符上限", icon: "none" });
    return;
  }
  if (text === (editingMsg.value.content || "")) {
    cancelEdit();
    return;
  }
  try {
    const url = apiCfg.fillPath(apiCfg.chat.edit, { id: editingMsg.value.id });
    const res = await http.post(url, { content: text });
    const updated = res.data;
    const idx = messages.value.findIndex(m => m.id === editingMsg.value.id);
    if (idx >= 0) {
      if (updated) {
        messages.value[idx] = {
          ...messages.value[idx],
          content: updated.content ?? text,
          edited: updated.edited ?? 1,
          editedAt: updated.editedAt ?? new Date().toISOString(),
          extraJson: updated.extraJson ?? messages.value[idx].extraJson
        };
      } else {
        // 后端没返回完整对象，本地构造编辑历史（与 Web 端一致：保留 extraJson 其他字段）
        const old = messages.value[idx];
        const oldHistory = parseEditHistory(old);
        oldHistory.push({ content: old.content || "", editedAt: old.editedAt || old.createdAt || "" });
        let oldExtra = {};
        try { oldExtra = JSON.parse(old.extraJson || "{}"); } catch (e) { /* ignore */ }
        const newExtra = JSON.stringify({ ...oldExtra, editHistory: oldHistory });
        messages.value[idx] = {
          ...old,
          content: text,
          edited: 1,
          editedAt: new Date().toISOString(),
          extraJson: newExtra
        };
      }
    }
    uni.showToast({ title: "已保存", icon: "success" });
    cancelEdit();
  } catch (e) {
    uni.showToast({ title: "编辑失败", icon: "none" });
  }
}

function parseEditHistory(msg) {
  if (!msg.extraJson) return [];
  try {
    const obj = JSON.parse(msg.extraJson);
    if (Array.isArray(obj.editHistory)) return obj.editHistory;
  } catch (e) { /* ignore */ }
  return [];
}

function showEditHistory(msg) {
  const history = parseEditHistory(msg);
  currentEditHistory.value = [
    ...history,
    { content: msg.content || "", editedAt: msg.editedAt || msg.createdAt || "" }
  ];
  editHistoryVisible.value = true;
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

function getMsgImageUrl(content) {
  return getImageUrl(content);
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
  const url = getMsgImageUrl(msg.content);
  if (url) {
    uni.previewImage({ urls: [url], current: url });
  }
}

function openFile(msg) {
  uni.showToast({ title: "文件下载功能开发中", icon: "none" });
}

function scrollToBottom() {
  // 先清空再赋值，确保 scroll-into-view 每次都能触发滚动
  scrollIntoView.value = "";
  nextTick(() => {
    scrollIntoView.value = "msg-bottom";
    setTimeout(() => { scrollIntoView.value = ""; }, 200);
  });
}

function goBack() {
  try {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      uni.navigateBack();
    } else {
      uni.switchTab({ url: "/pages/chat/list" });
    }
  } catch (e) {
    uni.switchTab({ url: "/pages/chat/list" });
  }
}

// goDetail 已废弃：改为点击•••直接打开 showDetail 自定义弹窗
// 保留函数别名供兼容（不再使用原生 actionSheet）
function goDetail() {
  showDetail.value = true;
}

function onHeaderClick() {
  if (convType.value === "SINGLE" && peerUserId.value) {
    goPeerProfile();
  }
}

function goPeerProfile() {
  if (!peerUserId.value) return;
  uni.navigateTo({ url: "/pages/contacts/detail?id=" + peerUserId.value });
}

// 点击他人头像查看资料
function showUserProfile(userId) {
  if (!userId) return;
  uni.navigateTo({ url: "/pages/contacts/detail?id=" + String(userId) });
}

// 点击自己头像：预览个人信息（与 Web 端 showUserProfile 一致，不做页面跳转）
function showMyProfile() {
  profileVisible.value = true;
}

async function togglePin(value) {
  try {
    await http.patch(apiCfg.chat.pinned, { conversationId: conversationId.value, value }, { silent: true });
    pinned.value = value;
  } catch (e) { /* ignore */ }
}

async function toggleMute(value) {
  try {
    await http.patch(apiCfg.chat.muted, { conversationId: conversationId.value, value }, { silent: true });
    muted.value = value;
  } catch (e) { /* ignore */ }
}

async function deleteConversation() {
  uni.showModal({
    title: "提示",
    content: "确定删除该会话？",
    success: async (res) => {
      if (!res.confirm) return;
      try {
        const url = apiCfg.fillPath(apiCfg.chat.deleteConversation, { id: conversationId.value });
        await http.del(url, { silent: true });
        uni.navigateBack();
      } catch (e) { /* ignore */ }
    }
  });
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
  width: 100vw;
  height: 100%;
  overflow: hidden;
  background-color: #f0f2f5;
}

.nav-bar {
  display: flex;
  align-items: center;
  padding: var(--status-bar-height, 44px) 16px 12px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  flex-shrink: 0;
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
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.nav-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.nav-avatar-char {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.nav-title-wrap {
  flex: 1;
  min-width: 0;
  text-align: left;
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
  min-height: 0;
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
  transition: opacity 0.15s;
}

/* 按压视觉反馈：对标钉钉/微信长按消息时的变暗效果 */
.msg-row:active .bubble {
  opacity: 0.65;
  transition: opacity 0.1s;
}

.msg-row:active .msg-avatar-left,
.msg-row:active .msg-avatar-right {
  opacity: 0.7;
  transition: opacity 0.1s;
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
  overflow: hidden;
}

.msg-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
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
  color: #3b82f6;
  text-decoration: underline;
}

/* 回复栏 */
.reply-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
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

/* 编辑栏（与 reply-bar 样式一致，标签颜色不同） */
.edit-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.edit-bar-content {
  flex: 1;
  min-width: 0;
}

.edit-bar-label {
  font-size: 12px;
  color: #f59e0b;
  font-weight: 500;
}

.edit-bar-preview {
  font-size: 12px;
  color: #64748b;
  margin-left: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-bar-close {
  font-size: 16px;
  color: #94a3b8;
  padding: 4px 8px;
}

/* 底部输入区 */
.input-area {
  background: #fff;
  flex-shrink: 0;
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
  border-top: 1px solid #e2e8f0;
  background: #fff;
}

.emoji-tabs {
  white-space: nowrap;
  border-bottom: 1px solid #f1f5f9;
}

.emoji-tabs-inner {
  display: flex;
  padding: 4px 8px;
  gap: 2px;
}

.emoji-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font-size: 18px;
  border-radius: 8px;
  flex-shrink: 0;
}

.emoji-tab-active {
  background: #eff6ff;
}

.emoji-cat-name {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  padding: 8px 12px 0;
}

.emoji-empty {
  text-align: center;
  padding: 40px 0;
  color: #94a3b8;
  font-size: 13px;
}

.emoji-scroll {
  height: 200px;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 4px;
}

.emoji-item {
  width: 14.28%;
  text-align: center;
  font-size: 26px;
  padding: 6px 0;
}

/* ====== 弹窗（popup-overlay / popup-sheet）====== */
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.popup-sheet {
  width: 100%;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  animation: slideUp 0.25s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.popup-sheet-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 16px;
  border-bottom: 1px solid #f1f5f9;
  position: relative;
}

.popup-sheet-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  margin-bottom: 8px;
}

.popup-sheet-avatar-char {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  font-size: 24px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.popup-sheet-name {
  font-size: 17px;
  font-weight: 600;
  color: #1e293b;
}

.popup-sheet-sub {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}

.popup-sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.popup-sheet-close-btn {
  position: absolute;
  right: 16px;
  top: 16px;
  font-size: 18px;
  color: #94a3b8;
  padding: 4px 8px;
}

.popup-sheet-list {
  padding: 0 16px;
}

.popup-sheet-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid #f1f5f9;
}

.popup-sheet-row-label {
  font-size: 15px;
  color: #1e293b;
}

.popup-sheet-row-value {
  font-size: 14px;
  color: #64748b;
}

.popup-sheet-row-value.cd-link {
  color: #3b82f6;
}

.popup-sheet-actions {
  padding: 8px 16px 0;
}

.popup-sheet-btn {
  text-align: center;
  padding: 14px 0;
  font-size: 15px;
  color: #3b82f6;
  border-top: 1px solid #f1f5f9;
}

.popup-sheet-btn.danger {
  color: #ef4444;
}

.popup-sheet-cancel {
  text-align: center;
  padding: 14px 0;
  font-size: 15px;
  color: #64748b;
  background: #f8fafc;
  margin-top: 8px;
  border-top: 1px solid #f1f5f9;
}

/* ====== 编辑历史弹窗 ====== */
.history-scroll {
  max-height: 360px;
  padding: 0 16px;
}

.history-item {
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.history-item:last-child {
  border-bottom: none;
}

.history-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.history-item-idx {
  font-size: 12px;
  color: #3b82f6;
  font-weight: 500;
}

.history-item-time {
  font-size: 11px;
  color: #94a3b8;
}

.history-item-content {
  font-size: 14px;
  color: #1e293b;
  line-height: 1.6;
  word-break: break-all;
}

.history-empty {
  text-align: center;
  padding: 40px 0;
  color: #94a3b8;
  font-size: 13px;
}
</style>
