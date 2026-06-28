<template>
  <view class="ai-writer-page">
    <!-- 顶部模板选择 -->
    <scroll-view class="template-bar" scroll-x>
      <view
        v-for="tpl in templates"
        :key="tpl.type"
        :class="['tpl-chip', { active: selectedTemplate === tpl.type }]"
        @tap="selectTemplate(tpl.type)"
      >
        <text class="tpl-icon">{{ tpl.icon }}</text>
        <text class="tpl-name">{{ tpl.name }}</text>
      </view>
    </scroll-view>

    <!-- 输入区 -->
    <view class="input-section">
      <textarea
        v-model="topic"
        :placeholder="topicPlaceholder"
        class="topic-input"
        :maxlength="200"
      />
      <view class="config-row">
        <view class="config-item">
          <text class="config-label">风格</text>
          <view class="style-tabs">
            <text
              v-for="s in styles"
              :key="s.value"
              :class="['style-tab', { active: style === s.value }]"
              @tap="style = s.value"
            >{{ s.label }}</text>
          </view>
        </view>
        <view class="config-item">
          <text class="config-label">字数</text>
          <input v-model.number="wordCount" type="number" class="count-input" />
        </view>
      </view>
    </view>

    <!-- 生成按钮 -->
    <view class="action-bar">
      <button
        class="generate-btn"
        :disabled="!topic.trim() || generating"
        @tap="startWrite"
      >{{ generating ? '生成中...' : '开始写作' }}</button>
    </view>

    <!-- 大纲 -->
    <view v-if="outline" class="outline-box">
      <text class="box-title">写作大纲</text>
      <text class="outline-text">{{ outline }}</text>
    </view>

    <!-- 结果区 -->
    <scroll-view class="result-area" scroll-y v-if="resultContent || generating">
      <view class="result-content">
        <text class="result-text">{{ resultContent }}</text>
        <text v-if="generating" class="cursor">|</text>
      </view>
    </scroll-view>

    <!-- 操作按钮 -->
    <view v-if="resultContent && !generating" class="result-actions">
      <button size="mini" @tap="copyResult">复制全文</button>
    </view>

    <!-- 空状态 -->
    <view v-if="!resultContent && !generating" class="empty-state">
      <text class="empty-icon">📝</text>
      <text class="empty-text">选择写作类型，输入主题后开始</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import config from '../../config/api.js'
import { getToken, redirectToLogin, tryRefreshToken } from '../../utils/auth.js'
import { getWriteTemplates } from '../../utils/ai-chat.js'

// 默认模板（API 获取失败时的兜底）
const DEFAULT_TEMPLATES = [
  { type: 'report', name: '工作报告', icon: '📊' },
  { type: 'notice', name: '通知公告', icon: '📢' },
  { type: 'summary', name: '工作总结', icon: '📝' },
  { type: 'contract', name: '合同草稿', icon: '📋' },
  { type: 'custom', name: '自定义', icon: '✏️' },
]

const styles = [
  { value: 'formal', label: '正式' },
  { value: 'concise', label: '简洁' },
  { value: 'detailed', label: '详细' },
]

const templates = ref([...DEFAULT_TEMPLATES])
const selectedTemplate = ref('')
const style = ref('formal')
const wordCount = ref(500)
const topic = ref('')
const generating = ref(false)
const outline = ref('')
const resultContent = ref('')

const topicPlaceholder = computed(() => {
  const map = {
    report: '请输入报告主题...',
    notice: '请输入通知标题和要点...',
    summary: '请输入总结主题...',
    contract: '请输入合同类型和关键条款...',
    custom: '请输入您需要撰写的文档主题...',
  }
  return map[selectedTemplate.value] || '请先选择写作类型'
})

function getAiUrl(path) {
  return config.apiBase.replace(/\/api\/v1$/, '') + path
}

function selectTemplate(type) {
  selectedTemplate.value = type
}

// 加载模板列表
onMounted(async () => {
  try {
    const data = await getWriteTemplates()
    if (data && Array.isArray(data) && data.length > 0) {
      templates.value = data
    }
  } catch (_) {
    // 网络失败时使用默认模板
  }
})

// 解析 SSE 流
function parseSseStream(text, onEvent) {
  const lines = text.split('\n')
  let currentEvent = ''
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim()
    } else if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6))
        onEvent(currentEvent, data)
      } catch (_) { /* ignore */ }
    }
  }
}

