// 图片 URL 工具：将后端返回的头像/图片路径转为前端可用的绝对 URL
// 与 Web 端 getImageUrl() + extractFilename() 行为一致
import apiCfg from "../config/api.js";

// 提取 API 基地址的 origin 部分（协议+主机+端口）
let _origin = null;
function getOrigin() {
  if (_origin !== null) return _origin;
  try {
    _origin = new URL(apiCfg.apiBase).origin;
  } catch {
    _origin = "";
  }
  return _origin;
}

/**
 * 将后端返回的图片路径转为前端可使用的绝对 URL
 * 兼容三种格式：
 *   1. 完整 URL（http/https）或 data URI → 直接返回
 *   2. 资源 URL（/api/v1/files/resource?…）→ 拼接 origin
 *   3. 原始 OSS 路径（如 iam/avatar/xxx.jpg）→ 构造资源 URL
 *
 * @param {string|null|undefined} url - 后端返回的图片路径
 * @param {string} [fallbackFilename] - 当从 OSS 路径提取文件名时的降级值，默认 "image"
 * @returns {string} 可用的绝对 URL，空字符串表示无图片
 */
function getImageUrl(url, fallbackFilename) {
  if (!url) return "";
  // 已是完整 URL 或 data URI 则直接使用
  if (/^(https?:\/\/|data:)/i.test(url)) return url;
  // 已是资源路径（/api/v1/files/resource?…），拼接 origin
  if (url.startsWith("/api/v1/files/resource")) return getOrigin() + url;
  // 原始 OSS 路径（如 iam/avatar/xxx.jpg），构造资源 URL
  const filename = url.split("/").pop() || fallbackFilename || "image";
  return (
    getOrigin() +
    "/api/v1/files/resource?filename=" +
    encodeURIComponent(filename) +
    "&ossPath=" +
    encodeURIComponent(url) +
    "&action=preview"
  );
}

export { getImageUrl, getOrigin };
