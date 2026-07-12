<template>
  <view class="chat-room">
    <!-- 自定义导航栏 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <view class="nav-center" @click="onHeaderClick">
        <view v-if="convType === 'SINGLE'" class="nav-avatar">
          <image v-if="peerAvatarSrc" :src="peerAvatarSrc" class="nav-avatar-img" mode="aspectFill" />
          <text v-else class="nav-avatar-char">{{ convName.slice(0, 1) }}</text>
        </view>
        <view class="nav-title-wrap">
          <text class="nav-title">{{ convName }}</text>
          <text v-if="convType === 'GROUP'" class="nav-sub">{{ memberCount }}人</text>
        </view>
      </view>
      <view class="nav-right">
        <text v-if="selectMode" class="nav-select-btn" @click="exitSelectMode">取消</text>
        <text v-else class="nav-action" @click="showDetail = true">•••</text>
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
          :class="['msg-row', msg.senderId === myUserId ? 'mine' : 'other', { 'select-mode': selectMode }]"
          :data-msg-id="msg.id"
          @longpress="onMsgLongPressNative(msg)"
          @touchstart="onMsgTouchStart($event, msg)"
          @touchend="onMsgTouchEnd"
          @touchmove="onMsgTouchMove"
          @click="onMsgRowClick(msg)"
        >
          <!-- 多选模式复选框 -->
          <view v-if="selectMode" class="select-checkbox" @click.stop="toggleMsgSelect(msg)">
            <view :class="['check-circle', isMsgSelected(msg) ? 'checked' : '']">
              <text v-if="isMsgSelected(msg)">✓</text>
            </view>
          </view>
          <view v-if="convType === 'GROUP' && msg.senderId !== myUserId" class="msg-avatar-left" @click="showUserProfile(msg.senderId)">
            <image v-if="getSenderAvatarSrc(getImageUrl(msg.senderAvatar))" :src="getSenderAvatarSrc(getImageUrl(msg.senderAvatar))" class="msg-avatar-img" mode="aspectFill" />
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
            <image v-if="myAvatarSrc" :src="myAvatarSrc" class="msg-avatar-img" mode="aspectFill" @error="onMyAvatarError" />
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
          <image v-if="peerAvatarSrc" :src="peerAvatarSrc" class="popup-sheet-avatar" mode="aspectFill" />
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
          <image v-if="myAvatarSrc" :src="myAvatarSrc" class="popup-sheet-avatar" mode="aspectFill" />
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

    <!-- 多选模式底部操作栏 -->
    <view v-if="selectMode" class="select-bar">
      <view class="select-bar-left" @click="toggleSelectAll">
        <view :class="['check-circle', isAllSelected ? 'checked' : '']">
          <text v-if="isAllSelected">✓</text>
        </view>
        <text class="select-bar-label">全选</text>
      </view>
      <view class="select-bar-actions">
        <view class="select-bar-btn" :class="{ disabled: selectedMsgIds.size === 0 }" @click="doBatchForward">
          <text>转发</text>
        </view>
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
import { loadImage, preloadImages } from "../../utils/image-preloader.js";
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
const selectMode = ref(false);
const selectedMsgIds = ref(new Set());

const isAllSelected = computed(() => {
  const selectable = messages.value.filter(m => m.msgType !== 'SYSTEM' && m.recalled !== 1);
  return selectable.length > 0 && selectable.every(m => selectedMsgIds.value.has(m.id));
});

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

// 头像预加载：URL -> data URI 映射
const myAvatarSrc = ref("");
const peerAvatarSrc = ref("");
const senderAvatarMap = ref({});
const myAvatarError = ref(false);

/** 根据远程 URL 获取已预加载的显示路径 */
function getSenderAvatarSrc(remoteUrl) {
  if (!remoteUrl) return "";
  return senderAvatarMap.value[remoteUrl] || "";
}

/** 预加载导航栏头像（我的 + 对方的） */
async function preloadNavAvatars() {
  const myUrl = myAvatarUrl.value;
  if (myUrl && !myAvatarError.value) {
    myAvatarSrc.value = await loadImage(myUrl);
  }
  const peerUrl = peerAvatarUrl.value;
  if (peerUrl) {
    peerAvatarSrc.value = await loadImage(peerUrl);
  }
}

function onMyAvatarError() {
  myAvatarError.value = true;
  myAvatarSrc.value = "";
}

