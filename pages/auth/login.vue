<template>
  <view style="padding: 16px">
    <input v-model="tenantCode" placeholder="租户编码" />
    <input v-model="username" placeholder="账号" style="margin-top: 8px" />
    <input v-model="password" password placeholder="密码" style="margin-top: 8px" />
    <button @click="login" style="margin-top: 12px">登录</button>
  </view>
</template>

<script setup>
import { ref } from "vue";
const tenantCode = ref("a");
const username = ref("a-admin");
const password = ref("123456");
const apiBase = "http://localhost:8080/api/v1";

const login = async () => {
  const resp = await uni.request({
    url: `${apiBase}/auth/login`,
    method: "POST",
    data: { loginType: "PASSWORD", tenantCode: tenantCode.value, username: username.value, password: password.value, clientType: "APP" }
  });
  const token = resp.data?.data?.accessToken || "";
  uni.setStorageSync("token", token);
  uni.navigateTo({ url: "/pages/message/list" });
};
</script>
