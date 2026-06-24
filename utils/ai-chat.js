/**
 * AI聊天 API - 移动端 SSE 流式通信
 */
import { getToken, redirectToLogin, tryRefreshToken } from './auth.js'

export async function streamChat(query, conversationId, callbacks) {
  const token = getToken() || ''

  uni.request({
    url: '/api/ai/chat',
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    data: { query, conversation_id: conversationId || undefined },
    responseType: 'text',
    enableChunked: true,
    success: async (res) => {
      // 移动端SSE解析
      const text = res.data || ''
      const lines = text.split('\n')
      let currentEvent = ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            switch (currentEvent) {
              case 'thinking':
                if (data.is_plan) {
                  callbacks.onPlan?.(data.content, data.plan_steps)
                } else {
                  callbacks.onThinking?.(data.content)
                }
                break
              case 'tool_start':
                callbacks.onToolStart?.(data.tool_name, data.tool_params, data.step_index); break
              case 'tool_end':
                callbacks.onToolEnd?.(data.tool_name, data.result_summary, data.step_index); break
              case 'tool_error':
                callbacks.onToolError?.(data.tool_name, data.error_msg, data.step_index); break
              case 'chunk': callbacks.onChunk?.(data.content); break
              case 'reference': callbacks.onReference?.(data); break
              case 'token_expired':
                // 先尝试静默刷新Token（与Web端行为一致）
                const newToken = await tryRefreshToken()
                if (newToken) {
                  uni.showToast({ title: 'Token已自动续期，请重试', icon: 'none' })
                } else {
                  uni.showToast({ title: data.message || '认证已过期，请重新登录', icon: 'none' })
                  redirectToLogin()
                }
                callbacks.onError?.(data.message || '认证已过期')
                return
              case 'done': callbacks.onDone?.(data); break
              case 'error': callbacks.onError?.(data.message); break
            }
          } catch (e) { console.warn(e) }
        }
      }
    },
    fail: (err) => callbacks.onError?.(err.errMsg || '请求失败')
  })
}
