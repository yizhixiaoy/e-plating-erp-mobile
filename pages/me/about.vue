<template>
  <view class="ab-container">
    <view class="ab-logo">
      <text class="ab-logo-text">ERP</text>
    </view>
    <text class="ab-title">电镀ERP移动端</text>
    <text class="ab-version">v{{ version }}</text>

    <view class="ab-section">
      <text class="ab-section-title">能力概览</text>
      <view class="ab-row" v-for="f in features" :key="f.key">
        <text class="ab-dot" :class="f.ready ? 'on' : 'off'">·</text>
        <text class="ab-feature">{{ f.label }}</text>
        <text :class="['ab-tag', f.ready ? 'tag-on' : 'tag-soon']">{{ f.ready ? '已上线' : '规划中' }}</text>
      </view>
    </view>

    <view class="ab-section">
      <text class="ab-section-title">业务模块 Roadmap</text>
      <view class="ab-row" v-for="b in businessRoadmap" :key="b.key">
        <text class="ab-dot off">·</text>
        <text class="ab-feature">{{ b.label }}</text>
        <text class="ab-tag tag-soon">P{{ b.phase }}</text>
      </view>
    </view>

    <text class="ab-copyright">© 2026 E-Plating ERP</text>
  </view>
</template>

<script setup>
import { ref } from "vue";

const version = ref("0.1.0");

const features = ref([
  { key: "login", label: "账号/短信/扫码登录", ready: true },
  { key: "workbench", label: "工作台首页", ready: true },
  { key: "message", label: "消息中心", ready: true },
  { key: "todo", label: "我的待办", ready: true },
  { key: "contacts", label: "通讯录（部门+成员）", ready: true },
  { key: "scan", label: "扫一扫登录 PC 端", ready: true },
  { key: "me", label: "个人中心", ready: true },
  { key: "settings", label: "设置（推送/字号/主题）", ready: true },
  { key: "push", label: "厂商推送通道", ready: false }
]);

const businessRoadmap = ref([
  { key: "customer", label: "客户管理", phase: 2 },
  { key: "order", label: "订单管理", phase: 2 },
  { key: "production", label: "生产单流转", phase: 2 },
  { key: "report", label: "现场报工", phase: 3 },
  { key: "stock", label: "库存与发货", phase: 3 },
  { key: "report-bi", label: "经营报表", phase: 3 }
]);
</script>

<style scoped>
.ab-container {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 32px 12px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ab-logo {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.ab-logo-text {
  color: #fff;
  font-size: 22px;
  font-weight: 700;
}

.ab-title {
  font-size: 16px;
  color: #1e293b;
  font-weight: 600;
}

.ab-version {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
  margin-bottom: 24px;
}

.ab-section {
  width: 100%;
  background: #fff;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
}

.ab-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 8px;
  display: block;
}

.ab-row {
  display: flex;
  align-items: center;
  padding: 8px 0;
  gap: 8px;
}

.ab-dot {
  font-size: 22px;
  line-height: 1;
}

.ab-dot.on { color: #10b981; }
.ab-dot.off { color: #cbd5e1; }

.ab-feature {
  flex: 1;
  font-size: 13px;
  color: #475569;
}

.ab-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.tag-on {
  background: #d1fae5;
  color: #10b981;
}

.tag-soon {
  background: #fef3c7;
  color: #f59e0b;
}

.ab-copyright {
  font-size: 11px;
  color: #cbd5e1;
  margin-top: 16px;
}
</style>
