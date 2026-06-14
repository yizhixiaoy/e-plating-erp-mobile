<template>
  <view class="ai-chat-page">
    <!-- 消息列表 -->
    <scroll-view class="msg-list" scroll-y :scroll-into-view="scrollToId">
      <view v-for="(msg, i) in messages" :key="i" :id="'msg-' + i" :class="['msg-item', msg.role]">
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

async function send() {
  if (!inputText.value.trim() || streaming.value) return
  const q = inputText.value
  inputText.value = ''
  streaming.value = true
  streamContent.value = ''
  refs.value = []
  messages.value.push({ role: 'user', content: q, references: [] })

  await streamChat(q, convId.value, {
    onThinking: () => {},
    onChunk: (c) => {
      streamContent.value += c
      scrollToId.value = 'msg-' + (messages.value.length)
    },
    onReference: (r) => { refs.value.push(...r) },
    onDone: (data) => {
      messages.value.push({ role: 'assistant', content: data.full_content || streamContent.value, references: refs.value })
      if (data.conversation_id) convId.value = data.conversation_id
      streaming.value = false
      streamContent.value = ''
      scrollToId.value = 'msg-' + (messages.value.length - 1)
    },
    onError: (err) => {
      messages.value.push({ role: 'assistant', content: '错误: ' + err, references: [] })
      streaming.value = false
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
.ref-box { margin-top: 8px; padding: 8px; background: #f0f0f0; border-radius: 6px; }
.ref-title { font-size: 12px; color: #999; }
.ref-item { display: flex; gap: 4px; margin-top: 2px; }
.ref-doc { font-size: 12px; color: #666; }
.ref-score { font-size: 11px; color: #4cd964; }
.input-bar { display: flex; gap: 8px; padding: 8px 12px; background: #fff; border-top: 1px solid #e5e5e5; }
.input-bar input { flex: 1; height: 36px; padding: 0 12px; border: 1px solid #ddd; border-radius: 18px; font-size: 14px; }
</style>
