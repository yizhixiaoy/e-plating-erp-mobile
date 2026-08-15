// API配置文件
const config = {
  // API基础URL（开发环境）
  // apiBase: "http://xxxx:8080/api/v1",
  // API基础URL（生产环境）
  apiBase: "https://www.qianyunz.ltd/api/v1",

  // 调试模式：true 时 request.js 输出请求日志
  debug: false,

  // 存储键名
  storageKeys: {
    token: "token",
    refreshToken: "refreshToken",
    lastTenantCode: "lastTenantCode",
    userInfo: "userInfo",
    settings: "appSettings"
  },

  // 登录相关API
  login: {
    tenantSearch: "/auth/tenants/search",
    recentTenants: "/auth/tenants/recent",
    smsCode: "/auth/sms-code",
    login: "/auth/login",
    logout: "/auth/logout",
    refresh: "/auth/refresh",
    resetPassword: "/auth/reset-password",
    scanTicket: "/auth/scan-ticket"
  },

  // 移动端工作台
  workbench: {
    stats: "/mobile/workbench/stats",
    quickAccess: "/mobile/workbench/quick-access"
  },

  // 消息相关API
  message: {
    list: "/mobile/messages",
    read: "/mobile/messages/{noticeId}/read",
    readAll: "/mobile/messages/read-all"
  },

  // 待办事项相关API
  todo: {
    list: "/mobile/todos",
    detail: "/mobile/todos/{id}",
    handle: "/mobile/todos/{id}/handle",
    read: "/mobile/todos/{id}/read",
    stats: "/mobile/todos/stats"
  },

  // 通讯录
  contacts: {
    deptTree: "/mobile/contacts/depts",
    userList: "/mobile/contacts/users",
    userDetail: "/mobile/contacts/users/{id}"
  },

  // 个人中心
  me: {
    profile: "/mobile/me/profile",
    password: "/mobile/me/password",
    settingsGet: "/mobile/me/settings",
    settingsPut: "/mobile/me/settings",
    company: "/mobile/me/company",
    emailRecords: "/mobile/me/email-records",
    smsRecords: "/mobile/me/sms-records"
  },

  // 聊天
  chat: {
    conversations: "/chat/conversations",
    conversationDetail: "/chat/conversations/{id}",
    messages: "/chat/conversations/{id}/messages",
    send: "/chat/messages",
    recall: "/chat/messages/{id}/recall",
    edit: "/chat/messages/{id}/edit",
    read: "/chat/conversations/read",
    pinned: "/chat/conversations/pinned",
    muted: "/chat/conversations/muted",
    createSingle: "/chat/conversations/single",
    createGroup: "/chat/conversations/group",
    contactsSearch: "/chat/contacts/search",
    unreadSummary: "/chat/unread/summary",
    deleteConversation: "/chat/conversations/{id}"
  },

  // 文件
  file: {
    upload: "/files/upload"
  },

  // 字典
  dict: {
    data: "/dicts/data/{dictType}"
  }
};

// 生成完整的API URL
config.getUrl = function(path) {
  return this.apiBase + path;
};

// 占位符替换：getUrl("/x/{id}", { id: 1 }) -> /x/1
config.fillPath = function(path, params) {
  if (!params) return path;
  return path.replace(/\{(\w+)\}/g, function(_, k) {
    return params[k] != null ? params[k] : "";
  });
};

export default config;
