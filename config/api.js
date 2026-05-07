// API配置文件
const config = {
  // API基础URL
  apiBase: process.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1",
  
  // 存储键名
  storageKeys: {
    token: "token",
    lastTenantCode: "lastTenantCode",
    userInfo: "userInfo"
  },
  
  // 登录相关API
  login: {
    tenantSearch: "/auth/tenants/search",
    recentTenants: "/auth/tenants/recent",
    smsCode: "/auth/sms-code",
    login: "/auth/login",
    resetPassword: "/auth/reset-password",
    scanTicket: "/auth/scan-ticket"
  },
  
  // 消息相关API
  message: {
    list: "/mobile/messages",
    read: "/mobile/messages/{noticeId}/read"
  },
  
  // 待办事项相关API
  todo: {
    list: "/mobile/todos"
  },
  
  // 认证相关API
  auth: {
    refresh: "/mobile/auth/refresh"
  }
};

// 生成完整的API URL
config.getUrl = function(path) {
  return this.apiBase + path;
};

module.exports = config;