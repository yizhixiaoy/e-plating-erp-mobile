// 移动端请求封装：自动注入 token、统一错误处理、Long 精度安全、SM4 字段加解密
const config = require("../config/api.js");
const auth = require("./auth.js");
const crypto = require("./crypto.js");

function buildUrl(path) {
  if (!path) return config.apiBase;
  if (/^https?:\/\//i.test(path)) return path;
  return config.apiBase + (path.startsWith("/") ? path : "/" + path);
}

function request(options) {
  const token = auth.getToken();
  const tenantCode = auth.getTenantCode();
  const header = Object.assign({
    "Content-Type": "application/json"
  }, options.header || {});
  if (token) header["Authorization"] = "Bearer " + token;
  if (tenantCode) header["X-Tenant-Code"] = tenantCode;

  // 请求字段加密
  let data = options.data;
  if (crypto.hasSessionKey() && data && typeof data === 'object' && !Array.isArray(data)) {
    data = encryptRequestFields(data);
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: buildUrl(options.url),
      method: options.method || "GET",
      data: data,
      header,
      timeout: options.timeout || 15000,
      success: (res) => {
        const status = res.statusCode;
        if (status === 401) {
          uni.showToast({ title: "登录已过期", icon: "none" });
          auth.redirectToLogin();
          reject(new Error("UNAUTHORIZED"));
          return;
        }
        if (status >= 200 && status < 300) {
          // 业务层返回 { code, message, data }
          const body = res.data;
          if (body && typeof body === "object" && "code" in body) {
            if (body.code === 200 || body.code === 0) {
              // 响应字段解密
              if (crypto.hasSessionKey() && body.data && typeof body.data === 'object') {
                body.data = decryptResponseFields(body.data);
              }
              resolve(body);
            } else {
              if (!options.silent) {
                uni.showToast({ title: body.message || "请求失败", icon: "none" });
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
        if (!options.silent) {
          uni.showToast({ title: "网络请求失败", icon: "none" });
        }
        reject(err);
      }
    });
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

// ---------- 字段加减密 ----------

function encryptRequestFields(data) {
  const cloned = JSON.parse(JSON.stringify(data));
  return encryptNode(cloned);

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
        } else if (val && typeof val === 'object') {
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
        } else if (val && typeof val === 'object') {
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

module.exports = { request, get, post, put, patch, del };
