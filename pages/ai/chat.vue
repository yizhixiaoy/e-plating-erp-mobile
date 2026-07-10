<template>
  <view class="ai-chat-page">
    <!-- 顶部栏 -->
    <view class="chat-header">
      <view class="header-left">
        <text class="header-btn" @tap="showConvList = true">📋</text>
        <text class="header-title">{{ currentConvTitle || 'AI 助手' }}</text>
      </view>
      <view class="header-right">
        <text class="header-btn" @tap="newConversation">＋</text>
      </view>
    </view>

    <!-- 会话列表抽屉 -->
    <view v-if="showConvList" class="conv-overlay" @tap="showConvList = false">
      <view class="conv-panel" @tap.stop>
        <view class="conv-panel-header">
          <text class="conv-panel-title">对话历史</text>
          <text class="conv-panel-close" @tap="showConvList = false">✕</text>
        </view>
        <scroll-view class="conv-list" scroll-y>
          <view
            v-for="c in conversations"
            :key="c.id"
            :class="['conv-item', { active: c.id === convId }]"
            @tap="selectConversation(c)"
          >
            <view class="conv-item-main">
              <text class="conv-item-title">{{ c.title || '新对话' }}</text>
              <text class="conv-item-time">{{ formatTime(c.updated_at || c.created_at) }}</text>
            </view>
            <text class="conv-item-del" @tap.stop="onDeleteConv(c)">🗑</text>
          </view>
          <view v-if="!conversations.length" class="conv-empty">暂无历史对话</view>
        </scroll-view>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view class="msg-list" scroll-y :scroll-into-view="scrollToId" :scroll-with-animation="true">
      <!-- 历史消息加载提示 -->
      <view v-if="hasMoreHistory" class="load-more">
        <text v-if="!loadingHistory" class="load-more-btn" @tap="loadMoreHistory">加载更早的消息</text>
        <text v-else class="load-more-text">加载中...</text>
      </view>

      <view
        v-for="(msg, i) in messages"
        :key="i"
        :id="'msg-' + i"
        :class="['msg-item', msg.role]"
      >
        <!-- 思考过程 -->
        <view v-if="msg.thinkingSteps?.length" class="thinking-panel">
          <view class="thinking-header" @click="toggleMsgThinking(i)">
            <text>🤔 思考过程</text>
            <text :class="['toggle-icon', { expanded: msg._thinkingExpanded }]">▼</text>
          </view>
          <view v-show="msg._thinkingExpanded" class="thinking-body">
            <view v-for="(ts, ti) in msg.thinkingSteps" :key="ti" :class="['step-item', ts.type]">
              <text :class="['step-badge', ts.type]">{{ badgeText(ts.type) }}</text>
              <!-- plan类型：可展开详情 -->
              <view v-if="ts.type === 'plan'" class="plan-content">
                <view class="plan-header" @click="togglePlanDetail(msg, ti)">
                  <text class="step-text">{{ ts.content }}</text>
                  <text :class="['plan-toggle', { expanded: msg._planExpanded?.[ti] }]">▼</text>
                </view>
                <view v-if="msg._planExpanded?.[ti]" class="plan-detail">
                  <view v-for="(ps, pi) in ts.planSteps" :key="pi" class="plan-step-row">
                    <text class="ps-num">{{ ps.step }}.</text>
                    <view class="ps-body">
                      <text class="ps-action">{{ ps.action }}</text>
                      <text class="ps-tool">[{{ ps.tool }}]</text>
                      <text class="ps-params">{{ JSON.stringify(ps.params) }}</text>
                    </view>
                  </view>
                </view>
              </view>
              <text v-else class="step-text">{{ ts.content }}</text>
            </view>
          </view>
        </view>

        <!-- Markdown 渲染的消息内容 -->
        <rich-text v-if="msg.role === 'assistant'" :nodes="renderMarkdown(msg.content)" class="msg-text" />
        <text v-else class="msg-text">{{ msg.content }}</text>

        <!-- 引用来源 -->
        <view v-if="msg.references && msg.references.length" class="ref-box">
          <text class="ref-title">引用来源：</text>
          <view v-for="(r, j) in msg.references" :key="j" class="ref-item">
            <text class="ref-doc">{{ r.doc_title }}</text>
            <text v-if="r.similarity" class="ref-score">({{ (r.similarity * 100).toFixed(0) }}%)</text>
          </view>
        </view>

        <!-- 复制按钮 -->
        <view v-if="msg.role === 'assistant' && msg.content" class="msg-actions">
          <text class="msg-action-btn" @tap="copyText(msg.content)">📋 复制</text>
        </view>
      </view>

      <!-- 流式输出中的消息 -->
      <view v-if="streaming" class="msg-item assistant" id="streaming-msg">
        <rich-text :nodes="renderMarkdown(streamContent)" class="msg-text" />
        <text class="streaming-cursor">|</text>
      </view>

      <!-- 底部占位 -->
      <view style="height: 16px;"></view>
    </scroll-view>

    <!-- 输入区 -->
    <view class="input-bar">
      <input
        v-model="inputText"
        placeholder="输入问题..."
        confirm-type="send"
        :disabled="streaming"
        @confirm="send"
      />
      <button
        size="mini"
        type="primary"
        :disabled="!inputText.trim() || streaming"
        @tap="send"
      >发送</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { streamChat, getConversations, getMessages, deleteConversation } from '@/utils/ai-chat.js'
