<template>
  <view class="ai-kb-page">
    <!-- 知识库列表 -->
    <view class="kb-list-section">
      <scroll-view class="kb-scroll" scroll-x>
        <view class="kb-tabs">
          <view
            v-for="kb in kbList"
            :key="kb.id"
            :class="['kb-tab', { active: currentKb?.id === kb.id }]"
            @tap="selectKb(kb)"
          >
            <text class="kb-tab-name">{{ kb.name }}</text>
            <text class="kb-tab-count">{{ kb.doc_count || 0 }}篇</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 文档列表 -->
    <scroll-view class="doc-list" scroll-y v-if="currentKb">
      <view v-for="doc in docList" :key="doc.id" class="doc-item">
        <view class="doc-info">
          <text class="doc-icon">📄</text>
          <view class="doc-text">
            <text class="doc-name">{{ doc.file_name || doc.title }}</text>
            <text class="doc-meta">{{ doc.chunk_count || 0 }}片段 · {{ doc.parse_status === 'completed' ? '已完成' : '解析中' }}</text>
          </view>
        </view>
        <view class="doc-actions">
          <button v-if="doc.file_url" size="mini" class="doc-preview" @tap="previewDoc(doc)">预览</button>
          <button size="mini" class="doc-delete" @tap="deleteDoc(doc)">删除</button>
        </view>
      </view>

      <!-- 上传按钮 -->
      <view class="upload-area" @tap="chooseFile">
        <text class="upload-icon">+</text>
        <text class="upload-text">上传文档</text>
        <text class="upload-hint">支持 PDF / Word / Excel / TXT</text>
      </view>
    </scroll-view>

    <!-- 未选中 -->
    <view v-else class="empty-kb">
      <text class="empty-icon">📚</text>
      <text class="empty-text">选择上方知识库查看文档</text>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-mask">
      <text class="loading-text">上传中...</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { request } from "../../utils/request.js"
import config from '../../config/api.js'
import { getToken } from "../../utils/auth.js"

// 文件校验常量（与 Web 端 upload.ts 一致）
const MAX_KB_FILE_SIZE = 50 * 1024 * 1024  // 50MB
const ALLOWED_EXTENSIONS = [
  'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx',
  'txt', 'md', 'csv', 'json', 'png', 'jpg', 'jpeg'
]

function getAiUrl(path) {
  return config.apiBase.replace(/\/api\/v1$/, '') + path
}

/** 校验文件类型和大小，返回 null 表示通过，否则返回错误信息 */
function validateFile(file) {
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `不支持的文件类型: .${ext}，允许: ${ALLOWED_EXTENSIONS.join(', ')}`
  }
  if (file.size > MAX_KB_FILE_SIZE) {
    const maxMB = (MAX_KB_FILE_SIZE / 1024 / 1024).toFixed(0)
    const fileMB = (file.size / 1024 / 1024).toFixed(1)
    return `${file.name} 大小 ${fileMB}MB 超过限制 (${maxMB}MB)`
  }
  return null
}

const kbList = ref([])
const currentKb = ref(null)
const docList = ref([])
const loading = ref(false)

onMounted(() => loadKbList())

async function loadKbList() {
  try {
    const res = await request({
      url: getAiUrl('/api/ai/knowledge?page_num=1&page_size=100'),
    })
    kbList.value = res.data?.items || []
  } catch (e) { /* ignore */ }
}

async function selectKb(kb) {
  currentKb.value = kb
  await loadDocuments()
}

async function loadDocuments() {
  if (!currentKb.value) return
  try {
    const res = await request({
      url: getAiUrl(`/api/ai/knowledge/${currentKb.value.id}/documents?page_num=1&page_size=50`),
    })
    docList.value = res.data?.items || []
  } catch (e) { /* ignore */ }
}

