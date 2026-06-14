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
            <text class="doc-name">{{ doc.filename }}</text>
            <text class="doc-meta">{{ doc.chunk_count || 0 }}片段 · {{ doc.parse_status === 'completed' ? '已完成' : '解析中' }}</text>
          </view>
        </view>
        <button size="mini" class="doc-delete" @tap="deleteDoc(doc)">删除</button>
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

const kbList = ref([])
const currentKb = ref(null)
const docList = ref([])
const loading = ref(false)

onMounted(() => loadKbList())

async function getHeaders() {
  const { getToken } = await import('@/utils/auth.js')
  return { Authorization: `Bearer ${getToken() || ''}` }
}

async function loadKbList() {
  try {
    const headers = await getHeaders()
    const [err, res] = await uni.request({
      url: '/api/ai/knowledge?page_num=1&page_size=100',
      header: headers,
    })
    if (!err && res.statusCode === 200) {
      kbList.value = res.data.items || []
    }
  } catch (e) { /* ignore */ }
}

async function selectKb(kb) {
  currentKb.value = kb
  await loadDocuments()
}

async function loadDocuments() {
  if (!currentKb.value) return
  try {
    const headers = await getHeaders()
    const [err, res] = await uni.request({
      url: `/api/ai/knowledge/${currentKb.value.id}/documents?page_num=1&page_size=50`,
      header: headers,
    })
    if (!err && res.statusCode === 200) {
      docList.value = res.data.items || []
    }
  } catch (e) { /* ignore */ }
}

async function deleteDoc(doc) {
  const { value } = await uni.showModal({
    title: '确认删除',
    content: `确定删除「${doc.filename}」？`,
  })
  if (!value) return

  try {
    const headers = await getHeaders()
    await uni.request({
      url: `/api/ai/knowledge/${currentKb.value.id}/documents/${doc.id}`,
      method: 'DELETE',
      header: headers,
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
    extension: ['pdf', 'docx', 'xlsx', 'txt', 'md'],
    success: async (res) => {
      for (const file of res.tempFiles) {
        await uploadFile(file.path, file.name)
      }
      loadDocuments()
      loadKbList()
    },
  })
}

function uploadFile(filePath, fileName) {
  return new Promise(async (resolve, reject) => {
    loading.value = true
    const headers = await getHeaders()

    uni.uploadFile({
      url: `/api/ai/knowledge/${currentKb.value.id}/documents`,
      filePath,
      name: 'file',
      header: headers,
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
</script>

<style>
.ai-kb-page { display: flex; flex-direction: column; height: 100vh; background: #f5f5f5; }
.kb-list-section { background: #fff; padding: 8px 0; }
.kb-scroll { white-space: nowrap; }
.kb-tabs { display: inline-flex; gap: 8px; padding: 0 12px; }
.kb-tab {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  background: #f5f7fa;
  border: 1px solid #e5e5e5;
  min-width: 72px;
}
.kb-tab.active { background: #ecf5ff; border-color: #409eff; }
.kb-tab-name { font-size: 13px; font-weight: 500; }
.kb-tab-count { font-size: 11px; color: #999; }

.doc-list { flex: 1; padding: 8px 12px; }
.doc-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 8px;
}
.doc-info { display: flex; align-items: center; gap: 10px; flex: 1; overflow: hidden; }
.doc-icon { font-size: 24px; }
.doc-text { flex: 1; overflow: hidden; }
.doc-name { font-size: 14px; font-weight: 500; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-meta { font-size: 12px; color: #999; }
.doc-delete { background: none; color: #f56c6c; font-size: 12px; border: 1px solid #f56c6c; }

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  margin-top: 8px;
  border: 2px dashed #dcdfe6;
  border-radius: 12px;
  background: #fff;
}
.upload-icon { font-size: 32px; color: #c0c4cc; }
.upload-text { font-size: 14px; color: #606266; margin-top: 4px; }
.upload-hint { font-size: 12px; color: #c0c4cc; margin-top: 2px; }

.empty-kb { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.empty-icon { font-size: 48px; }
.empty-text { font-size: 14px; color: #999; margin-top: 12px; }

.loading-mask {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.loading-text { background: #fff; padding: 16px 24px; border-radius: 8px; font-size: 14px; }
</style>
