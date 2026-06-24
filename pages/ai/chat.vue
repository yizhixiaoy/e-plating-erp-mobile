<template>
  <view class="ai-chat-page">
    <!-- 消息列表 -->
    <scroll-view class="msg-list" scroll-y :scroll-into-view="scrollToId">
      <view v-for="(msg, i) in messages" :key="i" :id="'msg-' + i" :class="['msg-item', msg.role]">
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
        <text class="msg-text">{{ msg.content }}</text>
        <view v-if="msg.references && msg.references.length" class="ref-box">
          <text class="ref-title">引用来源：</text>
          <view v-for="(r, j) in msg.references" :key="j" class="ref-item">
            <text class="ref-doc">{{ r.doc_title }}</text>
            <text v-if="r.similarity" class="ref-score">({{ (r.similarity * 100).toFixed(0) }}%)</text>
          </view>
        </view>
      </view>
      <view v-if="streaming" class="msg-item assistant">
        <text class="msg-text">{{ streamContent }}</text>
      </view>
    </scroll-view>

    <!-- 输入区 -->
    <view class="input-bar">
      <input v-model="inputText" placeholder="输入问题..." confirm-type="send" @confirm="send" />
      <button size="mini" type="primary" :disabled="!inputText.trim() || streaming" @tap="send">发送</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { streamChat } from '@/utils/ai-chat.js'

const messages = ref([])
const inputText = ref('')
const streaming = ref(false)
const streamContent = ref('')
const scrollToId = ref('')
const convId = ref(null)
const refs = ref([])

// 流式中的中间状态
const thinkingText = ref('')        // 当前思考文本
const thinkingSteps = ref([])         // 当前thinking步骤列表
const planSteps = ref([])             // 当前plan步骤
const showThinkDetail = ref(false)    // 思考面板展开

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

async function send() {
  if (!inputText.value.trim() || streaming.value) return
  const q = inputText.value
  inputText.value = ''
  streaming.value = true
  streamContent.value = ''
  refs.value = []
  thinkingText.value = ''
  thinkingSteps.value = []
  planSteps.value = []
  showThinkDetail.value = true
  messages.value.push({ role: 'user', content: q, references: [] })

  await streamChat(q, convId.value, {
    onThinking: (content) => {
      thinkingText.value += content
      showThinkDetail.value = true
      scrollToId.value = 'msg-' + (messages.value.length)
    },
    onPlan: (summary, steps) => {
      planSteps.value = steps
      thinkingSteps.value.push({
        type: 'plan',
        content: summary,
        planSteps: steps,
        timestamp: 0
      })
      showThinkDetail.value = true
      scrollToId.value = 'msg-' + (messages.value.length)
    },
    onToolStart: (name) => {
      thinkingSteps.value.push({
        type: 'tool_start',
        content: `调用 ${name}`,
        toolName: name,
        timestamp: 0
      })
      scrollToId.value = 'msg-' + (messages.value.length)
    },
    onToolEnd: (name, summary) => {
      thinkingSteps.value.push({
        type: 'tool_end',
        content: `${name}: ${summary}`,
        toolName: name,
        timestamp: 0
      })
      scrollToId.value = 'msg-' + (messages.value.length)
    },
    onToolError: (name, errorMsg) => {
      thinkingSteps.value.push({
        type: 'tool_end',
        content: `${name} 失败: ${errorMsg}`,
        toolName: name,
        timestamp: 0
      })
      scrollToId.value = 'msg-' + (messages.value.length)
    },
    onChunk: (c) => {
      streamContent.value += c
      scrollToId.value = 'msg-' + (messages.value.length)
    },
    onReference: (r) => { refs.value.push(...r) },
    onDone: (data) => {
      const content = data.full_content || streamContent.value
      const ts = data.thinking_steps?.length ? data.thinking_steps : (thinkingSteps.value.length ? [...thinkingSteps.value] : [])
      messages.value.push({
        role: 'assistant',
        content,
        references: refs.value,
        thinkingSteps: ts,
        _thinkingExpanded: false  // 历史消息默认收起
      })
      if (data.conversation_id) convId.value = data.conversation_id
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
    }
  })
}
</script>