async function deleteDoc(doc) {
  const { value } = await uni.showModal({
    title: '确认删除',
    content: `确定删除「${doc.file_name || doc.title}」？`,
  })
  if (!value) return

  try {
    await request({
      url: getAiUrl(`/api/ai/knowledge/${currentKb.value.id}/documents/${doc.id}`),
      method: 'DELETE',
    })
    uni.showToast({ title: '已删除', icon: 'success' })
    loadDocuments()
    loadKbList()
  } catch (e) {
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}

function chooseFile() {
  uni.chooseFile({
    count: 5,
    type: 'file',
    extension: ALLOWED_EXTENSIONS,
    success: async (res) => {
      for (const file of res.tempFiles) {
        // 前端校验文件类型和大小（与 Web 端一致）
        const err = validateFile(file)
        if (err) {
          uni.showToast({ title: err, icon: 'none', duration: 3000 })
          continue
        }
        const result = await uploadFile(file.path, file.name)
        uni.showToast({ title: result?.message || '上传成功，正在解析中...', icon: 'none', duration: 2000 })
      }
      loadDocuments()
      loadKbList()
      // 后台解析中，定时刷新以更新解析状态
      setTimeout(() => loadDocuments(), 5000)
      setTimeout(() => loadDocuments(), 15000)
    },
  })
}

function uploadFile(filePath, fileName) {
  return new Promise(async (resolve, reject) => {
    loading.value = true
    const token = getToken() || ''

    uni.uploadFile({
      url: getAiUrl(`/api/ai/knowledge/${currentKb.value.id}/documents`),
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        try {
          const data = JSON.parse(res.data)
          resolve(data)
        } catch {
          reject(new Error('解析失败'))
        }
      },
      fail: (err) => {
        uni.showToast({ title: '上传失败', icon: 'none' })
        reject(err)
      },
      complete: () => {
        loading.value = false
      }
    })
  })
}

/** 将相对路径解析为完整后端URL（不暴露OSS直链，走后端重定向转发） */
function resolveFileUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  // /api/v1/files/preview?... → 拼接后端base URL（去掉config.apiBase中重复的/api/v1）
  const base = config.apiBase.replace(/\/api\/v1\/?$/, '')
  return base + url
}

/** 文档预览：根据文件类型选择预览方式 */
function previewDoc(doc) {
  if (!doc.file_url) return
  const previewType = doc.preview_type || 'none'
  const url = resolveFileUrl(doc.file_url)

  // 图片：使用原生图片预览
  if (previewType === 'image') {
    uni.previewImage({ urls: [url], current: url })
    return
  }

  // IMM文档预览（PDF/Office）或文本：在系统浏览器中打开
  // #ifdef APP-PLUS
  plus.runtime.openURL(url)
  // #endif
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
  // #ifdef MP-WEIXIN
  // 小程序不支持打开外部链接，复制到剪贴板
  uni.setClipboardData({
    data: url,
    success: () => uni.showToast({ title: '链接已复制，请在浏览器中打开', icon: 'none', duration: 3000 })
  })
  // #endif
}
</script>

<style>
.ai-kb-page { display: flex; flex-direction: column; height: 100%; background: var(--bg-page); }

.kb-list-section {
  background: var(--bg-card);
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
}

.kb-scroll { white-space: nowrap; }

.kb-tabs {
  display: inline-flex;
  gap: 8px;
  padding: 0 12px;
}

.kb-tab {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 16px;
  border-radius: var(--radius-lg);
  background: var(--bg-input);
  border: 1.5px solid transparent;
  min-width: 72px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.kb-tab:active {
  transform: scale(0.95);
}

.kb-tab.active {
  background: #eff6ff;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.kb-tab-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.kb-tab-count {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.doc-list { flex: 1; padding: 12px; }

.doc-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.doc-item:active {
  transform: scale(0.98);
}

.doc-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  overflow: hidden;
}

.doc-icon {
  font-size: 24px;
}

.doc-text { flex: 1; overflow: hidden; }

.doc-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-meta {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
  display: block;
}

.doc-delete {
  background: none;
  color: var(--color-danger);
  font-size: 13px;
  font-weight: 500;
  border: 1.5px solid var(--color-danger);
  border-radius: var(--radius-sm);
  padding: 4px 12px;
}

.doc-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.doc-preview {
  background: none;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  border: 1.5px solid var(--color-primary);
  border-radius: var(--radius-sm);
  padding: 4px 12px;
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  margin-top: 8px;
  border: 2px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.upload-area:active {
  background: var(--bg-hover);
  border-color: var(--color-primary);
}

.upload-icon { font-size: 32px; color: var(--text-tertiary); }
.upload-text { font-size: 14px; color: var(--text-secondary); margin-top: 4px; font-weight: 500; }
.upload-hint { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

.empty-kb {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon { font-size: 64px; animation: fadeIn 0.3s ease; }
.empty-text { font-size: 14px; color: var(--text-tertiary); margin-top: 12px; }

.loading-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-text {
  background: var(--bg-card);
  padding: 16px 24px;
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
}
</style>
