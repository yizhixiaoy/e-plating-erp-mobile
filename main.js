import App from './App'
import { getSessionKey } from './utils/auth'

// 恢复会话密钥（SM4 解密响应字段用，必须在任何请求之前执行）
getSessionKey()

// #ifndef VUE3
import Vue from 'vue'
Vue.config.productionTip = false
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  const app = createSSRApp(App)
  return {
    app
  }
}
// #endif
