// 图片预加载工具
// H5 平台：直接返回原始 URL（浏览器自动携带 cookie 完成认证）
// App 平台：通过 uni.request({responseType:'arraybuffer'}) 下载图片并转为 base64 data URI
//   为什么不继续使用 uni.downloadFile：
//     1. Android 上 downloadFile 的 tempFilePath 可能返回失效链接（已知 bug）
//     2. uni.request 与 API 调用共用同一网络栈，Authorization 头支持更可靠
//     3. base64 data URI 不依赖文件系统，<image> 组件直接可渲染
// 使用运行时检测替代 #ifdef 条件编译，确保在所有平台正确运行

import * as auth from './auth.js';
import apiCfg from '../config/api.js';

const imageCache = new Map(); // URL -> data URI (App) or original URL (H5)
let _platformChecked = false;
let _isH5 = true;

/** 运行时检测当前平台 */
function checkPlatform() {
  if (_platformChecked) return;
  _platformChecked = true;
  try {
    // App 平台有全局 plus 对象，H5 没有
    _isH5 = typeof plus === 'undefined';
  } catch (_) {
    _isH5 = true;
  }
}

/**
 * 将相对路径补全为绝对 URL
 * 注意：图片 URL 已经包含 /api/v1 前缀（由 getImageUrl 构造），所以只拼接 origin
 * 使用正则提取 origin 而非 new URL()，因为 App 平台 JS 引擎可能不支持 URL 构造函数
 */
function resolveUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  // 用正则从 apiBase 提取协议+主机+端口部分（如 http://192.168.7.47:8080）
  const m = apiCfg.apiBase.match(/^(https?:\/\/[^\/]+)/);
  const origin = m ? m[1] : '';
  return origin + (path.startsWith('/') ? path : '/' + path);
}

/**
 * 根据 URL 后缀推测 MIME 类型（后端文件接口不返回 Content-Type 时的兜底）
 */
function guessMime(url) {
  const ext = (url.split('.').pop() || '').split('?')[0].toLowerCase();
  const map = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon'
  };
  return map[ext] || 'image/jpeg';
}

/**
 * 加载单张图片
 * @param {string} url - 远程图片 URL
 * @returns {Promise<string>} App 返回 base64 data URI，H5 返回原始 URL；失败返回空字符串
 */
export async function loadImage(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('/static/')) return url;

  // 检查缓存
  if (imageCache.has(url)) return imageCache.get(url);

  checkPlatform();

  // H5 平台直接返回原始 URL（浏览器自动携带 cookie 完成认证）
  if (_isH5) {
    imageCache.set(url, url);
    return url;
  }

  // App 平台：uni.request + arraybuffer → base64 data URI
  // 确保 URL 是绝对路径（uni.request 在 App 平台不支持相对路径）
  const absoluteUrl = resolveUrl(url);
  try {
    const token = auth.getToken();
    const header = {};
    if (token) header['Authorization'] = 'Bearer ' + token;

    const res = await new Promise((resolve, reject) => {
      uni.request({
        url: absoluteUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        header,
        timeout: 15000,
        success: (r) => resolve(r),
        fail: (err) => reject(err)
      });
    });

    if (res.statusCode === 200 && res.data) {
      const base64 = uni.arrayBufferToBase64(res.data);
      const mime = guessMime(url);
      const dataUri = 'data:' + mime + ';base64,' + base64;
      imageCache.set(url, dataUri);
      return dataUri;
    }
    // 非 200 响应（如 401/403/404），记录状态码
    console.warn('[image-preloader] HTTP ' + res.statusCode + ' for:', url);
  } catch (e) {
    // uni-app 错误对象使用 errMsg 字段，而非 message
    console.warn('[image-preloader] request failed:', url, (e && (e.errMsg || e.message)) || JSON.stringify(e));
  }

  // 下载失败：缓存空字符串避免重复尝试，触发调用方的文字头像兜底
  imageCache.set(url, '');
  return '';
}

/**
 * 批量预加载图片
 * @param {string[]} urls - 远程图片 URL 列表
 * @returns {Promise<Map<string, string>>} URL → data URI / 原始 URL 映射
 */
export async function preloadImages(urls) {
  const results = new Map();
  const validUrls = [...new Set(urls)].filter(Boolean);
  if (!validUrls.length) return results;

  await Promise.all(
    validUrls.map(async (url) => {
      const result = await loadImage(url);
      results.set(url, result);
    })
  );
  return results;
}

/**
 * 获取已缓存的图片地址
 * @param {string} url - 远程图片 URL
 * @returns {string} 缓存地址或空字符串
 */
export function getCachedImage(url) {
  if (!url) return '';
  return imageCache.get(url) || '';
}

/**
 * 清除图片缓存
 */
export function clearImageCache() {
  imageCache.clear();
}
