/**
 * AI聊天 API - 移动端 SSE 流式通信
 * 跨平台实现：
 * - H5：原生 fetch + ReadableStream 逐字流式
 * - App（非 H5）：uni.request + onChunkReceived 流式
 * - 会话管理接口：统一使用 uni.request（替代原生 fetch，确保跨平台可用）
 */
import config from '../config/api.js'
import { getToken, redirectToLogin, tryRefreshToken } from './auth.js'

/**
 * 构建 AI API 完整 URL
 * AI API 路径在 /api/ai 下，不同于业务 API 的 /api/v1 前缀
 */
function getAiUrl(path) {
  return config.apiBase.replace(/\/api\/v1$/, '') + path
}

// ==================== SSE 流式对话 ====================

/**
 * SSE 事件分发器
 */
function processSseEvent(currentEvent, data, callbacks) {
  switch (currentEvent) {
    case 'thinking':
      if (data.is_plan) {
        callbacks.onPlan?.(data.content, data.plan_steps)
      } else {
        callbacks.onThinking?.(data.content)
      }
      break
    case 'tool_start':
      callbacks.onToolStart?.(data.tool_name, data.tool_params, data.step_index)
      break
    case 'tool_end':
      callbacks.onToolEnd?.(data.tool_name, data.result_summary, data.step_index)
      break
    case 'tool_error':
      callbacks.onToolError?.(data.tool_name, data.error_msg, data.step_index)
      break
    case 'chunk':
      callbacks.onChunk?.(data.content)
      break
    case 'reference':
      callbacks.onReference?.(data)
      break
    case 'done':
      callbacks.onDone?.(data)
      break
    case 'error':
      callbacks.onError?.(data.message)
      break
    case 'token_expired':
      callbacks.onTokenExpired?.(data.message || '认证已过期，请重新登录')
      break
  }
}

/**
 * 解析 SSE 文本行并分发事件
 * currentEventRef: 跨 chunk 保持的当前事件类型引用
 */
function parseSseLines(lines, currentEventRef, callbacks) {
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEventRef.value = line.slice(7).trim()
    } else if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6))
        processSseEvent(currentEventRef.value, data, callbacks)
      } catch (e) {
        console.warn('SSE parse error:', e)
      }
    }
  }
}

/**
 * 将 ArrayBuffer 转为 UTF-8 字符串（onChunkReceived 回调返回 ArrayBuffer）
 */
function arrayBufferToString(buffer) {
  if (typeof buffer === 'string') return buffer
  if (buffer instanceof ArrayBuffer) {
    const uint8 = new Uint8Array(buffer)
    let result = ''
    for (let i = 0; i < uint8.length; i++) {
      result += String.fromCharCode(uint8[i])
    }
    try {
      return decodeURIComponent(escape(result))
    } catch (e) {
      return result
    }
  }
  return String(buffer)
}

/**
 * 流式 AI 对话（与 Web 端 chat.ts streamChat 保持一致）
 *
 * @param {object} request - { query, conversation_id?, kb_ids?, file_ids? }
 * @param {object} callbacks - { onThinking, onPlan, onToolStart, onToolEnd, onToolError, onChunk, onReference, onDone, onError, onTokenExpired }
 */
