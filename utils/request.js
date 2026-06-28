// 移动端请求封装：自动注入 token、统一错误处理、Long 精度安全、SM4 字段加解密
// Token 刷新策略与 Web 端（http.ts）保持一致
import config from "../config/api.js";
import * as auth from "./auth.js";
import * as crypto from "./crypto.js";

function buildUrl(path) {
  if (!path) return config.apiBase;
  if (/^https?:\/\//i.test(path)) return path;
  return config.apiBase + (path.startsWith("/") ? path : "/" + path);
}

// 正在刷新 Token 的标志（与 Web 端一致）
let isRefreshing = false;
// 等待 Token 刷新的请求队列（与 Web 端一致）
let refreshSubscribers = [];
const TOKEN_EXPIRE_MSG = "登录已过期，请重新登录";

function subscribeTokenRefresh(callback) {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(newToken) {
  refreshSubscribers.forEach(cb => cb(newToken));
  refreshSubscribers = [];
}

async function doRefreshToken() {
  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await uni.request({
      url: buildUrl("/auth/refresh"),
      method: "POST",
      data: { refreshToken }
    });
    const accessToken = res.data?.data?.accessToken;
    if (accessToken) {
      auth.setToken(accessToken);
      return accessToken;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function request(options) {
  const token = auth.getToken();
  const header = Object.assign({
    "Content-Type": "application/json"
  }, options.header || {});
  if (token) header["Authorization"] = "Bearer " + token;

  // 请求字段加密（确保 sessionKey 已加载）
  let data = options.data;
  ensureSessionKey();
  if (crypto.hasSessionKey() && data && typeof data === 'object' && !Array.isArray(data)) {
    data = encryptRequestFields(data);
  }

  const fullUrl = buildUrl(options.url);
  const method = options.method || "GET";

  return new Promise((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data: data,
      header,
      timeout: options.timeout || 15000,
      success: (res) => {
        const status = res.statusCode;
        if (status === 401) {
          // 与 Web 端一致：先尝试刷新 Token，再重试
          handleUnauthorized(options, resolve, reject);
          return;
        }
        if (status >= 200 && status < 300) {
          // 业务层返回 { code, msg, data }
          const body = res.data;
          if (body && typeof body === "object" && "code" in body) {
            if (body.code === 200) {
              // 响应字段解密（确保 sessionKey 已加载，与 Web 端一致：仅处理对象，跳过数组）
              ensureSessionKey();
              if (crypto.hasSessionKey() && body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
                body.data = decryptResponseFields(body.data);
              }
              resolve(body);
            } else {
              if (!options.silent) {
                uni.showToast({ title: body.msg || body.message || "请求失败", icon: "none" });
              }
              reject(body);
            }
          } else {
            resolve({ code: 200, data: body });
          }
        } else {
          if (!options.silent) {
            uni.showToast({ title: "网络异常(" + status + ")", icon: "none" });
          }
          reject(res);
        }
      },
      fail: (err) => {
        if (config.debug) {
          console.error(`[request] ${method} ${fullUrl} → FAIL`, JSON.stringify(err));
        }
        if (!options.silent) {
          uni.showToast({ title: "网络请求失败", icon: "none" });
        }
        reject(err);
      }
    });
  });
}

// 处理 401：先尝试刷新 Token，成功后重试，失败后跳转登录（与 Web 端一致）
function handleUnauthorized(options, resolve, reject) {
  if (isRefreshing) {
    // 如果正在刷新，等待刷新完成后续请求重试
    subscribeTokenRefresh((newToken) => {
      options.header = options.header || {};
      options.header["Authorization"] = "Bearer " + newToken;
      retryRequest(options, resolve, reject);
    });
    return;
  }
  
  isRefreshing = true;
  
  doRefreshToken().then((newToken) => {
    if (newToken) {
      // 通知所有等待的请求使用新 Token
      onTokenRefreshed(newToken);
      // 重试当前请求
      options.header = options.header || {};
      options.header["Authorization"] = "Bearer " + newToken;
      retryRequest(options, resolve, reject);
    } else {
      // Refresh Token 也失败了，跳转登录
      uni.showToast({ title: TOKEN_EXPIRE_MSG, icon: "none" });
      auth.redirectToLogin();
      reject(new Error("UNAUTHORIZED"));
    }
  }).catch(() => {
    // 刷新异常，跳转登录
    uni.showToast({ title: TOKEN_EXPIRE_MSG, icon: "none" });
    auth.redirectToLogin();
    reject(new Error("UNAUTHORIZED"));
  }).finally(() => {
    isRefreshing = false;
  });
}

// 使用新 Token 重试原始请求
function retryRequest(options, resolve, reject) {
  // 重新构建 header（与 request() 保持一致）
  const header = Object.assign({
    "Content-Type": "application/json"
  }, options.header || {});
  const token = auth.getToken();
  if (token) header["Authorization"] = "Bearer " + token;
  
  // 重试时同样需要加密请求字段（确保 sessionKey 已加载）
  let data = options.data;
  ensureSessionKey();
  if (crypto.hasSessionKey() && data && typeof data === 'object' && !Array.isArray(data)) {
    data = encryptRequestFields(data);
  }
  
  uni.request({
    url: buildUrl(options.url),
    method: options.method || "GET",
    data: data,
    header,
    timeout: options.timeout || 15000,
    success: (res) => {
      const status = res.statusCode;
      if (status >= 200 && status < 300) {
        const body = res.data;
        if (body && typeof body === "object" && "code" in body) {
          if (body.code === 200) {
            // 响应字段解密（确保 sessionKey 已加载，与 Web 端一致：仅处理对象，跳过数组）
            ensureSessionKey();
            if (crypto.hasSessionKey() && body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
              body.data = decryptResponseFields(body.data);
            }
            resolve(body);
          } else {
            if (!options.silent) {
              uni.showToast({ title: body.msg || body.message || "请求失败", icon: "none" });
            }
            reject(body);
          }
        } else {
          resolve({ code: 200, data: body });
        }
      } else if (status === 401) {
        // 重试后仍然 401 → 跳转登录（与 Web 端一致）
        uni.showToast({ title: TOKEN_EXPIRE_MSG, icon: "none" });
        auth.redirectToLogin();
        reject(new Error("UNAUTHORIZED"));
      } else {
        if (!options.silent) {
          uni.showToast({ title: "网络异常(" + status + ")", icon: "none" });
        }
        reject(res);
      }
    },
    fail: (err) => {
      if (!options.silent) {
        uni.showToast({ title: "网络请求失败", icon: "none" });
      }
      reject(err);
    }
  });
}

function get(url, params, opts) {
  let qs = "";
  if (params && typeof params === "object") {
    const list = [];
    Object.keys(params).forEach((k) => {
      const v = params[k];
      if (v !== undefined && v !== null && v !== "") {
        list.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
      }
    });
    if (list.length) qs = (url.indexOf("?") >= 0 ? "&" : "?") + list.join("&");
  }
  return request(Object.assign({ url: url + qs, method: "GET" }, opts || {}));
}

function post(url, data, opts) {
  return request(Object.assign({ url, method: "POST", data }, opts || {}));
}

function put(url, data, opts) {
  return request(Object.assign({ url, method: "PUT", data }, opts || {}));
}

function patch(url, data, opts) {
  return request(Object.assign({ url, method: "PATCH", data }, opts || {}));
}

function del(url, opts) {
  return request(Object.assign({ url, method: "DELETE" }, opts || {}));
}

/**
 * 确保 sessionKey 已加载到内存（与 Web 端 session.ts restoreSessionKey 一致）
 * sessionKey 明文存储，直接从 Storage 恢复
 */
function ensureSessionKey() {
  if (crypto.hasSessionKey()) return;
  auth.getSessionKey();
}

// ---------- 字段加减密 ----------

function encryptRequestFields(data) {
  const cloned = JSON.parse(JSON.stringify(data));
  return encryptNode(cloned);

  // 与 Web 端 encryptFields 保持一致：只遍历对象，跳过数组
  function encryptNode(node) {
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      const result = {};
      for (const key of Object.keys(node)) {
        const val = node[key];
        if (crypto.ENCRYPTED_REQUEST_FIELDS.has(key) && typeof val === 'string' && val.length > 0) {
          try {
            result[key] = crypto.encryptField(val);
          } catch (e) {
            result[key] = val;
          }
        } else if (val && typeof val === 'object' && !Array.isArray(val)) {
          result[key] = encryptNode(val);
        } else {
          result[key] = val;
        }
      }
      return result;
    }
    return node;
  }
}

function decryptResponseFields(data) {
  const cloned = JSON.parse(JSON.stringify(data));
  return decryptNode(cloned);

  // 与 Web 端 decryptFields 保持一致：只遍历对象，跳过数组
  function decryptNode(node) {
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      const result = {};
      for (const key of Object.keys(node)) {
        const val = node[key];
        if (crypto.ENCRYPTED_RESPONSE_FIELDS.has(key) && typeof val === 'string' && val.length > 0) {
          try {
            result[key] = crypto.decryptField(val);
          } catch (e) {
            result[key] = val;
          }
        } else if (val && typeof val === 'object' && !Array.isArray(val)) {
          result[key] = decryptNode(val);
        } else {
          result[key] = val;
        }
      }
      return result;
    }
    return node;
  }
}

export { request, get, post, put, patch, del };
