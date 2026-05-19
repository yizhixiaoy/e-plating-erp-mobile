// 认证与会话存储统一封装
// 所有 token / userInfo / tenantCode 读写都走这里，避免散落 uni.getStorageSync
const STORAGE_KEYS = {
  token: "token",
  refreshToken: "refreshToken",
  userInfo: "userInfo",
  lastTenantCode: "lastTenantCode",
  settings: "appSettings"
};

function getToken() {
  return uni.getStorageSync(STORAGE_KEYS.token) || "";
}

function setToken(token) {
  if (token) uni.setStorageSync(STORAGE_KEYS.token, token);
  else uni.removeStorageSync(STORAGE_KEYS.token);
}

function getRefreshToken() {
  return uni.getStorageSync(STORAGE_KEYS.refreshToken) || "";
}

function setRefreshToken(token) {
  if (token) uni.setStorageSync(STORAGE_KEYS.refreshToken, token);
  else uni.removeStorageSync(STORAGE_KEYS.refreshToken);
}

function getUserInfo() {
  const raw = uni.getStorageSync(STORAGE_KEYS.userInfo);
  if (!raw) return null;
  // 兼容已序列化字符串与对象
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  return raw;
}

function setUserInfo(info) {
  if (info) uni.setStorageSync(STORAGE_KEYS.userInfo, info);
  else uni.removeStorageSync(STORAGE_KEYS.userInfo);
}

function getTenantCode() {
  return uni.getStorageSync(STORAGE_KEYS.lastTenantCode) || "";
}

function setTenantCode(code) {
  if (code) uni.setStorageSync(STORAGE_KEYS.lastTenantCode, code);
}

function clearAuth() {
  uni.removeStorageSync(STORAGE_KEYS.token);
  uni.removeStorageSync(STORAGE_KEYS.refreshToken);
  uni.removeStorageSync(STORAGE_KEYS.userInfo);
}

// 跳转登录（清理本地 + reLaunch）
function redirectToLogin() {
  clearAuth();
  uni.reLaunch({ url: "/pages/auth/login" });
}

module.exports = {
  STORAGE_KEYS,
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  getUserInfo,
  setUserInfo,
  getTenantCode,
  setTenantCode,
  clearAuth,
  redirectToLogin
};
