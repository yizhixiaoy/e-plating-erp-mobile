<template>
  <view style="padding: 16px">
    <view v-for="item in rows" :key="item.todoId" style="padding: 8px; border-bottom: 1px solid #eee" @click="openDetail(item.todoId)">
      <text>{{ item.title }}</text>
    </view>
  </view>
</template>

<script setup>
import { onMounted, ref } from "vue";
const rows = ref([]);
const apiBase = "http://localhost:8080/api/v1";

const load = async () => {
  const token = uni.getStorageSync("token");
  const resp = await uni.request({
    url: `${apiBase}/mobile/todos`,
    method: "GET",
    header: { Authorization: `Bearer ${token}` }
  });
  rows.value = resp.data?.data || [];
};

const openDetail = (todoId) => {
  uni.navigateTo({ url: `/pages/todo/detail?id=${todoId}` });
};

onMounted(load);
</script>
