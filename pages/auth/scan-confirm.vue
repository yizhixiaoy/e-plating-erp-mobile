<template>
  <view style="padding: 16px">
    <text>扫码确认页面（第一阶段占位）</text>
    <button style="margin-top: 12px" @click="confirm">确认登录</button>
  </view>
</template>

<script setup>
const confirm = () => {
  uni.showToast({ title: "已确认", icon: "success" });
};
</script>
