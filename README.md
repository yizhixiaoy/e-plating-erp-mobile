# e-plating-erp-mobile

第一阶段 App/小程序独立仓库（建议拆分后单独托管）。

## 技术栈
- Uni-app

## 页面范围（一期）
- 登录
- 消息中心（含消息详情）
- 我的待办（含待办详情）
- 扫码确认

## 配置管理
### 配置文件
- `config/api.js` - API配置文件，包含API基础URL和各个API路径

### 配置说明
- **API基础URL**：在 `config/api.js` 文件中配置 `apiBase` 字段
- **存储键名**：在 `config/api.js` 文件中配置 `storageKeys` 对象
- **API路径**：在 `config/api.js` 文件中配置各个模块的API路径

### 示例配置
```javascript
// config/api.js
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
```

## 启动
### 环境要求
- Node.js 14+
- HBuilderX 3.0+

### 安装步骤
1. 下载并安装 HBuilderX：[https://www.dcloud.io/hbuilderx.html](https://www.dcloud.io/hbuilderx.html)
2. 克隆项目到本地
3. 使用 HBuilderX 打开项目
4. 在 HBuilderX 中安装依赖：
   - 点击顶部菜单 "工具" -> "插件安装"
   - 安装 "uni-app 插件" 和 "微信开发者工具" 插件

### 运行方法
#### 运行到微信小程序
1. 安装微信开发者工具：[https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 在 HBuilderX 中，点击顶部菜单 "运行" -> "运行到小程序模拟器" -> "微信开发者工具"
3. 微信开发者工具会自动打开并加载项目

#### 运行到 App
1. 在 HBuilderX 中，点击顶部菜单 "运行" -> "运行到手机或模拟器" -> "运行到 Android 模拟器" 或 "运行到 iOS 模拟器"
2. 或连接真机，选择 "运行到 Android 设备" 或 "运行到 iOS 设备"

#### 运行到 H5
1. 在 HBuilderX 中，点击顶部菜单 "运行" -> "运行到浏览器" -> 选择浏览器

### 构建方法
1. 在 HBuilderX 中，点击顶部菜单 "发行" -> "小程序-微信" 或 "App 云端打包" 或 "H5 网站"
2. 按照提示完成构建过程

## 说明
- 已实现登录页面，支持账号密码、短信验证和扫码登录
- 已实现消息中心页面，支持消息列表和详情查看
- 已实现待办事项页面，支持待办事项列表和详情查看
- 已实现智能租户识别和最近租户记忆功能
- 已实现扫码确认登录功能
