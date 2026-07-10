// 时间格式化工具
// 统一处理：时间戳（秒/毫秒）、日期字符串、null/undefined、Invalid Date 兜底

/**
 * 安全解析时间为 Date 对象
 * @param {*} time - 时间值（Date | number 秒/毫秒 | string）
 * @returns {Date|null}
 */
function parseTime(time) {
  if (!time && time !== 0) return null;
  if (time instanceof Date) return isNaN(time.getTime()) ? null : time;
  // 纯数字字符串或数字：可能是秒级(10位)或毫秒级(13位)时间戳
  if (typeof time === 'number' || /^\d+$/.test(String(time))) {
    const n = Number(time);
    if (isNaN(n)) return null;
    // 秒级时间戳 → 毫秒
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  // 日期字符串
  const d = new Date(time);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 相对时间格式化（中文友好）
 * @param {*} time - 时间值
 * @returns {string}
 */
export function formatRelativeTime(time) {
  const d = parseTime(time);
  if (!d) return '';

  const now = new Date();
  const diff = now.getTime() - d.getTime();

  // 未来时间
  if (diff < -60000) {
    return formatAbsoluteTime(time);
  }
  // 刚刚
  if (diff < 60000) return '刚刚';
  // X 分钟前
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  // X 小时前
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';

  // 昨天
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  if (d >= yesterday && d < today) return '昨天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());

  // 今年内：MM-DD HH:mm
  if (d.getFullYear() === now.getFullYear()) {
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // 跨年：YYYY-MM-DD
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/**
 * 绝对时间格式化
 * @param {*} time - 时间值
 * @returns {string}
 */
export function formatAbsoluteTime(time) {
  const d = parseTime(time);
  if (!d) return '';
  return d.getFullYear() + '-' +
    pad(d.getMonth() + 1) + '-' +
    pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' +
    pad(d.getMinutes());
}

/**
 * 简短日期格式化
 * @param {*} time - 时间值
 * @returns {string}
 */
export function formatDate(time) {
  const d = parseTime(time);
  if (!d) return '';
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/**
 * 简短时间格式化
 * @param {*} time - 时间值
 * @returns {string}
 */
export function formatTime(time) {
  const d = parseTime(time);
  if (!d) return '';
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}