import { getToken, redirectToLogin, tryRefreshToken } from '@/utils/auth.js'

// ========= 状态 =========
const messages = ref([])
const inputText = ref('')
const streaming = ref(false)
const streamContent = ref('')
const scrollToId = ref('')
const convId = ref(null)
const currentConvTitle = ref('')
const refs = ref([])

// 流式中的中间状态
const thinkingText = ref('')
const thinkingSteps = ref([])
const planSteps = ref([])

// 会话列表
const conversations = ref([])
const showConvList = ref(false)

// 分页
const loadingHistory = ref(false)
const hasMoreHistory = ref(false)
const msgBeforeId = ref(null)

// ═══════ 工具栏 ═══════

function toggleMsgThinking(idx) {
  const msg = messages.value[idx]
  if (msg) msg._thinkingExpanded = !msg._thinkingExpanded
}

function togglePlanDetail(msg, ti) {
  if (!msg._planExpanded) msg._planExpanded = {}
  msg._planExpanded[ti] = !msg._planExpanded[ti]
}

function badgeText(type) {
  const map = { thinking: '思考', tool_start: '工具', tool_end: '完成', plan: '规划' }
  return map[type] || type
}

function copyText(text) {
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制', icon: 'success' })
  })
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  const m = d.getMonth() + 1
  const day = d.getDate()
  return m + '/' + day
}

// ═══════ Markdown 渲染（轻量实现） ═══════

function renderMarkdown(text) {
  if (!text) return ''
  let html = text

  // 转义 HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // 代码块 ```...```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code.replace(/\n$/, '')
    return `<pre style="background:#f0f0f0;border-radius:8px;padding:10px;overflow-x:auto;font-size:12px;line-height:1.5;margin:8px 0"><code>${escaped}</code></pre>`
  })

  // 行内代码 `...`
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:13px">$1</code>')

  // 粗体 **...**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // 斜体 *...*
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // 链接 [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#409eff">$1</a>')

  // 标题 ### ...
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:600;margin:8px 0 4px">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:600;margin:10px 0 4px">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:600;margin:12px 0 4px">$1</h1>')

  // 无序列表
  html = html.replace(/^[*-] (.+)$/gm, '<li style="margin-left:16px;list-style-type:disc">$1</li>')

  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;list-style-type:decimal">$1</li>')

  // 换行
  html = html.replace(/\n\n/g, '<br><br>')
  html = html.replace(/\n/g, '<br>')

  return html
}

// ═══════ 会话管理 ═══════

function saveConvId(id, title) {
  if (id) {
    uni.setStorageSync('ai_current_conv_id', id)
    if (title) uni.setStorageSync('ai_current_conv_title', title)
  }
}

function loadSavedConv() {
  return {
    id: uni.getStorageSync('ai_current_conv_id') || null,
    title: uni.getStorageSync('ai_current_conv_title') || ''
  }
}