// 开始写作（H5 使用 fetch ReadableStream 真流式）
async function startWrite() {
  if (!topic.value.trim() || generating.value) return
  if (!getToken()) {
    redirectToLogin()
    return
  }

  generating.value = true
  resultContent.value = ''
  outline.value = ''

  const token = getToken() || ''

  // #ifdef H5
  try {
    const response = await fetch(getAiUrl('/api/ai/write'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        template_type: selectedTemplate.value,
        topic: topic.value,
        style: style.value,
        word_count: wordCount.value,
      })
    })

    if (!response.ok) {
      if (response.status === 401) {
        await handleTokenExpired()
        return
      }
      uni.showToast({ title: `请求失败(${response.status})`, icon: 'none' })
      generating.value = false
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              switch (currentEvent) {
                case 'outline':
                  outline.value += data.content
                  break
                case 'chunk':
                  resultContent.value += data.content
                  break
                case 'done':
                  resultContent.value = data.full_content || resultContent.value
                  generating.value = false
                  break
                case 'token_expired':
                  await handleTokenExpired()
                  return
                case 'error':
                  uni.showToast({ title: data.message, icon: 'none' })
                  generating.value = false
                  break
              }
            } catch (_) { /* ignore */ }
          }
        }
      }
    } catch (e) {
      console.warn('SSE stream error:', e)
      uni.showToast({ title: '连接异常', icon: 'none' })
      generating.value = false
    }
  } catch (e) {
    uni.showToast({ title: '请求失败', icon: 'none' })
    generating.value = false
  }
  // #endif

  // #ifndef H5
  uni.request({
    url: getAiUrl('/api/ai/write'),
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    data: {
      template_type: selectedTemplate.value,
      topic: topic.value,
      style: style.value,
      word_count: wordCount.value,
    },
    responseType: 'text',
    enableChunked: true,
    success: (res) => {
      let currentEvent = ''
      parseSseStream(res.data || '', (event, data) => {
        switch (event) {
          case 'outline': outline.value += data.content; break
          case 'chunk': resultContent.value += data.content; break
          case 'done':
            resultContent.value = data.full_content || resultContent.value
            generating.value = false
            break
          case 'token_expired':
            handleTokenExpired()
            break
          case 'error':
            uni.showToast({ title: data.message, icon: 'none' })
            generating.value = false
            break
        }
      })
    },
    fail: () => {
      uni.showToast({ title: '请求失败', icon: 'none' })
      generating.value = false
    }
  })
  // #endif
}

async function handleTokenExpired() {
  const newToken = await tryRefreshToken()
  if (newToken) {
    uni.showToast({ title: '令牌已刷新，请重新发送', icon: 'none' })
  } else {
    uni.showToast({ title: '认证已过期，请重新登录', icon: 'none' })
    redirectToLogin()
  }
  generating.value = false
}

function copyResult() {
  uni.setClipboardData({
    data: resultContent.value,
    success: () => uni.showToast({ title: '已复制', icon: 'success' })
  })
}
</script>

<style>
.ai-writer-page { display: flex; flex-direction: column; height: 100%; background: #f5f5f5; }
.template-bar { white-space: nowrap; padding: 12px; background: #fff; }
.tpl-chip {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  margin-right: 10px;
  border-radius: 12px;
  background: #f5f7fa;
  border: 1px solid #e5e5e5;
}
.tpl-chip.active { background: #ecf5ff; border-color: #409eff; }
.tpl-icon { font-size: 20px; }
.tpl-name { font-size: 12px; color: #666; }

.input-section { padding: 12px; background: #fff; margin-top: 8px; }
.topic-input {
  width: 100%;
  height: 80px;
  padding: 10px 12px;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}
.config-row { display: flex; gap: 20px; margin-top: 10px; }
.config-item { flex: 1; }
.config-label { font-size: 12px; color: #999; margin-bottom: 4px; display: block; }
.style-tabs { display: flex; gap: 6px; }
.style-tab { padding: 4px 12px; border-radius: 14px; background: #f0f0f0; font-size: 13px; }
.style-tab.active { background: #409eff; color: #fff; }
.count-input { width: 80px; height: 28px; border: 1px solid #e5e5e5; border-radius: 6px; text-align: center; font-size: 13px; }

.action-bar { padding: 12px; }
.generate-btn {
  width: 100%;
  height: 42px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
}
.generate-btn[disabled] { opacity: 0.5; }

.outline-box { margin: 0 12px 8px; padding: 12px; background: #f0f5ff; border-radius: 8px; }
.box-title { font-size: 13px; font-weight: 600; color: #409eff; margin-bottom: 4px; display: block; }
.outline-text { font-size: 13px; color: #666; line-height: 1.6; }

.result-area { flex: 1; padding: 12px; }
.result-content { background: #fff; padding: 14px; border-radius: 8px; }
.result-text { font-size: 15px; line-height: 1.8; white-space: pre-wrap; word-break: break-word; }
.cursor { color: #409eff; animation: blink 1s step-end infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.result-actions { padding: 8px 12px; display: flex; justify-content: flex-end; }

.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; }
.empty-icon { font-size: 48px; }
.empty-text { font-size: 14px; color: #999; margin-top: 12px; }
</style>
