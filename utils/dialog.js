// 全局确认弹窗工具，替代 uni.showModal
// 统一按钮顺序：取消（左）、确认（右），不受平台原生对话框按钮顺序影响
import { reactive } from 'vue';

export const dialogState = reactive({
  visible: false,
  title: '',
  content: '',
  cancelText: '取消',
  confirmText: '确认',
  confirm: () => {},
  cancel: () => {}
});

let _pendingResolve = null;

/**
 * 显示确认弹窗
 * @param {Object} options
 * @param {string} options.title - 标题
 * @param {string} options.content - 内容
 * @param {string} [options.cancelText='取消'] - 取消按钮文字
 * @param {string} [options.confirmText='确认'] - 确认按钮文字
 * @returns {Promise<boolean>} true=确认, false=取消
 */
export function showConfirm(options = {}) {
  return new Promise((resolve) => {
    _pendingResolve = resolve;
    dialogState.title = options.title || '提示';
    dialogState.content = options.content || '';
    dialogState.cancelText = options.cancelText || '取消';
    dialogState.confirmText = options.confirmText || '确认';
    dialogState.confirm = () => {
      dialogState.visible = false;
      if (_pendingResolve) { _pendingResolve(true); _pendingResolve = null; }
    };
    dialogState.cancel = () => {
      dialogState.visible = false;
      if (_pendingResolve) { _pendingResolve(false); _pendingResolve = null; }
    };
    dialogState.visible = true;
  });
}
