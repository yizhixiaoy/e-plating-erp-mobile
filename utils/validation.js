/**
 * 统一表单校验规则
 * 与 Web 端 (e-plating-erp-frontend/src/utils/validation.ts) 保持完全一致
 */

// ========================================
// 输入过滤函数（实时过滤非法字符）
// ========================================

/** 手机号过滤：仅数字，限制11位 */
export const filterPhone = (value) => value.replace(/[^\d]/g, '').slice(0, 11)

/** 账号过滤：字母、数字和特殊字符:@._- */
export const filterUsername = (value) => value.replace(/[^a-zA-Z0-9:@._-]/g, '')

/** 验证码过滤：仅字母和数字 */
export const filterCode = (value) => value.replace(/[^a-zA-Z0-9]/g, '')

/** 密码过滤：字母、数字和特殊字符(@$!%*#?&)，限制20位 */
export const filterPassword = (value) => value.replace(/[^A-Za-z\d@$!%*#?&]/g, '').slice(0, 20)

/** 通用文本过滤：限制128位 */
export const filterText = (value) => value.slice(0, 128)

// ========================================
// 校验规则（与 validation.ts 完全一致）
// ========================================

/** 手机号校验：11位数字，以1开头，第二位3-9 */
export const phoneRule = {
  required: true,
  message: "请输入手机号",
  pattern: /^1[3-9]\d{9}$/,
  patternMessage: "手机号格式不正确，应为11位数字且以1开头"
}

/** 账号校验：2-64位，字母、数字或特殊字符(:@._-) */
export const usernameRule = {
  required: true,
  message: "请输入账号",
  min: 2,
  max: 64,
  minMessage: "账号长度为2-64个字符，支持字母、数字和特殊字符(:@._-)",
  pattern: /^[a-zA-Z0-9:@._-]+$/,
  patternMessage: "账号只能包含字母、数字和特殊字符(:@._-)，不支持空格和其他符号"
}

/** 密码校验：8-20位，必须包含字母和数字，支持特殊字符(@$!%*#?&) */
export const passwordRule = {
  required: true,
  message: "请输入密码",
  min: 8,
  max: 20,
  minMessage: "密码长度为8-20个字符，必须同时包含字母和数字",
  pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/,
  patternMessage: "密码必须包含字母和数字，可包含特殊字符(@$!%*#?&)"
}

/** 验证码校验：6位数字和字母组合，不区分大小写 */
export const verificationCodeRule = {
  required: true,
  message: "请输入验证码",
  min: 6,
  max: 6,
  minMessage: "验证码为6位字符，由数字和字母组成",
  pattern: /^[a-zA-Z0-9]{6}$/,
  patternMessage: "验证码格式不正确，应为6位数字和字母组合"
}

// ========================================
// 校验函数（供模板中 @input / watch 调用）
// ========================================

/** 校验账号 */
export function validateUsername(value) {
  if (!value) return usernameRule.message
  if (value.length < usernameRule.min || value.length > usernameRule.max) return usernameRule.minMessage
  if (!usernameRule.pattern.test(value)) return usernameRule.patternMessage
  return ""
}

/** 校验密码 */
export function validatePassword(value) {
  if (!value) return passwordRule.message
  if (value.length < passwordRule.min || value.length > passwordRule.max) return passwordRule.minMessage
  if (!passwordRule.pattern.test(value)) return passwordRule.patternMessage
  return ""
}

/** 校验手机号 */
export function validatePhone(value) {
  if (!value) return phoneRule.message
  if (!phoneRule.pattern.test(value)) return phoneRule.patternMessage
  return ""
}

/** 校验验证码 */
export function validateCode(value) {
  if (!value) return verificationCodeRule.message
  if (value.length !== verificationCodeRule.min) return verificationCodeRule.minMessage
  if (!verificationCodeRule.pattern.test(value)) return verificationCodeRule.patternMessage
  return ""
}

/** 校验确认密码 */
export function validateConfirmPassword(value, newPassword) {
  if (!value) return "请再次输入新密码"
  if (value !== newPassword) return "两次输入的密码不一致"
  return ""
}
