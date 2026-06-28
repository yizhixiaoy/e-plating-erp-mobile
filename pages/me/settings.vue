<template>
  <view class="st-container">
    <view class="st-section">
      <view class="st-row">
        <text class="st-label">消息推送</text>
        <switch :checked="settings.pushEnabled" color="#3b82f6" @change="onChange('pushEnabled', $event)" />
      </view>
      <view class="st-row">
        <text class="st-label">声音提示</text>
        <switch :checked="settings.soundEnabled" color="#3b82f6" @change="onChange('soundEnabled', $event)" />
      </view>
      <view class="st-row">
        <text class="st-label">震动提示</text>
        <switch :checked="settings.vibrateEnabled" color="#3b82f6" @change="onChange('vibrateEnabled', $event)" />
      </view>
    </view>

    <view class="st-section">
      <view class="st-row">
        <text class="st-label">深色模式</text>
        <switch :checked="settings.darkMode" color="#3b82f6" @change="onChange('darkMode', $event)" />
      </view>
      <view class="st-row">
        <text class="st-label">字号大小</text>
        <view class="st-radio-group">
          <view
            v-for="opt in fontOptions"
            :key="opt.value"
            :class="['st-radio', settings.fontSize === opt.value ? 'active' : '']"
            @click="onFontSize(opt.value)"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="st-section">
      <view class="st-row" @click="clearCache">
        <text class="st-label">清除缓存</text>
        <text class="st-value">{{ cacheSize }}</text>
      </view>
      <view class="st-row">
        <text class="st-label">版本</text>
        <text class="st-value">{{ version }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
import * as http from "../../utils/request.js";
import * as dict from "../../utils/dict.js";
import apiCfg from "../../config/api.js";
const STORAGE_KEY = "appSettings";

const defaultSettings = {
  pushEnabled: true,
  soundEnabled: true,
  vibrateEnabled: true,
  darkMode: false,
  fontSize: "M"
};

const settings = ref(Object.assign({}, defaultSettings));
const cacheSize = ref("0 KB");
const version = ref("0.1.0");

const fontOptions = [
  { label: "小", value: "S" },
  { label: "中", value: "M" },
  { label: "大", value: "L" }
];

function loadLocal() {
  const raw = uni.getStorageSync(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      settings.value = Object.assign({}, defaultSettings, parsed);
    } catch (e) { /* ignore */ }
  }
}

function saveLocal() {
  uni.setStorageSync(STORAGE_KEY, settings.value);
}

async function loadServer() {
  try {
    const res = await http.get(apiCfg.me.settingsGet, null, { silent: true });
    if (res && res.data) {
      settings.value = Object.assign({}, settings.value, res.data);
      saveLocal();
    }
  } catch (e) { /* 后端桩可能未就绪，使用本地 */ }
}

async function saveServer() {
  try {
    await http.put(apiCfg.me.settingsPut, settings.value, { silent: true });
  } catch (e) { /* 静默 */ }
}

function onChange(key, e) {
  settings.value[key] = e.detail.value;
  saveLocal();
  saveServer();
}

function onFontSize(value) {
  settings.value.fontSize = value;
  saveLocal();
  saveServer();
}

function calcCacheSize() {
  try {
    const info = uni.getStorageInfoSync();
    cacheSize.value = (info.currentSize || 0) + " KB";
  } catch (e) { cacheSize.value = "0 KB"; }
}

function clearCache() {
  uni.showModal({
    title: "提示",
    content: "确认清除本地缓存？退出登录后需重新登录。",
    success: (res) => {
      if (res.confirm) {
        // 仅清字典缓存与设置缓存，保留 token 让用户主动决定退出
        dict.clearDictCache();
        uni.removeStorageSync(STORAGE_KEY);
        settings.value = Object.assign({}, defaultSettings);
        calcCacheSize();
        uni.showToast({ title: "已清除", icon: "success" });
      }
    }
  });
}

onMounted(() => {
  loadLocal();
  loadServer();
  calcCacheSize();
});
</script>

<style scoped>
.st-container {
  min-height: 100%;
  background: #f5f7fa;
}

.st-section {
  background: #fff;
  margin: 12px;
  border-radius: 12px;
  overflow: hidden;
}

.st-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
  gap: 12px;
}

.st-row:last-child {
  border-bottom: none;
}

.st-label {
  flex: 1;
  font-size: 14px;
  color: #1e293b;
}

.st-value {
  font-size: 13px;
  color: #94a3b8;
}

.st-radio-group {
  display: flex;
  gap: 6px;
}

.st-radio {
  padding: 4px 10px;
  border-radius: 4px;
  background: #f1f5f9;
  font-size: 12px;
  color: #475569;
}

.st-radio.active {
  background: #3b82f6;
  color: #fff;
}
</style>
