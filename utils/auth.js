// 认证与会话存储统一封装
// 所有 token / userInfo / tenantCode 读写都走这里，避免散落 uni.getStorageSync
// userInfo 使用 SM4 加密存储

const crypto = require('./crypto.js');

const STORAGE_KEYS = {
  token: "token",
  refreshToken: "refreshToken",
  userInfo: "userInfo",
  lastTenantCode: "lastTenantCode",
  settings: "appSettings",
  sessionKey: "sessionKey"
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
  // 解密存储的加密数据
  let decrypted;
  if (typeof raw === "string") {
    try { decrypted = crypto.decryptStorage(raw); } catch (e) { decrypted = raw; }
    try { return JSON.parse(decrypted); } catch (e) { return null; }
  }
  return raw;
}

function setUserInfo(info) {
  if (info) {
    const jsonStr = typeof info === "string" ? info : JSON.stringify(info);
    uni.setStorageSync(STORAGE_KEYS.userInfo, crypto.encryptStorage(jsonStr));
  } else {
    uni.removeStorageSync(STORAGE_KEYS.userInfo);
  }
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
  uni.removeStorageSync(STORAGE_KEYS.sessionKey);
  crypto.clearSessionKey();
}

// 跳转登录（清理本地 + reLaunch）
function redirectToLogin() {
  clearAuth();
  uni.reLaunch({ url: "/pages/auth/login" });
}

// ---------- 通信会话密钥 ----------

function saveSessionKey(rawKey) {
  if (rawKey) {
    uni.setStorageSync(STORAGE_KEYS.sessionKey, crypto.encryptStorage(rawKey));
    crypto.setSessionKey(rawKey);
  }
}

function getSessionKey() {
  const raw = uni.getStorageSync(STORAGE_KEYS.sessionKey);
  if (raw) {
    try {
      const decrypted = crypto.decryptStorage(raw);
      if (decrypted && !crypto.hasSessionKey()) {
        crypto.setSessionKey(decrypted);
      }
      return decrypted || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

module.exports = {
  saveSessionKey,
  getSessionKey,
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
