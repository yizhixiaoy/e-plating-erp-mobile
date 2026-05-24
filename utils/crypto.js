/**
 * 移动端加解密工具（国密 SM4-CBC）
 *
 * 两套密钥体系：
 * 1. 存储密钥（storageKey） — 通过 SM3 迭代哈希从项目种子派生，用于 Storage 加密
 * 2. 通信密钥（sessionKey） — 登录后由后端下发（hex 字符串），用于请求/响应字段级加解密
 *
 * 加密格式：hex( IV(16B) + ciphertext )
 */

const { sm4, sm3 } = require('sm-crypto');

// ---------- 常量 ----------

const STORAGE_SEED = 'ZhiDuYun@ERP#2024!SecureSeed';
const STORAGE_SALT = 'erp-storage-salt-v1';
const KEY_DERIVE_ROUNDS = 1024;
const SM4_IV_LEN = 16; // bytes
const SM4_KEY_LEN = 32; // hex chars (16 bytes)

// ---------- 内部工具 ----------

/** 生成随机 hex IV */
function randomIv() {
  // uni-app 环境可能没有 crypto.getRandomValues，用 Math.random 兜底
  const bytes = [];
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint8Array(SM4_IV_LEN);
      crypto.getRandomValues(arr);
      for (let i = 0; i < arr.length; i++) bytes.push(arr[i]);
    } else {
      throw new Error('no crypto');
    }
  } catch (e) {
    for (let i = 0; i < SM4_IV_LEN; i++) {
      bytes.push(Math.floor(Math.random() * 256));
    }
  }
  return bytes.map(b => ('0' + b.toString(16)).slice(-2)).join('');
}

// ---------- 密钥派生 ----------

function deriveStorageKey() {
  let key = sm3(STORAGE_SEED + STORAGE_SALT);
  for (let i = 0; i < KEY_DERIVE_ROUNDS; i++) {
    key = sm3(key);
  }
  return key.substring(0, SM4_KEY_LEN);
}

// ---------- 通用 SM4-CBC 加解密 ----------

function sm4Encrypt(keyHex, plaintext) {
  const iv = randomIv();
  const cipherHex = sm4.encrypt(plaintext, keyHex, { mode: 'cbc', iv, padding: 'pkcs#7' });
  return iv + cipherHex;
}

function sm4Decrypt(keyHex, encryptedHex) {
  if (!encryptedHex || encryptedHex.length < SM4_IV_LEN * 2 + 1) {
    throw new Error('Invalid ciphertext length');
  }
  const iv = encryptedHex.substring(0, SM4_IV_LEN * 2);
  const cipher = encryptedHex.substring(SM4_IV_LEN * 2);
  return sm4.decrypt(cipher, keyHex, { mode: 'cbc', iv, padding: 'pkcs#7' });
}

// ---------- 懒加载缓存 ----------

let storageKey = null;
let sessionKey = null;

function getStorageKey() {
  if (!storageKey) {
    storageKey = deriveStorageKey();
  }
  return storageKey;
}

// ---------- 公开 API ----------

/** 加密存入 Storage 的值，失败降级为明文 */
function encryptStorage(plaintext) {
  try {
    return sm4Encrypt(getStorageKey(), plaintext);
  } catch (e) {
    console.warn('[mobile-crypto] encryptStorage failed, fallback to plaintext', e);
    return plaintext;
  }
}

/** 解密从 Storage 读取的值，失败降级返回原文 */
function decryptStorage(encrypted) {
  if (!encrypted) return encrypted;
  try {
    return sm4Decrypt(getStorageKey(), encrypted);
  } catch (e) {
    // 可能是旧版明文数据，直接返回
    return encrypted;
  }
}

/** 设置通信会话密钥 */
function setSessionKey(rawKey) {
  if (!rawKey || rawKey.length !== SM4_KEY_LEN) {
    console.error('[mobile-crypto] setSessionKey: invalid key length');
    return;
  }
  sessionKey = rawKey;
}

/** 清除通信会话密钥 */
function clearSessionKey() {
  sessionKey = null;
}

/** 是否有可用会话密钥 */
function hasSessionKey() {
  return sessionKey !== null;
}

/** 加密单个字段（用于请求） */
function encryptField(plaintext) {
  if (!sessionKey) return plaintext;
  try {
    return sm4Encrypt(sessionKey, plaintext);
  } catch (e) {
    return plaintext;
  }
}

/** 解密单个字段（用于响应） */
function decryptField(encrypted) {
  if (!sessionKey || !encrypted) return encrypted;
  try {
    return sm4Decrypt(sessionKey, encrypted);
  } catch (e) {
    return encrypted;
  }
}

/** 需要加密的请求字段名集合 */
const ENCRYPTED_REQUEST_FIELDS = new Set([
  'password', 'oldPassword', 'newPassword',
  'phone', 'email', 'smsCode', 'emailCode',
  'realName', 'username'
]);

/** 需要解密的响应字段名集合 */
const ENCRYPTED_RESPONSE_FIELDS = new Set([
  'phone', 'email', 'realName', 'username',
  'companyPhone', 'leaderName'
]);

module.exports = {
  encryptStorage,
  decryptStorage,
  setSessionKey,
  clearSessionKey,
  hasSessionKey,
  encryptField,
  decryptField,
  ENCRYPTED_REQUEST_FIELDS,
  ENCRYPTED_RESPONSE_FIELDS
};