/** 批量预加载消息发送者头像 */
async function preloadSenderAvatars(msgs) {
  const urls = [...new Set(
    msgs
      .map(m => getImageUrl(m.senderAvatar))
      .filter(Boolean)
  )];
  if (!urls.length) return;
  try {
    const results = await preloadImages(urls);
    const map = { ...senderAvatarMap.value };
    results.forEach((localPath, url) => {
      if (localPath) map[url] = localPath;
    });
    senderAvatarMap.value = map;
  } catch (e) { /* ignore */ }
}

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
  selectMode.value = false;
  selectedMsgIds.value = new Set();
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
  preloadNavAvatars();
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
      // 预加载历史消息中的发送者头像
      preloadSenderAvatars(list);
      // 保持滚动位置：滚动到之前第一条消息
      if (firstId) {
        await nextTick();
        scrollIntoView.value = "msg-" + firstId;
        setTimeout(() => { scrollIntoView.value = ""; }, 150);
      }
    } else {
      messages.value = list;
      hasMoreHistory.value = list.length >= 30;
      // 预加载发送者头像
      preloadSenderAvatars(list);
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

// ====== 长按检测（原生 @longpress + H5 计时器双保险）======
let longPressTimer = null;
let longPressTarget = null;
let longPressTriggered = false; // 防止 @longpress 和计时器双触发
let touchStartX = 0;
let touchStartY = 0;
const TOUCH_MOVE_THRESHOLD = 10;

/** 原生 @longpress 事件入口（仅 App 平台有效） */
function onMsgLongPressNative(msg) {
  longPressTriggered = true;
  clearLongPressTimer();
  onMsgLongPress(msg);
}

function onMsgTouchStart(e, msg) {
  if (selectMode.value) return; // 多选模式下长按不触发菜单
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  if (!touch) return;
  touchStartX = touch.clientX || touch.pageX || 0;
  touchStartY = touch.clientY || touch.pageY || 0;
  longPressTriggered = false;
  longPressTarget = msg;
  clearLongPressTimer();
  longPressTimer = setTimeout(() => {
    if (longPressTarget && !longPressTriggered) {
      longPressTriggered = true;
      onMsgLongPress(longPressTarget);
    }
    clearLongPressTimer();
  }, 500);
}

function onMsgTouchEnd() {
  clearLongPressTimer();
  longPressTriggered = false;
}

function onMsgTouchMove(e) {
  if (!longPressTimer) return;
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  if (!touch) return;
  const dx = (touch.clientX || touch.pageX || 0) - touchStartX;
  const dy = (touch.clientY || touch.pageY || 0) - touchStartY;
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
  if (selectMode.value) return;
  if (msg.recalled === 1 || msg.msgType === "SYSTEM") return;
  const actions = [];
  if (msg.msgType === "TEXT") actions.push("复制");
  actions.push("回复");
  if (msg.senderId === myUserId.value) {
    const age = Date.now() - new Date(msg.createdAt).getTime();
    if (age < 120000) actions.push("撤回");
    if (msg.msgType === "TEXT") actions.push("编辑");
  }
  actions.push("转发");
  actions.push("多选");
  uni.showActionSheet({
    itemList: actions,
    success(res) {
      const action = actions[res.tapIndex];
      if (action === "复制") copyText(msg);
      else if (action === "回复") startReply(msg);
      else if (action === "撤回") recallMessage(msg);
      else if (action === "转发") forwardMessage(msg);
      else if (action === "编辑") startEdit(msg);
      else if (action === "多选") enterSelectMode(msg);
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

// ====== 多选模式 ======
function enterSelectMode(initialMsg) {
  selectMode.value = true;
  selectedMsgIds.value = new Set();
  if (initialMsg) selectedMsgIds.value.add(initialMsg.id);
  showEmoji.value = false;
  editingMsg.value = null;
  replyTo.value = null;
}

function exitSelectMode() {
  selectMode.value = false;
  selectedMsgIds.value = new Set();
}

function isMsgSelected(msg) {
  return selectedMsgIds.value.has(msg.id);
}

function toggleMsgSelect(msg) {
  if (!selectMode.value) return;
  const newSet = new Set(selectedMsgIds.value);
  if (newSet.has(msg.id)) newSet.delete(msg.id);
  else newSet.add(msg.id);
  selectedMsgIds.value = newSet;
}

function toggleSelectAll() {
  const selectable = messages.value.filter(m => m.msgType !== 'SYSTEM' && m.recalled !== 1);
  if (isAllSelected.value) {
    selectedMsgIds.value = new Set();
  } else {
    selectedMsgIds.value = new Set(selectable.map(m => m.id));
  }
}

function onMsgRowClick(msg) {
  if (!selectMode.value) return;
  toggleMsgSelect(msg);
}

function doBatchForward() {
  if (selectedMsgIds.value.size === 0) return;
  const selectedMsgs = messages.value.filter(m => selectedMsgIds.value.has(m.id));
  const data = encodeURIComponent(JSON.stringify(selectedMsgs.map(m => ({
    msgType: m.msgType,
    content: m.content,
    extraJson: m.extraJson
  }))));
  exitSelectMode();
  uni.navigateTo({ url: "/pages/chat/forward?data=" + data + "&batch=1" });
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
  background-color: var(--bg-page);
}

/* ===== 导航栏 ===== */
.nav-bar {
  display: flex;
  align-items: center;
  padding: calc(var(--status-bar-height) + 6px) 16px 10px;
  background: var(--color-gradient);
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
  letter-spacing: 0.3px;
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
  font-size: 18px;
  color: #fff;
  letter-spacing: 2px;
  cursor: pointer;
}

/* ===== 消息列表 ===== */
.msg-scroll {
  flex: 1;
  min-height: 0;
  padding: 12px;
  background: var(--bg-page);
}

.loading-more {
  text-align: center;
  padding: 12px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.date-divider {
  text-align: center;
  padding: 12px 0 8px;
}

.date-text {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-input);
  padding: 3px 12px;
  border-radius: var(--radius-full);
}

.system-msg {
  text-align: center;
  padding: 6px 0;
}

.system-text {
  font-size: 11px;
  color: var(--text-tertiary);
  background: rgba(0, 0, 0, 0.03);
  padding: 3px 10px;
  border-radius: var(--radius-full);
}

/* ===== 消息行 ===== */
.msg-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 14px;
  padding: 0 4px;
  transition: opacity var(--transition-fast);
}

.msg-row:active .bubble {
  opacity: 0.65;
  transition: opacity var(--transition-fast);
}

.msg-row:active .msg-avatar-left,
.msg-row:active .msg-avatar-right {
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.msg-row.mine {
  justify-content: flex-end;
}

.msg-row.other {
  justify-content: flex-start;
}

/* ===== 头像 ===== */
.msg-avatar-left, .msg-avatar-right {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
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

/* ===== 消息体 ===== */
.msg-body {
  max-width: 70%;
}

.msg-sender-name {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  display: block;
}

/* ===== 引用回复 ===== */
.reply-preview {
  background: var(--bg-input);
  border-left: 3px solid var(--color-primary);
  padding: 6px 8px;
  margin-bottom: 6px;
  border-radius: var(--radius-sm);
}

.reply-name {
  font-size: 11px;
  color: var(--color-primary);
  display: block;
}

.reply-content {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
  display: block;
}

/* ===== 气泡 ===== */
.bubble {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  word-break: break-all;
}

.bubble-mine {
  background: var(--color-gradient);
  border-top-right-radius: 4px;
  color: #fff;
  box-shadow: var(--shadow-sm);
}

.bubble-other {
  background: var(--bg-card);
  border-top-left-radius: 4px;
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.bubble-text {
  font-size: 15px;
  line-height: 1.5;
}

.bubble-image {
  border-radius: var(--radius-sm);
  max-width: 200px;
  box-shadow: var(--shadow-sm);
}

.bubble-file {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 180px;
  background: var(--bg-input);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
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
  color: var(--text-primary);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 11px;
  color: var(--text-tertiary);
  display: block;
}

/* ===== 元信息 ===== */
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
  font-size: 10px;
  color: var(--text-tertiary);
}

.edited-tag {
  font-size: 10px;
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}

/* ===== 回复栏 / 编辑栏 ===== */
.reply-bar,
.edit-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-default);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.reply-bar-content,
.edit-bar-content {
  flex: 1;
  min-width: 0;
}

.reply-bar-name {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 500;
}

.reply-bar-preview,
.edit-bar-preview {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-bar-label {
  font-size: 12px;
  color: var(--color-warning);
  font-weight: 500;
}

.reply-bar-close,
.edit-bar-close {
  font-size: 16px;
  color: var(--text-tertiary);
  padding: 4px 8px;
  cursor: pointer;
}

/* ===== 底部输入区 ===== */
.input-area {
  background: var(--bg-card);
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid var(--border-default);
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
  cursor: pointer;
}

.tool-btn:active {
  opacity: 0.6;
  transition: opacity var(--transition-fast);
}

.text-input {
  flex: 1;
  background: var(--bg-input);
  border-radius: var(--radius-full);
  padding: 10px 16px;
  font-size: 15px;
  color: var(--text-primary);
  min-height: 40px;
  box-sizing: border-box;
  width: 100%;
}

.text-input::placeholder {
  color: var(--text-tertiary);
}

.send-btn {
  padding: 8px 16px;
  border-radius: var(--radius-full);
  background: var(--border-strong);
  flex-shrink: 0;
}

.send-active {
  background: var(--color-primary);
}

.send-text {
  font-size: 14px;
  color: #fff;
  font-weight: 600;
}

.send-btn:active {
  opacity: 0.8;
  transition: opacity var(--transition-fast);
}

/* ===== 表情面板 ===== */
.emoji-panel {
  border-top: 1px solid var(--border-default);
  background: var(--bg-card);
  box-shadow: 0 -2px 8px rgba(0,0,0,0.05);
}

.emoji-tabs {
  white-space: nowrap;
  border-bottom: 1px solid var(--border-light);
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
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  cursor: pointer;
}

.emoji-tab:active {
  background: var(--bg-hover);
}

.emoji-tab-active {
  background: var(--bg-hover);
  box-shadow: inset 0 -2px 0 var(--color-primary);
}

.emoji-cat-name {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 8px 12px 0;
}

.emoji-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--text-tertiary);
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
  cursor: pointer;
}

.emoji-item:active {
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

/* ===== 弹窗（popup-overlay / popup-sheet）====== */
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
  background: var(--bg-card);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding-bottom: calc(env(safe-area-inset-bottom) + 16px);
  animation: slideUp 0.25s ease-out;
}

.popup-sheet-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 16px;
  border-bottom: 1px solid var(--border-light);
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
  background: var(--color-gradient);
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
  color: var(--text-primary);
}

.popup-sheet-sub {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.popup-sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.popup-sheet-close-btn {
  position: absolute;
  right: 16px;
  top: 16px;
  font-size: 18px;
  color: var(--text-tertiary);
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
  border-bottom: 1px solid var(--border-light);
}

.popup-sheet-row-label {
  font-size: 15px;
  color: var(--text-primary);
}

.popup-sheet-row-value {
  font-size: 14px;
  color: var(--text-secondary);
}

.popup-sheet-row-value.cd-link {
  color: var(--color-primary);
}

.popup-sheet-actions {
  padding: 8px 16px 0;
}

.popup-sheet-btn {
  text-align: center;
  padding: 14px 0;
  font-size: 15px;
  color: var(--color-primary);
  border-top: 1px solid var(--border-light);
  cursor: pointer;
}

.popup-sheet-btn:active {
  background: var(--bg-hover);
}

.popup-sheet-btn.danger {
  color: var(--color-danger);
}

.popup-sheet-cancel {
  text-align: center;
  padding: 14px 0;
  font-size: 15px;
  color: var(--text-secondary);
  background: var(--bg-input);
  margin-top: 8px;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  cursor: pointer;
}

.popup-sheet-cancel:active {
  background: var(--border-light);
}

/* ===== 编辑历史弹窗 ====== */
.history-scroll {
  max-height: 360px;
  padding: 0 16px;
}

.history-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light);
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
  color: var(--color-primary);
  font-weight: 500;
}

.history-item-time {
  font-size: 11px;
  color: var(--text-tertiary);
}

.history-item-content {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  word-break: break-all;
}

.history-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

/* ===== 多选模式 ===== */
.msg-row.select-mode {
  align-items: center;
}

.select-checkbox {
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0 4px;
}

.check-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.check-circle.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.check-circle text {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.nav-select-btn {
  font-size: 14px;
  color: #fff;
  padding: 4px 10px;
  border: 1px solid rgba(255,255,255,0.5);
  border-radius: 4px;
}

.select-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
}

.select-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.select-bar-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.select-bar-actions {
  display: flex;
  gap: 10px;
}

.select-bar-btn {
  padding: 8px 20px;
  background: var(--color-primary);
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.select-bar-btn.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.select-bar-btn:active {
  opacity: 0.8;
}
</style>