async function loadConversations() {
  try {
    const res = await getConversations(1, 30)
    if (res?.data?.items) {
      conversations.value = res.data.items
    }
  } catch (e) { /* ignore */ }
}

async function selectConversation(c) {
  showConvList.value = false
  convId.value = c.id
  currentConvTitle.value = c.title || ''
  saveConvId(c.id, c.title || '')
  messages.value = []
  hasMoreHistory.value = false

  try {
    const res = await getMessages(c.id, null, 50)
    if (res?.data?.items) {
      const items = res.data.items.reverse().map(m => ({
        role: m.role,
        content: m.content || '',
        references: m.references || [],
        thinkingSteps: (m.thinking_steps || []).map(ts => ({
          type: ts.type,
          content: ts.content,
          planSteps: ts.plan_steps || [],
        })),
        _thinkingExpanded: false
      }))
      messages.value = items
    }
    if (res?.data?.has_more) {
      hasMoreHistory.value = true
      msgBeforeId.value = res.data.items?.[0]?.id
    }
  } catch (e) {
    console.error('加载消息失败:', e)
  }
}

async function loadMoreHistory() {
  if (!convId.value || loadingHistory.value) return
  loadingHistory.value = true
  try {
    const res = await getMessages(convId.value, msgBeforeId.value, 50)
    if (res?.data?.items) {
      const newMsgs = res.data.items.reverse().map(m => ({
        role: m.role,
        content: m.content || '',
        references: m.references || [],
        thinkingSteps: (m.thinking_steps || []).map(ts => ({
          type: ts.type,
          content: ts.content,
          planSteps: ts.plan_steps || [],
        })),
        _thinkingExpanded: false
      }))
      messages.value = [...newMsgs, ...messages.value]
      if (res.data.items.length > 0) {
        msgBeforeId.value = res.data.items[0]?.id
      }
    }
    hasMoreHistory.value = res?.data?.has_more || false
  } catch (e) {
    console.error('加载历史失败:', e)
  } finally {
    loadingHistory.value = false
  }
}

function newConversation() {
  convId.value = null
  currentConvTitle.value = ''
  messages.value = []
  streamContent.value = ''
  thinkingSteps.value = []
  inputText.value = ''
  saveConvId(null, '')
}

