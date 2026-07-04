<script>
export default {
  onLaunch: function () {
    console.log('App Launch')
  },
  onShow: function () {
    console.log('App Show')
  },
  onHide: function () {
    console.log('App Hide')
  }
}
</script>

<style>
/* 全局设计变量 */
:root {
  /* 品牌色 */
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
  --color-gradient: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  --color-gradient-teal: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);

  /* 背景 */
  --bg-page: #f5f7fa;
  --bg-card: #ffffff;
  --bg-input: #f1f5f9;
  --bg-hover: rgba(59, 130, 246, 0.04);

  /* 文字 */
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-tertiary: #94a3b8;
  --text-white: #ffffff;
  --text-white-secondary: rgba(255,255,255,0.85);

  /* 边框 */
  --border-light: #f1f5f9;
  --border-default: #e2e8f0;
  --border-strong: #cbd5e1;

  /* 语义色 */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #3b82f6;

  /* 阴影 */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);

  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* 动画 */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.25s ease;
}

/* 全局样式 */
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

page {
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  background-color: var(--bg-page);
  color: #333;
  -webkit-font-smoothing: antialiased;
}

/* 通用滚动条隐藏 */
::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
  background: transparent;
}

/* 通用淡入动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* 通用骨架屏闪烁动画 */
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