<style>
.ai-chat-page { display: flex; flex-direction: column; height: 100vh; background: #f5f5f5; }
.msg-list { flex: 1; padding: 12px; }
.msg-item { margin-bottom: 12px; padding: 10px 14px; border-radius: 12px; max-width: 80%; }
.msg-item.user { background: #007aff; color: #fff; margin-left: auto; }
.msg-item.assistant { background: #fff; }
.msg-text { font-size: 15px; line-height: 1.6; }

/* 思考面板 */
.thinking-panel { margin-bottom: 8px; background: #f0f5ff; border: 1px solid #d6e4ff; border-radius: 8px; font-size: 13px; }
.thinking-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px; cursor: pointer; color: #409eff; font-weight: 500;
}
.thinking-header:active { background: #e6f0ff; }
.toggle-icon { font-size: 11px; color: #909399; transition: transform 0.2s; }
.toggle-icon.expanded { transform: rotate(180deg); }
.thinking-body { padding: 4px 10px 8px; border-top: 1px solid #d6e4ff; }
.step-item { display: flex; align-items: flex-start; gap: 6px; padding: 3px 0; color: #606266; }
.step-badge {
  font-size: 11px; padding: 0 4px; border-radius: 3px; color: #fff;
  min-width: 32px; text-align: center; line-height: 18px; flex-shrink: 0;
}
.step-badge.thinking { background: #909399; }
.step-badge.tool_start { background: #e6a23c; }
.step-badge.tool_end { background: #67c23a; }
.step-badge.plan { background: #409eff; }
.step-text { flex: 1; min-width: 0; font-size: 13px; line-height: 1.5; }

/* Plan详情 */
.plan-content { flex: 1; min-width: 0; }
.plan-header {
  display: flex; align-items: center; gap: 4px; cursor: pointer;
  color: #409eff; font-weight: 500;
}
.plan-header:active { color: #337ecc; }
.plan-toggle { font-size: 11px; color: #909399; transition: transform 0.2s; flex-shrink: 0; }
.plan-toggle.expanded { transform: rotate(180deg); }
.plan-detail {
  margin-top: 4px; padding: 6px 8px; background: #f5f7fa;
  border-radius: 6px; border: 1px solid #e4e7ed;
}
.plan-step-row {
  display: flex; gap: 6px; padding: 3px 0; font-size: 12px; line-height: 1.5;
}
.plan-step-row + .plan-step-row {
  border-top: 1px dashed #e4e7ed; margin-top: 2px; padding-top: 5px;
}
.ps-num { color: #409eff; font-weight: 600; min-width: 20px; flex-shrink: 0; }
.ps-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.ps-action {
  color: #303133; font-weight: 500;
  font-family: 'Courier New', 'SF Mono', 'Fira Code', monospace; font-size: 12px;
}
.ps-tool {
  color: #909399; font-size: 11px;
  font-family: 'Courier New', 'SF Mono', 'Fira Code', monospace;
}
.ps-params {
  background: #ebeef5; padding: 1px 6px; border-radius: 3px;
  font-size: 11px; color: #606266; word-break: break-all;
  font-family: 'Courier New', 'SF Mono', 'Fira Code', monospace;
}

.ref-box { margin-top: 8px; padding: 8px; background: #f0f0f0; border-radius: 6px; }
.ref-title { font-size: 12px; color: #999; }
.ref-item { display: flex; gap: 4px; margin-top: 2px; }
.ref-doc { font-size: 12px; color: #666; }
.ref-score { font-size: 11px; color: #4cd964; }
.input-bar { display: flex; gap: 8px; padding: 8px 12px; background: #fff; border-top: 1px solid #e5e5e5; }
.input-bar input { flex: 1; height: 36px; padding: 0 12px; border: 1px solid #ddd; border-radius: 18px; font-size: 14px; }
</style>