async function onDeleteConv(c) {
  const res = await new Promise((resolve) => {
    uni.showModal({
      title: '删除对话',
      content: '确认删除该对话？',
      success: (r) => resolve(r.confirm)
    })
  })
  if (!res) return
  try {
    await deleteConversation(c.id)
    conversations.value = conversations.value.filter(x => x.id !== c.id)
    if (convId.value === c.id) {
      newConversation()
    }
  } catch (e) {
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

// ═══════ 发送消息 ═══════

async function send() {
  if (!inputText.value.trim() || streaming.value) return
  if (!getToken()) {
    redirectToLogin()
    return
  }

  const q = inputText.value
  inputText.value = ''
  streaming.value = true
  streamContent.value = ''
  refs.value = []
  thinkingText.value = ''
  thinkingSteps.value = []
  planSteps.value = []
  messages.value.push({ role: 'user', content: q, references: [] })

  await streamChat(
    { query: q, conversation_id: convId.value || undefined },
    {
      onThinking: (content) => {
        thinkingText.value += content
        scrollToId.value = 'streaming-msg'
      },
      onPlan: (summary, steps) => {
        planSteps.value = steps
        thinkingSteps.value.push({
          type: 'plan',
          content: summary,
          planSteps: steps,
          timestamp: 0
        })
        scrollToId.value = 'streaming-msg'
      },
      onToolStart: (name) => {
        thinkingSteps.value.push({
          type: 'tool_start',
          content: `调用 ${name}`,
          toolName: name,
          timestamp: 0
        })
        scrollToId.value = 'streaming-msg'
      },
      onToolEnd: (name, summary) => {
        thinkingSteps.value.push({
          type: 'tool_end',
          content: `${name}: ${summary}`,
          toolName: name,
          timestamp: 0
        })
        scrollToId.value = 'streaming-msg'
      },
      onToolError: (name, errorMsg) => {
        thinkingSteps.value.push({
          type: 'tool_end',
          content: `${name} 失败: ${errorMsg}`,
          toolName: name,
          timestamp: 0
        })
        scrollToId.value = 'streaming-msg'
      },
      onChunk: (c) => {
        streamContent.value += c
        scrollToId.value = 'streaming-msg'
      },
      onReference: (r) => { refs.value.push(...(Array.isArray(r) ? r : [r])) },
      onDone: (data) => {
        const content = data.full_content || streamContent.value
        const ts = data.thinking_steps?.length
          ? data.thinking_steps.map(s => ({
              type: s.type,
              content: s.content,
              planSteps: s.plan_steps || [],
            }))
          : (thinkingSteps.value.length ? [...thinkingSteps.value] : [])
        messages.value.push({
          role: 'assistant',
          content,
          references: refs.value.length ? [...refs.value] : [],
          thinkingSteps: ts,
          _thinkingExpanded: false
        })
        if (data.conversation_id) {
          convId.value = data.conversation_id
          const title = data.conversation_title || ''
          currentConvTitle.value = title
          saveConvId(data.conversation_id, title)
          // 刷新会话列表
          loadConversations()
        }
        streaming.value = false
        streamContent.value = ''
        thinkingSteps.value = []
        thinkingText.value = ''
        planSteps.value = []
        scrollToId.value = 'msg-' + (messages.value.length - 1)
      },
      onError: (err) => {
        const ts = thinkingSteps.value.length ? [...thinkingSteps.value] : []
        messages.value.push({
          role: 'assistant',
          content: '错误: ' + err,
          references: [],
          thinkingSteps: ts,
          _thinkingExpanded: false
        })
        streaming.value = false
        thinkingSteps.value = []
        thinkingText.value = ''
        planSteps.value = []
      },
      onTokenExpired: async (msg) => {
        const newToken = await tryRefreshToken()
        if (newToken) {
          uni.showToast({ title: '令牌已刷新，请重试', icon: 'none' })
        } else {
          uni.showToast({ title: msg, icon: 'none' })
          redirectToLogin()
        }
        const ts = thinkingSteps.value.length ? [...thinkingSteps.value] : []
        messages.value.push({
          role: 'assistant',
          content: msg,
          references: [],
          thinkingSteps: ts,
          _thinkingExpanded: false
        })
        streaming.value = false
        thinkingSteps.value = []
      }
    }
  )
}

// ═══════ 初始化 ═══════

onMounted(() => {
  if (!getToken()) {
    redirectToLogin()
    return
  }
  const saved = loadSavedConv()
  if (saved.id) {
    convId.value = saved.id
    currentConvTitle.value = saved.title || ''
    // 加载历史消息
    selectConversation({ id: saved.id, title: saved.title })
  }
  loadConversations()
})
</script>

<style>
.ai-chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-page);
}

/* 顶部栏 */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--status-bar-height) + 8px) 12px 8px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-default);
  box-shadow: var(--shadow-sm);
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-btn {
  font-size: 20px;
  padding: 4px;
  color: var(--color-primary);
  cursor: pointer;
}
.header-btn:active {
  opacity: 0.6;
}
.header-right {
  display: flex;
  align-items: center;
}

/* 会话列表抽屉 */
.conv-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
}
.conv-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
}
.conv-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--status-bar-height) + 12px) 16px 12px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-input);
}
.conv-panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.conv-panel-close {
  font-size: 18px;
  padding: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
}
.conv-panel-close:active {
  opacity: 0.6;
}
.conv-list {
  flex: 1;
  padding: 8px 0;
}
.conv-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
}
.conv-item:active,
.conv-item.active {
  background: var(--bg-hover);
}
.conv-item-main {
  flex: 1;
  min-width: 0;
}
.conv-item-title {
  font-size: 14px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  font-weight: 500;
}
.conv-item-time {
  font-size: 11px;
  color: var(--text-tertiary);
}
.conv-item-del {
  font-size: 16px;
  padding: 4px;
  margin-left: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
}
.conv-item-del:active {
  color: var(--color-danger);
}
.conv-empty {
  text-align: center;
  color: var(--text-tertiary);
  padding: 40px 0;
  font-size: 14px;
}

