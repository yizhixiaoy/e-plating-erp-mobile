<template>
  <view v-if="dialog.visible" class="cd-mask" @click="dialog.cancel">
    <view class="cd-box" @click.stop>
      <text class="cd-title">{{ dialog.title }}</text>
      <text class="cd-content">{{ dialog.content }}</text>
      <view class="cd-btns">
        <text class="cd-btn cd-btn-cancel" @click="dialog.cancel">{{ dialog.cancelText }}</text>
        <text class="cd-btn cd-btn-confirm" @click="dialog.confirm">{{ dialog.confirmText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { dialogState } from '../utils/dialog.js';
const dialog = dialogState;
</script>

<style scoped>
.cd-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}
.cd-box {
  width: 300px;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  animation: cdFadeInUp 0.25s ease;
}
.cd-title {
  display: block;
  padding: 24px 24px 0;
  font-size: 17px;
  font-weight: 600;
  color: #1e293b;
  text-align: center;
}
.cd-content {
  display: block;
  padding: 12px 24px 24px;
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
  text-align: center;
}
.cd-btns {
  display: flex;
  border-top: 1px solid #f1f5f9;
}
.cd-btn {
  flex: 1;
  text-align: center;
  padding: 14px 0;
  font-size: 16px;
  font-weight: 500;
}
.cd-btn:active {
  opacity: 0.7;
}
.cd-btn-cancel {
  color: #64748b;
  border-right: 1px solid #f1f5f9;
  background: #f8fafc;
}
.cd-btn-confirm {
  color: #3b82f6;
  font-weight: 600;
  background: #fff;
}

@keyframes cdFadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