export async function streamChat(request, callbacks) {
  const token = getToken() || ''
  const requestBody = {
    query: request.query,
    conversation_id: request.conversation_id || undefined,
    kb_ids: request.kb_ids || undefined,
    file_ids: request.file_ids || undefined
  }

  // #ifdef H5
  // H5 模式：使用原生 fetch + ReadableStream 实现真正流式
  try {
    const response = await fetch(getAiUrl('/api/ai/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      let errMsg = `请求失败: ${response.status}`
      if (response.status === 401) {
        callbacks.onTokenExpired?.('认证已过期')
        return
      }
      try {
        const body = await response.json()
        if (body?.message) errMsg = body.message
      } catch (_) { /* ignore */ }
      callbacks.onError?.(errMsg)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const currentEventRef = { value: '' }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        parseSseLines(lines, currentEventRef, callbacks)
      }
      // 处理 buffer 中剩余内容
      if (buffer.trim()) {
        parseSseLines([buffer], currentEventRef, callbacks)
      }
    } catch (e) {
      console.warn('SSE stream read error:', e)
      callbacks.onError?.(`连接异常: ${e}`)
    }
  } catch (e) {
    callbacks.onError?.(e.message || '网络请求失败')
  }
  // #endif

  // #ifndef H5
  // 非 H5 模式（App/小程序）：使用 uni.request + onChunkReceived 实现流式
  const currentEventRef = { value: '' }
  let buffer = ''

  const requestTask = uni.request({
    url: getAiUrl('/api/ai/chat'),
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    data: requestBody,
    enableChunked: true,
    success: (res) => {
      // success 回调：如果 onChunkReceived 已处理完所有内容，此处仅做兜底
      if (res.statusCode === 401) {
        callbacks.onTokenExpired?.('认证已过期')
        return
      }
      if (res.statusCode >= 400) {
        let errMsg = `请求失败: ${res.statusCode}`
        try {
          const body = typeof res.data === 'object' ? res.data : JSON.parse(res.data)
          if (body?.message) errMsg = body.message
        } catch (_) { /* ignore */ }
        callbacks.onError?.(errMsg)
        return
      }
      // 兜底：如果 onChunkReceived 没触发（极端情况），在 success 中处理完整响应
      if (buffer.trim()) {
        const lines = buffer.split('\n')
        buffer = ''
        parseSseLines(lines, currentEventRef, callbacks)
      }
    },
    fail: (err) => callbacks.onError?.(err.errMsg || '请求失败')
  })

  // 流式 chunk 接收（App 平台支持）
  if (requestTask && typeof requestTask.onChunkReceived === 'function') {
    requestTask.onChunkReceived((res) => {
      const text = arrayBufferToString(res.data)
      buffer += text

      const lines = buffer.split('\n')
      // 保留最后一个可能不完整的行
      buffer = lines.pop() || ''

      parseSseLines(lines, currentEventRef, callbacks)
    })
  }
  // #endif
}

// ==================== 会话管理（跨平台 uni.request 实现） ====================

/**
 * 通用 uni.request Promise 封装（替代 fetch，确保 App 平台可用）
 */
function uniFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const token = getToken() || ''
    const header = Object.assign(
      { 'Authorization': `Bearer ${token}` },
      options.headers || {}
    )
    uni.request({
      url,
      method: options.method || 'GET',
      header,
      data: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, statusCode: res.statusCode, data: res.data, json: () => Promise.resolve(res.data) })
        } else if (res.statusCode === 401) {
          resolve({ ok: false, statusCode: 401, data: res.data })
        } else {
          resolve({ ok: false, statusCode: res.statusCode, data: res.data })
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * 获取会话列表
 */
export async function getConversations(pageNum = 1, pageSize = 20) {
  try {
    const resp = await uniFetch(getAiUrl(`/api/ai/conversations?page_num=${pageNum}&page_size=${pageSize}`))
    if (!resp.ok) throw new Error(`请求失败: ${resp.statusCode}`)
    return resp.data
  } catch (e) {
    console.error('获取会话列表失败:', e)
    return { code: -1, data: { items: [], total: 0 } }
  }
}

/**
 * 获取会话历史消息
 */
export async function getMessages(conversationId, beforeId, limit = 50) {
  try {
    const params = new URLSearchParams({ limit: String(limit) })
    if (beforeId) params.set('before_id', String(beforeId))
    const resp = await uniFetch(getAiUrl(`/api/ai/conversations/${conversationId}/messages?${params}`))
    if (!resp.ok) throw new Error(`请求失败: ${resp.statusCode}`)
    return resp.data
  } catch (e) {
    console.error('获取消息失败:', e)
    return { code: -1, data: { items: [] } }
  }
}

/**
 * 重命名会话
 */
export async function renameConversation(conversationId, title) {
  try {
    const resp = await uniFetch(getAiUrl(`/api/ai/conversations/${conversationId}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    })
    if (!resp.ok) throw new Error('重命名失败')
    return resp.data
  } catch (e) {
    console.error('重命名失败:', e)
    throw e
  }
}

/**
 * 删除会话
 */
export async function deleteConversation(conversationId) {
  try {
    const resp = await uniFetch(getAiUrl(`/api/ai/conversations/${conversationId}`), {
      method: 'DELETE'
    })
    if (!resp.ok) throw new Error('删除失败')
    return resp.data
  } catch (e) {
    console.error('删除会话失败:', e)
    throw e
  }
}

/**
 * 获取写作模板列表（从服务端获取，与 Web 端一致）
 */
export async function getWriteTemplates() {
  try {
    const resp = await uniFetch(getAiUrl('/api/ai/write/templates'))
    if (!resp.ok) throw new Error(`请求失败: ${resp.statusCode}`)
    return resp.data
  } catch (e) {
    console.error('获取写作模板失败:', e)
    return null
  }
}
/**
 * AI聊天 API - 移动端 SSE 流式通信
 * H5 模式：使用原生 fetch + ReadableStream 实现真正的逐字流式输出
 * 非 H5 模式（App/小程序）：使用 uni.request 兜底
 */
import config from '../config/api.js'
import { getToken, redirectToLogin, tryRefreshToken } from './auth.js'

/**
 * 构建 AI API 完整 URL
 * AI API 路径在 /api/ai 下，不同于业务 API 的 /api/v1 前缀
 */
function getAiUrl(path) {
  return config.apiBase.replace(/\/api\/v1$/, '') + path
}

// ==================== SSE 流式对话 ====================

/**
 * SSE 事件分发器
 */
function processSseEvent(currentEvent, data, callbacks) {
  switch (currentEvent) {
    case 'thinking':
      if (data.is_plan) {
        callbacks.onPlan?.(data.content, data.plan_steps)
      } else {
        callbacks.onThinking?.(data.content)
      }
      break
    case 'tool_start':
      callbacks.onToolStart?.(data.tool_name, data.tool_params, data.step_index)
      break
    case 'tool_end':
      callbacks.onToolEnd?.(data.tool_name, data.result_summary, data.step_index)
      break
    case 'tool_error':
      callbacks.onToolError?.(data.tool_name, data.error_msg, data.step_index)
      break
    case 'chunk':
      callbacks.onChunk?.(data.content)
      break
    case 'reference':
      callbacks.onReference?.(data)
      break
    case 'done':
      callbacks.onDone?.(data)
      break
    case 'error':
      callbacks.onError?.(data.message)
      break
    case 'token_expired':
      callbacks.onTokenExpired?.(data.message || '认证已过期，请重新登录')
      break
  }
}

/**
 * 解析 SSE 文本行并分发事件
 * currentEventRef: 跨 chunk 保持的当前事件类型引用
 */
function parseSseLines(lines, currentEventRef, callbacks) {
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEventRef.value = line.slice(7).trim()
    } else if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6))
        processSseEvent(currentEventRef.value, data, callbacks)
      } catch (e) {
        console.warn('SSE parse error:', e)
      }
    }
  }
}

/**
 * 流式 AI 对话（与 Web 端 chat.ts streamChat 保持一致）
 *
 * @param {object} request - { query, conversation_id?, kb_ids?, file_ids? }
 * @param {object} callbacks - { onThinking, onPlan, onToolStart, onToolEnd, onToolError, onChunk, onReference, onDone, onError, onTokenExpired }
 */
export async function streamChat(request, callbacks) {
  const token = getToken() || ''

  // #ifdef H5
  // H5 模式：使用原生 fetch + ReadableStream 实现真正流式
  try {
    const response = await fetch(getAiUrl('/api/ai/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: request.query,
        conversation_id: request.conversation_id || undefined,
        kb_ids: request.kb_ids || undefined,
        file_ids: request.file_ids || undefined
      })
    })

    if (!response.ok) {
      let errMsg = `请求失败: ${response.status}`
      if (response.status === 401) {
        callbacks.onTokenExpired?.('认证已过期')
        return
      }
      try {
        const body = await response.json()
        if (body?.message) errMsg = body.message
      } catch (_) { /* ignore */ }
      callbacks.onError?.(errMsg)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const currentEventRef = { value: '' }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        parseSseLines(lines, currentEventRef, callbacks)
      }
    } catch (e) {
      console.warn('SSE stream read error:', e)
      callbacks.onError?.(`连接异常: ${e}`)
    }
  } catch (e) {
    callbacks.onError?.(e.message || '网络请求失败')
  }
  // #endif

  // #ifndef H5
  // 非 H5 模式（App/小程序）：使用 uni.request 兜底
  uni.request({
    url: getAiUrl('/api/ai/chat'),
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    data: {
      query: request.query,
      conversation_id: request.conversation_id || undefined,
      kb_ids: request.kb_ids || undefined,
      file_ids: request.file_ids || undefined
    },
    responseType: 'text',
    enableChunked: true,
    success: (res) => {
      const text = res.data || ''
      const lines = text.split('\n')
      const currentEventRef = { value: '' }
      parseSseLines(lines, currentEventRef, callbacks)
    },
    fail: (err) => callbacks.onError?.(err.errMsg || '请求失败')
  })
  // #endif
}

// ==================== 会话管理（与 Web 端一致） ====================

/**
 * 获取会话列表
 */
export async function getConversations(pageNum = 1, pageSize = 20) {
  const token = getToken() || ''
  try {
    const resp = await fetch(getAiUrl(`/api/ai/conversations?page_num=${pageNum}&page_size=${pageSize}`), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!resp.ok) throw new Error(`请求失败: ${resp.status}`)
    return await resp.json()
  } catch (e) {
    console.error('获取会话列表失败:', e)
    return { code: -1, data: { items: [], total: 0 } }
  }
}

/**
 * 获取会话历史消息
 */
export async function getMessages(conversationId, beforeId, limit = 50) {
  const token = getToken() || ''
  try {
    const params = new URLSearchParams({ limit: String(limit) })
    if (beforeId) params.set('before_id', String(beforeId))
    const resp = await fetch(getAiUrl(`/api/ai/conversations/${conversationId}/messages?${params}`), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!resp.ok) throw new Error(`请求失败: ${resp.status}`)
    return await resp.json()
  } catch (e) {
    console.error('获取消息失败:', e)
    return { code: -1, data: { items: [] } }
  }
}

/**
 * 重命名会话
 */
export async function renameConversation(conversationId, title) {
  const token = getToken() || ''
  try {
    const resp = await fetch(getAiUrl(`/api/ai/conversations/${conversationId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title })
    })
    if (!resp.ok) throw new Error('重命名失败')
    return await resp.json()
  } catch (e) {
    console.error('重命名失败:', e)
    throw e
  }
}

/**
 * 删除会话
 */
export async function deleteConversation(conversationId) {
  const token = getToken() || ''
  try {
    const resp = await fetch(getAiUrl(`/api/ai/conversations/${conversationId}`), {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!resp.ok) throw new Error('删除失败')
    return await resp.json()
  } catch (e) {
    console.error('删除会话失败:', e)
    throw e
  }
}

/**
 * 获取写作模板列表（从服务端获取，与 Web 端一致）
 */
export async function getWriteTemplates() {
  const token = getToken() || ''
  try {
    const resp = await fetch(getAiUrl('/api/ai/write/templates'), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!resp.ok) throw new Error(`请求失败: ${resp.status}`)
    return await resp.json()
  } catch (e) {
    console.error('获取写作模板失败:', e)
    return null
  }
}