/* 消息列表 */
.msg-list {
  flex: 1;
  padding: 12px;
}
.load-more {
  text-align: center;
  padding: 8px 0;
}
.load-more-btn {
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.load-more-btn:active {
  opacity: 0.7;
}
.load-more-text {
  color: var(--text-tertiary);
  font-size: 13px;
}
.msg-item {
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  max-width: 85%;
}
.msg-item.user {
  background: var(--color-gradient);
  color: #fff;
  margin-left: auto;
  box-shadow: var(--shadow-sm);
}
.msg-item.assistant {
  background: var(--bg-card);
  margin-right: auto;
  box-shadow: var(--shadow-sm);
}
.msg-text {
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
}
.streaming-cursor {
  color: var(--color-primary);
  animation: blink 1s step-end infinite;
  font-size: 15px;
  font-weight: bold;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.msg-actions {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
}
.msg-action-btn {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 2px 6px;
  cursor: pointer;
}
.msg-action-btn:active {
  color: var(--color-primary);
}

/* 思考面板 */
.thinking-panel {
  margin-bottom: 8px;
  background: linear-gradient(135deg, #eff6ff, #f0f5ff);
  border: 1px solid #bfdbfe;
  border-radius: var(--radius-md);
  font-size: 13px;
}
.thinking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  cursor: pointer;
  color: var(--color-primary);
  font-weight: 600;
}
.thinking-header:active {
  background: var(--bg-hover);
}
.toggle-icon {
  font-size: 11px;
  color: var(--text-tertiary);
  transition: transform 0.2s;
}
.toggle-icon.expanded {
  transform: rotate(180deg);
}
.thinking-body {
  padding: 4px 10px 8px;
  border-top: 1px solid #bfdbfe;
}
.step-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 0;
  color: var(--text-secondary);
}
.step-badge {
  font-size: 11px;
  padding: 0 4px;
  border-radius: 3px;
  color: #fff;
  min-width: 32px;
  text-align: center;
  line-height: 18px;
  flex-shrink: 0;
}
.step-badge.thinking { background: var(--text-tertiary); }
.step-badge.tool_start { background: var(--color-warning); }
.step-badge.tool_end { background: var(--color-success); }
.step-badge.plan { background: var(--color-primary); }
.step-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}

/* Plan详情 */
.plan-content { flex: 1; min-width: 0; }
.plan-header {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--color-primary);
  font-weight: 500;
}
.plan-header:active { color: var(--color-primary-dark); }
.plan-toggle {
  font-size: 11px;
  color: var(--text-tertiary);
  transition: transform 0.2s;
  flex-shrink: 0;
}
.plan-toggle.expanded { transform: rotate(180deg); }
.plan-detail {
  margin-top: 4px;
  padding: 6px 8px;
  background: var(--bg-input);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
}
.plan-step-row {
  display: flex;
  gap: 6px;
  padding: 3px 0;
  font-size: 12px;
  line-height: 1.5;
}
.plan-step-row + .plan-step-row {
  border-top: 1px dashed var(--border-default);
  margin-top: 2px;
  padding-top: 5px;
}
.ps-num { color: var(--color-primary); font-weight: 600; min-width: 20px; flex-shrink: 0; }
.ps-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.ps-action {
  color: var(--text-primary);
  font-weight: 500;
  font-family: monospace;
  font-size: 12px;
}
.ps-tool {
  color: var(--text-tertiary);
  font-size: 11px;
  font-family: monospace;
}
.ps-params {
  background: var(--bg-input);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  color: var(--text-secondary);
  word-break: break-all;
  font-family: monospace;
}

/* 引用 */
.ref-box {
  margin-top: 8px;
  padding: 8px;
  background: var(--bg-input);
  border-radius: var(--radius-sm);
}
.ref-title { font-size: 12px; color: var(--text-tertiary); }
.ref-item { display: flex; gap: 4px; margin-top: 2px; }
.ref-doc { font-size: 12px; color: var(--text-secondary); }
.ref-score { font-size: 11px; color: var(--color-success); }

/* 输入栏 */
.input-bar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-card);
  border-top: 1px solid var(--border-default);
  align-items: center;
}
.input-bar input {
  flex: 1;
  height: 38px;
  padding: 0 14px;
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-full);
  font-size: 14px;
  background: var(--bg-input);
  color: var(--text-primary);
}
</style>
