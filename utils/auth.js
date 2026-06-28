// 认证与会话存储统一封装
// 所有 token / userInfo / tenantCode 读写都走这里，避免散落 uni.getStorageSync
// userInfo 使用 SM4 加密存储

import * as crypto from './crypto.js';

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
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  return raw;
}

function setUserInfo(info) {
  if (info) {
    const jsonStr = typeof info === "string" ? info : JSON.stringify(info);
    uni.setStorageSync(STORAGE_KEYS.userInfo, jsonStr);
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

// 尝试刷新AccessToken（返回新token或null）
// URL 构建与 request.js buildUrl 保持一致
async function tryRefreshToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  
  const { default: config } = await import("../config/api.js");
  const url = config.apiBase + "/auth/refresh";
  return new Promise((resolve) => {
    uni.request({
      url,
      method: "POST",
      data: { refreshToken },
      success: (res) => {
        if (res.statusCode === 200) {
          const accessToken = res.data?.data?.accessToken;
          if (accessToken) {
            setToken(accessToken);
            resolve(accessToken);
            return;
          }
        }
        resolve(null);
      },
      fail: () => resolve(null)
    });
  });
}

// ---------- 通信会话密钥 ----------
// sessionKey 直接明文存储（与 Web 端 localStorage 存储一致的效果）
// 不再通过 encryptStorage/decryptStorage 包裹，避免 SM4 存储解密链路异常导致 sessionKey 丢失

function saveSessionKey(rawKey) {
  if (rawKey) {
    uni.setStorageSync(STORAGE_KEYS.sessionKey, rawKey);
    crypto.setSessionKey(rawKey);
  }
}

function getSessionKey() {
  const raw = uni.getStorageSync(STORAGE_KEYS.sessionKey);
  if (raw && typeof raw === 'string' && raw.length === 32 && /^[0-9a-fA-F]+$/.test(raw)) {
    if (!crypto.hasSessionKey()) {
      crypto.setSessionKey(raw);
    }
    return raw;
  }
  return null;
}

export {
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
  redirectToLogin,
  tryRefreshToken
};
