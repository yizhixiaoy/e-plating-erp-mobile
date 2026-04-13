<template>
  <view style="padding: 16px">
    <view v-for="item in rows" :key="item.noticeId" style="padding: 8px; border-bottom: 1px solid #eee" @click="openDetail(item.noticeId)">
      <text>{{ item.title }}（{{ item.readStatus === 1 ? "已读" : "未读" }}）</text>
      <button size="mini" style="margin-left: 8px" @click.stop="markRead(item.noticeId)">标记已读</button>
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
    url: `${apiBase}/mobile/messages`,
    method: "GET",
    header: { Authorization: `Bearer ${token}` }
  });
  rows.value = resp.data?.data || [];
};

const markRead = async (noticeId) => {
  const token = uni.getStorageSync("token");
  await uni.request({
    url: `${apiBase}/mobile/messages/${noticeId}/read`,
    method: "PATCH",
    header: { Authorization: `Bearer ${token}` }
  });
  await load();
};

const openDetail = (noticeId) => {
  uni.navigateTo({ url: `/pages/message/detail?id=${noticeId}` });
};

onMounted(load);
</script>
