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
  { key: "customer", label: "客户管理", ready: true },
  { key: "order", label: "订单管理", phase: 2 },
  { key: "production", label: "生产单流转", phase: 2 },
  { key: "report", label: "现场报工", phase: 3 },
  { key: "stock", label: "库存与发货", phase: 3 },
  { key: "report-bi", label: "经营报表", phase: 3 }
]);
</script>

<style scoped>
.ab-container {
  min-height: 100%;
  background: var(--bg-page);
  padding: 40px 16px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ab-logo {
  width: 76px;
  height: 76px;
  border-radius: var(--radius-lg);
  background: var(--color-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  box-shadow: var(--shadow-md);
}

.ab-logo-text {
  color: #fff;
  font-size: 22px;
  font-weight: 700;
}

.ab-title {
  font-size: 18px;
  color: var(--text-primary);
  font-weight: 700;
  letter-spacing: 0.5px;
}

.ab-version {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
  margin-bottom: 28px;
}

.ab-section {
  width: 100%;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-sm);
}

.ab-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
  display: block;
}

.ab-row {
  display: flex;
  align-items: center;
  padding: 9px 0;
  gap: 8px;
}

.ab-dot {
  font-size: 22px;
  line-height: 1;
}

.ab-dot.on { color: var(--color-success); }
.ab-dot.off { color: var(--border-strong); }

.ab-feature {
  flex: 1;
  font-size: 14px;
  color: var(--text-secondary);
}

.ab-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-weight: 500;
}

.tag-on {
  background: #d1fae5;
  color: var(--color-success);
}

.tag-soon {
  background: #fef3c7;
  color: var(--color-warning);
}

.ab-copyright {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 24px;
}
</style>
