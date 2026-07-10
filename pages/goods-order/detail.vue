<template>
  <view :class="['go-container', showDistributeDialog ? 'dialog-open' : '']">
    <scroll-view v-if="detail" scroll-y class="detail-scroll">
      <!-- 状态标签 -->
      <view class="status-bar">
        <text :class="['status-tag', statusClass(detail.status)]">{{ statusLabel(detail.status) }}</text>
        <text class="export-link" @click="handleExport">{{ exporting ? '导出中...' : '导出 Excel' }}</text>
      </view>

      <!-- 基本信息 -->
      <view class="section">
        <view class="section-title">基本信息</view>
        <view class="info-grid">
          <view class="info-item">
            <text class="info-label">开单编号</text>
            <text class="info-value mono">{{ detail.orderNo }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">开单日期</text>
            <text class="info-value">{{ detail.orderDate }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">客户公司</text>
            <text class="info-value">{{ detail.customerName || '--' }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">开单部门</text>
            <text class="info-value">{{ detail.departmentName || '--' }}</text>
          </view>
          <view class="info-item">
            <text class="info-label">总数量</text>
            <text class="info-value">{{ detail.totalQuantity || 0 }}（{{ detail.totalItems || 0 }}项）</text>
          </view>
          <view class="info-item">
            <text class="info-label">操作人</text>
            <text class="info-value">{{ detail.operatorName || '--' }}</text>
          </view>
          <view class="info-item" v-if="detail.submittedAt">
            <text class="info-label">提交时间</text>
            <text class="info-value">{{ formatTime(detail.submittedAt) }}</text>
          </view>
          <view class="info-item" v-if="detail.distributedAt">
            <text class="info-label">分发时间</text>
            <text class="info-value">{{ formatTime(detail.distributedAt) }}</text>
          </view>
          <view class="info-item" v-if="detail.completedAt">
            <text class="info-label">完成时间</text>
            <text class="info-value">{{ formatTime(detail.completedAt) }}</text>
          </view>
        </view>
        <view class="info-item" v-if="detail.remark">
          <text class="info-label">备注</text>
          <text class="info-value">{{ detail.remark }}</text>
        </view>
      </view>

      <!-- 订单生命周期 -->
      <view class="section">
        <view class="section-title">订单生命周期</view>
        <view class="lifecycle-bar">
          <view v-for="(m, idx) in orderMilestones" :key="m.key" class="lifecycle-step">
            <view class="lifecycle-dot" :class="{ 'lifecycle-reached': m.reached }"></view>
            <text class="lifecycle-label">{{ m.label }}</text>
            <text class="lifecycle-time" v-if="m.reached">{{ m.time }}</text>
            <text class="lifecycle-time lifecycle-empty" v-else>--</text>
          </view>
        </view>
      </view>

      <!-- 货物明细 -->
      <view class="section">
        <view class="section-title">货物明细（{{ detail.items ? detail.items.length : 0 }}项）</view>
        <view v-for="(item, idx) in detail.items" :key="idx" class="item-card">
          <view class="item-card-head">
            <text class="item-name">{{ item.itemName }}</text>
            <text class="item-qty">{{ item.quantity }}{{ item.unit || '个' }}</text>
          </view>
          <view class="item-card-body">
            <view class="item-info" v-if="item.specification">
              <text class="item-label">规格</text>
              <text class="item-text">{{ item.specification }}</text>
            </view>
            <view class="item-info" v-if="item.material">
              <text class="item-label">材质</text>
              <text class="item-text">{{ item.material }}</text>
            </view>
            <view class="item-info" v-if="item.unitPrice > 0">
              <text class="item-label">单价</text>
              <text class="item-text">¥{{ item.unitPrice }}元</text>
            </view>
            <view class="item-info" v-if="item.totalPrice > 0">
              <text class="item-label">总价</text>
              <text class="item-text bold">¥{{ item.totalPrice }}元</text>
            </view>
          </view>
          <view v-if="item.photoUrls && item.photoUrls.length > 0" class="item-photos">
            <image v-for="(url, pIdx) in item.photoUrls" :key="pIdx" :src="url" class="item-photo" mode="aspectFill" @click="previewPhoto(item.photoUrls, pIdx)" />
          </view>
          <text v-if="item.remark" class="item-remark">{{ item.remark }}</text>
        </view>
      </view>

      <!-- 加工节点（按货物分组） -->
      <view class="section" v-if="nodesByItem.length > 0">
        <view class="section-title">加工进度</view>
        <view v-for="(group, gi) in nodesByItem" :key="gi" class="item-flow-group">
          <!-- 货物标题 -->
          <view class="item-flow-header">
            <text class="item-flow-icon">📦</text>
            <text class="item-flow-name">{{ group.itemName }}</text>
            <text class="item-flow-count">{{ group.nodes.length }}个节点</text>
          </view>
          <!-- 该货物的节点列表 -->
          <view class="node-list">
            <view v-for="(node, idx) in group.nodes" :key="idx" class="node-card" :class="'nc-' + node.status">
              <!-- 左侧状态指示条 -->
              <view class="nc-bar" :class="'ncb-' + node.status"></view>
              <view class="nc-body">
                <!-- 头部：序号+部门+状态 -->
                <view class="nc-head">
                  <view class="nc-head-left">
                    <view class="nc-idx" :class="'nci-' + node.status">{{ node.nodeOrder || idx + 1 }}</view>
                    <view class="nc-dept-wrap">
                      <text class="nc-dept">{{ node.departmentName }}</text>
                      <text v-if="node.originalOrder == null" class="nc-tag nc-tag-new">新增</text>
                      <text v-else-if="node.rollbackCount > 0" class="nc-tag nc-tag-reset">重置×{{ node.rollbackCount }}</text>
                    </view>
                  </view>
                  <view class="nc-badge" :class="'ncb-s-' + node.status">
                    <text v-if="node.status === 'PROCESSED'" class="nc-badge-icon">✓</text>
                    <text class="nc-badge-text">{{ nodeStatusLabel(node.status) }}</text>
                  </view>
                </view>
                <!-- 加工数据 -->
                <view class="nc-data" v-if="node.processedQuantity != null || node.lossQuantity > 0">
                  <view class="nc-data-item">
                    <text class="nc-data-label">原始</text>
                    <text class="nc-data-val">{{ node.originalQuantity || 0 }}</text>
                  </view>
                  <view class="nc-data-item" v-if="node.processedQuantity != null">
                    <text class="nc-data-label">加工后</text>
                    <text class="nc-data-val nc-data-green">{{ node.processedQuantity }}</text>
                  </view>
                  <view class="nc-data-item" v-if="node.lossQuantity > 0">
                    <text class="nc-data-label">损耗</text>
                    <text class="nc-data-val nc-data-red">{{ node.lossQuantity }}</text>
                  </view>
                </view>
                <!-- 操作人+时间 -->
                <view class="nc-meta" v-if="node.operatorName">
                  <text class="nc-meta-text">{{ node.operatorName }}</text>
                  <text class="nc-meta-text" v-if="node.processedAt">{{ formatTime(node.processedAt) }}</text>
                </view>
                <!-- 回退原因 -->
                <view v-if="node.rollbackReason" class="nc-reason">
                  <text class="nc-reason-text">回退原因: {{ node.rollbackReason }}</text>
                </view>
                <text v-if="node.remark" class="nc-remark">{{ node.remark }}</text>
                <!-- 操作按钮区：仅对 PENDING/PROCESSING 显示 -->
                <view v-if="detail.status === 'PROCESSING' && node.status !== 'COMPLETED' && node.status !== 'PROCESSED' && node.status !== 'ROLLED_BACK'" class="nc-actions">
                  <template v-if="isNodeOperable(node)">
                    <button v-if="canOperateNode(node)" class="nc-btn nc-btn-primary" @click.stop="handleNodeAdvance(node)">
                      {{ nodeActionLabel(node.status, node) }}
                    </button>
                    <button v-if="node.status === 'PENDING' && canRollbackPrevNode(node)" class="nc-btn nc-btn-rollback" @click.stop="handleRollback(node)">
                      回退上一节点
                    </button>
                    <text v-if="!canOperateNode(node)" class="nc-locked">非本部门不可操作</text>
                  </template>
                  <text v-else class="nc-locked">等待上一节点完成</text>
                </view>
                <!-- 已回退节点标记 -->
                <view v-if="node.status === 'ROLLED_BACK'" class="nc-rolled-back-tag">
                  <text class="nc-rolled-back-text">已回退</text>
                </view>
                <!-- 变更记录 -->
                <view class="nc-history" @click.stop="loadNodeHistory(node)">
                  <text class="nc-history-text">查看变更记录</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 底部留白 -->
      <view style="height: 160rpx;"></view>
    </scroll-view>

    <!-- 加载状态 -->
    <view v-else class="loading-state">
      <text>加载中...</text>
    </view>

    <!-- 底部操作栏（分发弹窗打开时隐藏，避免键盘弹出时被顶起） -->
    <view class="footer-bar" v-if="detail && !showDistributeDialog">
      <!-- 草稿状态 -->
      <view v-if="detail.status === 'DRAFT'" style="display:flex;gap:20rpx;width:100%;">
        <button class="btn-edit" @click="goEdit">编辑开单</button>
        <button class="btn-cancel" @click="handleCancel">取消开单</button>
        <button class="btn-submit" @click="handleSubmit">提交开单</button>
      </view>
      <!-- 待分发状态 -->
      <view v-else-if="detail.status === 'PENDING_DISTRIBUTE'" style="display:flex;gap:20rpx;width:100%;">
        <button class="btn-cancel" @click="handleCancelDistribute">取消分发</button>
        <button class="btn-distribute" @click="showDistributeDialog = true">分发至部门</button>
      </view>
      <!-- 已取消 - 可重新提交 -->
      <view v-else-if="detail.status === 'CANCELLED'" style="display:flex;gap:20rpx;width:100%;">
        <button class="btn-submit" @click="handleResubmit">重新提交</button>
      </view>
    </view>

    <!-- 分发加工节点编排弹层 - 每个货物独立配置 -->
    <view v-if="showDistributeDialog" class="img-overlay" @click="showDistributeDialog = false">
      <view class="dist-panel" @click.stop :style="{ paddingBottom: keyboardHeight > 0 ? keyboardHeight + 'px' : '' }">
        <view class="dist-panel-head">
          <view class="dist-panel-head-line"></view>
          <text class="dist-panel-title">配置加工流程</text>
          <text class="dist-panel-close" @click="showDistributeDialog = false">✕</text>
        </view>

        <!-- 每个货物独立配置加工步骤 -->
        <scroll-view scroll-y class="dist-items-scroll">
          <view v-for="(item, idx) in distributeOrderItems" :key="item.id" class="dist-item-card">
            <view class="dist-item-card-head">
              <view style="display:flex;align-items:center;gap:10rpx;flex:1;min-width:0;">
                <view class="dist-step-number">{{ idx + 1 }}</view>
                <text class="dist-item-name">{{ item.itemName }}</text>
                <text class="dist-item-qty">{{ item.quantity }}{{ item.unit || '个' }}</text>
              </view>
              <view style="display:flex;gap:8rpx;flex-shrink:0;">
                <text v-if="idx > 0" class="dist-item-action" @click="copyStepsFromPrev(idx)">复制</text>
                <text v-if="getItemSteps(item.id).length > 0" class="dist-item-action dist-item-clear" @click="clearItemSteps(item.id)">清空</text>
              </view>
            </view>

            <!-- 已选步骤 -->
            <view class="dist-item-steps">
              <view v-if="getItemSteps(item.id).length === 0" class="dist-steps-empty">
                <text>点击下方部门添加加工节点</text>
              </view>
              <view v-for="(step, si) in getItemSteps(item.id)" :key="si" class="dist-step-chip">
                <text class="dist-step-chip-num">{{ si + 1 }}</text>
                <text class="dist-step-chip-name">{{ step.departmentName }}</text>
                <text class="dist-step-chip-del" @click="removeItemStep(item.id, si)">✕</text>
              </view>
            </view>

            <!-- 为此货物添加部门 -->
            <view class="dist-item-dept-btns">
              <view v-for="d in filteredDistributeDeptOptions" :key="d.id" class="dist-dept-btn" @click="addItemStep(item.id, d)">
                <text>+ {{ d.deptName }}</text>
              </view>
              <view v-if="filteredDistributeDeptOptions.length === 0 && !distributeDeptLoading" class="dist-steps-empty" style="padding:12rpx 0;font-size:22rpx;">
                <text>暂无可用部门</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <!-- 部门搜索 -->
        <view class="dist-avail-search">
          <text class="dist-avail-search-icon">🔍</text>
          <input v-model="deptKeyword" class="dist-avail-search-input" placeholder="搜索部门名称" />
          <text v-if="deptKeyword" class="dist-avail-search-clear" @click="deptKeyword = ''">✕</text>
        </view>

        <!-- 确认按钮 -->
        <view class="dist-confirm-bar" v-if="canDistribute">
          <button class="dist-confirm-btn" @click="handleDistribute">确认分发</button>
        </view>
      </view>
    </view>

    <!-- 录入加工数据弹窗 -->
    <view v-if="showProcessDialog" class="img-overlay" @click="showProcessDialog = false">
      <view class="proc-panel" @click.stop>
        <view class="proc-panel-head">
          <view class="dist-panel-head-line"></view>
          <text class="proc-panel-title">录入加工数据</text>
          <text class="dist-panel-close" @click="showProcessDialog = false">✕</text>
        </view>
        <view class="proc-panel-body">
          <view class="proc-info">
            <text class="proc-info-label">节点</text>
            <text class="proc-info-value">{{ processNode?.departmentName }}</text>
          </view>
          <view class="proc-info">
            <text class="proc-info-label">原始数量</text>
            <text class="proc-info-value">{{ processNode?.originalQuantity }}</text>
          </view>
          <view class="proc-field">
            <text class="proc-field-label">加工后数量（不超过 {{ processNode?.originalQuantity }}）</text>
            <input class="proc-field-input" type="digit" v-model="processQuantity" @blur="onQuantityBlur" placeholder="请输入加工后数量" />
          </view>
          <view class="proc-field">
            <text class="proc-field-label">备注（可选）</text>
            <input class="proc-field-input" v-model="processRemark" placeholder="备注信息" />
          </view>
          <view v-if="processLoss >= 0" class="proc-loss">
            <text>预估损耗: {{ processLoss }}</text>
          </view>
        </view>
        <view class="proc-panel-footer">
          <button class="proc-cancel" @click="showProcessDialog = false">取消</button>
          <button class="proc-confirm" :disabled="!processQuantity || processSubmitting" @click="handleSubmitProcess">
            {{ processSubmitting ? '提交中...' : '确认提交' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 回退节点弹窗 -->
    <view v-if="showRollbackDialog" class="img-overlay" @click="showRollbackDialog = false">
      <view class="proc-panel" @click.stop>
        <view class="proc-panel-head">
          <view class="dist-panel-head-line"></view>
          <text class="proc-panel-title">回退上一节点</text>
          <text class="dist-panel-close" @click="showRollbackDialog = false">✕</text>
        </view>
        <view class="proc-panel-body">
          <view class="proc-info">
            <text class="proc-info-label">回退到</text>
            <text class="proc-info-value">{{ rollbackTargetNode?.departmentName }}（{{ nodeStatusLabel(rollbackTargetNode?.status) }}）</text>
          </view>
          <view class="proc-info">
            <text class="proc-info-label">当前节点</text>
            <text class="proc-info-value">{{ rollbackNode?.departmentName }}（{{ nodeStatusLabel(rollbackNode?.status) }}）</text>
          </view>
          <view style="margin-top: 16rpx; padding: 16rpx; background: #fef2f2; border-radius: 12rpx;">
            <text style="font-size: 24rpx; color: #dc2626;">当前节点将标记为已回退，并在后方插入两个新节点重新加工。</text>
          </view>
          <view class="proc-field" style="margin-top: 20rpx;">
            <text class="proc-field-label">回退原因（必填）</text>
            <textarea class="proc-field-textarea" v-model="rollbackReason" placeholder="请输入回退原因" maxlength="200" />
          </view>
        </view>
        <view class="proc-panel-footer">
          <button class="proc-cancel" @click="showRollbackDialog = false">取消</button>
          <button class="proc-confirm proc-confirm-danger" :disabled="!rollbackReason.trim() || rollbackSubmitting" @click="handleSubmitRollback">
            {{ rollbackSubmitting ? '回退中...' : '确认回退' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 节点版本历史弹窗 -->
    <view v-if="showNodeHistoryDialog" class="img-overlay" @click="showNodeHistoryDialog = false">
      <view class="proc-panel" @click.stop style="max-height: 70vh; overflow-y: auto;">
        <view class="proc-panel-head">
          <view class="dist-panel-head-line"></view>
          <text class="proc-panel-title">{{ nodeHistoryNode?.departmentName }} - 变更记录</text>
          <text class="dist-panel-close" @click="showNodeHistoryDialog = false">✕</text>
        </view>
        <view class="proc-panel-body" style="max-height: 50vh; overflow-y: auto;">
          <view v-if="nodeHistoryLoading" style="text-align: center; padding: 40rpx 0; color: #94a3b8;">
            <text>加载中...</text>
          </view>
          <view v-else-if="nodeHistoryLogs.length > 0">
            <view v-for="(log, idx) in nodeHistoryLogs" :key="idx" class="version-log-item">
              <view class="version-log-head">
                <text class="version-log-type">{{ log.changeTypeName || '变更' }}</text>
                <text class="version-log-time">{{ formatTime(log.changedAt) }}</text>
              </view>
              <view class="version-log-body">
                <!-- Map格式多字段 -->
                <view v-if="parseChangeFields(log.oldValue, log.newValue).length > 0">
                  <view v-for="(f, fi) in parseChangeFields(log.oldValue, log.newValue)" :key="fi" class="version-log-field-row">
                    <text class="version-log-field-label">{{ f.label }}</text>
                    <text v-if="f.oldVal !== '—'" class="version-log-old">{{ f.oldVal }}</text>
                    <text v-if="f.oldVal !== '—' && f.newVal !== '—'" class="version-log-arrow"> → </text>
                    <text v-if="f.newVal !== '—'" class="version-log-new">{{ f.newVal }}</text>
                  </view>
                </view>
                <!-- 单字段旧格式 -->
                <view v-else>
                  <text v-if="log.fieldName" class="version-log-field" style="font-weight: 500; color: #334155;">{{ nodeFieldLabel(log.fieldName) }}</text>
                  <view v-if="log.oldValue != null || log.newValue != null" class="version-log-change">
                    <text v-if="log.oldValue != null" class="version-log-old">{{ translateChangeValue(log.fieldName, log.oldValue) }}</text>
                    <text v-if="log.newValue != null" class="version-log-arrow"> → </text>
                    <text v-if="log.newValue != null" class="version-log-new" style="font-weight: 500;">{{ translateChangeValue(log.fieldName, log.newValue) }}</text>
                  </view>
                </view>
                <text v-if="log.remark" class="version-log-remark">{{ log.remark }}</text>
              </view>
              <view class="version-log-footer">
                <text class="version-log-operator">操作人: {{ log.changedByName || '--' }}</text>
              </view>
            </view>
          </view>
          <view v-else style="text-align: center; padding: 40rpx 0; color: #94a3b8;">
            <text>暂无变更记录</text>
          </view>
        </view>
      </view>
    </view>

    <ConfirmDialog />
  </view>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import * as http from "../../utils/request.js";
import * as auth from "../../utils/auth.js";
import { fetchDictData, getDictLabel } from "../../utils/dict.js";
import apiCfg from "../../config/api.js";
import { showConfirm } from "../../utils/dialog.js";

const props = defineProps({
  id: String,
  orderNo: String,
  itemId: String
});

const detail = ref(null);

// 字典：节点状态
const nodeStatusItems = ref([]);

// 按货物分组加工节点
const nodesByItem = computed(() => {
  if (!detail.value || !detail.value.nodes) return [];
  const map = {};
  for (const node of detail.value.nodes) {
    const key = String(node.itemId || 0);
    if (!map[key]) {
      map[key] = { itemId: node.itemId, itemName: node.itemName || '未知货物', nodes: [] };
    }
    map[key].nodes.push(node);
  }
  // 每个货物内的节点按 nodeOrder 升序排列
  for (const group of Object.values(map)) {
    group.nodes.sort((a, b) => (a.nodeOrder || 0) - (b.nodeOrder || 0));
  }
  return Object.values(map);
});
const showDistributeDialog = ref(false);
const distributeDeptOptions = ref([]);
const distributeDeptLoading = ref(false);
// 每个货物独立的加工步骤: { [itemId]: [{ departmentId, departmentName }] }
const distributeItemStepsMap = ref({});
const distributeOrderItems = ref([]);
const deptKeyword = ref("");
const keyboardHeight = ref(0);

// 所有货物都至少配了一个步骤才能分发
const canDistribute = computed(() => {
  if (distributeOrderItems.value.length === 0) return false;
  return distributeOrderItems.value.every(item => getItemSteps(item.id).length > 0);
});

function getItemSteps(itemId) {
  return distributeItemStepsMap.value[itemId] || [];
}

function addItemStep(itemId, d) {
  const map = distributeItemStepsMap.value;
  if (!map[itemId]) map[itemId] = [];
  map[itemId].push({ departmentId: d.id, departmentName: d.deptName });
  distributeItemStepsMap.value = { ...map };
}

function removeItemStep(itemId, idx) {
  const map = distributeItemStepsMap.value;
  if (map[itemId]) {
    map[itemId].splice(idx, 1);
    distributeItemStepsMap.value = { ...map };
  }
}

function clearItemSteps(itemId) {
  const map = distributeItemStepsMap.value;
  if (map[itemId]) {
    map[itemId] = [];
    distributeItemStepsMap.value = { ...map };
  }
}

function copyStepsFromPrev(idx) {
  const prev = distributeOrderItems.value[idx - 1];
  const cur = distributeOrderItems.value[idx];
  if (prev && cur) {
    const prevSteps = getItemSteps(prev.id);
    const map = distributeItemStepsMap.value;
    map[cur.id] = prevSteps.map(s => ({ ...s }));
    distributeItemStepsMap.value = { ...map };
  }
}

// 节点版本历史（按节点查看）
const showNodeHistoryDialog = ref(false);
const nodeHistoryNode = ref(null);
const nodeHistoryLogs = ref([]);
const nodeHistoryLoading = ref(false);

async function loadNodeHistory(node) {
  nodeHistoryNode.value = node;
  nodeHistoryLogs.value = [];
  showNodeHistoryDialog.value = true;
  nodeHistoryLoading.value = true;
  try {
    const url = apiCfg.getUrl('/goods/versions/nodes/' + node.id + '/logs');
    const res = await http.get(url);
    nodeHistoryLogs.value = res.data || [];
  } catch {
    nodeHistoryLogs.value = [];
  } finally {
    nodeHistoryLoading.value = false;
  }
}

// 订单生命周期里程碑：开单 → 分发 → 加工中 → 完成
const orderMilestones = computed(() => {
  if (!detail.value) return [];
  const d = detail.value;
  const firstProcessed = d.nodes?.find(n => n.processedAt);
  return [
    { key: 'created', label: '开单', reached: true, time: d.orderDate || '' },
    { key: 'distributed', label: '分发', reached: !!d.distributedAt, time: d.distributedAt ? formatTime(d.distributedAt) : '' },
    { key: 'processing', label: '加工中', reached: !!firstProcessed, time: firstProcessed?.processedAt ? formatTime(firstProcessed.processedAt) : '' },
    { key: 'completed', label: '完成', reached: !!d.completedAt, time: d.completedAt ? formatTime(d.completedAt) : '' }
  ];
});


// 导出
const exporting = ref(false);

/** 模糊筛选后的可选部门 */
const filteredDistributeDeptOptions = computed(() => {
  const kw = deptKeyword.value.trim().toLowerCase();
  if (!kw) return distributeDeptOptions.value;
  return distributeDeptOptions.value.filter(d => (d.deptName || "").toLowerCase().includes(kw));
});

// 部门选项是否已加载过（避免每次都重新请求）
let deptOptionsLoaded = false;

function statusClass(status) {
  const map = { DRAFT: "draft", PENDING_DISTRIBUTE: "pending", PROCESSING: "processing", COMPLETED: "completed", CANCELLED: "cancelled" };
  return map[status] || "";
}

function statusLabel(status) {
  const map = { DRAFT: "草稿", PENDING_DISTRIBUTE: "待分发", PROCESSING: "加工中", COMPLETED: "已完成", CANCELLED: "已取消" };
  return map[status] || status;
}

function nodeStatusLabel(status) {
  return getDictLabel(nodeStatusItems.value, status) || status;
}

// 字段名中文映射
function nodeFieldLabel(fieldName) {
  const map = {
    processedQuantity: '加工后数量',
    lossQuantity: '损耗数量',
    remark: '备注',
    status: '状态',
    operatorName: '操作人',
    processedAt: '加工时间',
    rollback: '回退',
    deleted: '删除'
  };
  return map[fieldName] || fieldName;
}

// 解析 Map 格式的 oldValue/newValue
function parseChangeFields(oldValue, newValue) {
  const result = [];
  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(oldValue) && !isObj(newValue)) return result;
  const keys = new Set([...Object.keys(isObj(oldValue) ? oldValue : {}), ...Object.keys(isObj(newValue) ? newValue : {})]);
  keys.forEach(k => {
    const o = isObj(oldValue) ? oldValue[k] : undefined;
    const n = isObj(newValue) ? newValue[k] : undefined;
    result.push({ label: nodeFieldLabel(k), oldVal: (o == null || o === '') ? '—' : String(o), newVal: (n == null || n === '') ? '—' : String(n) });
  });
  return result;
}

// 翻译变更记录中的值（状态码→中文标签）
function translateChangeValue(fieldName, value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (fieldName === 'status') return getDictLabel(nodeStatusItems.value, String(value)) || String(value);
  return String(value);
}

// ====== 节点操作功能 ======
const showProcessDialog = ref(false);
const processNode = ref(null);
const processQuantity = ref('');
const processRemark = ref('');
const processSubmitting = ref(false);

const processLoss = computed(() => {
  if (!processNode.value || !processQuantity.value) return -1;
  const orig = Number(processNode.value.originalQuantity) || 0;
  const proc = Number(processQuantity.value) || 0;
  return Math.max(0, orig - proc);
});

// 失焦时校验加工数量：自动校正到有效范围 [0, originalQuantity]
function onQuantityBlur() {
  const val = processQuantity.value;
  if (val === '' || val == null) return;
  const num = Number(val);
  if (isNaN(num) || num < 0) {
    processQuantity.value = '';
    return;
  }
  if (processNode.value) {
    const max = Number(processNode.value.originalQuantity);
    if (num > max) {
      processQuantity.value = String(max);
      uni.showToast({ title: '已自动修正为最大数量 ' + max, icon: 'none' });
    }
  }
}

function nodeActionLabel(status, node) {
  const map = {
    PENDING: '录入加工',
    PROCESSING: '录入加工',
    PROCESSED: '确认完成'
  };
  return map[status] || '操作';
}

function nodeNextStatus(status, node) {
  const map = {
    PENDING: 'PROCESSING',
    PROCESSING: 'PROCESSED',
    PROCESSED: 'COMPLETED'
  };
  return map[status] || null;
}

// 判断节点是否可操作：上一节点必须已加工完成（PROCESSED、ROLLED_BACK或COMPLETED）
function isNodeOperable(node) {
  if (!node || !node.nodeOrder || node.nodeOrder <= 1) return true;
  if (!detail.value || !detail.value.nodes) return false;
  const prevNode = detail.value.nodes.find(n =>
    String(n.itemId) === String(node.itemId) && n.nodeOrder === (node.nodeOrder - 1)
  );
  if (!prevNode) return false; // 找不到前驱节点，保守返回不可操作
  return ['PROCESSED', 'COMPLETED', 'ROLLED_BACK'].includes(prevNode.status);
}

// 判断节点是否为该货物的最后一个节点
function isLastNodeInItem(node) {
  if (!detail.value?.nodes) return true;
  const itemId = String(node.itemId);
  const nodeOrder = node.nodeOrder;
  return !detail.value.nodes.some(n => String(n.itemId) === itemId && n.nodeOrder > nodeOrder);
}

// 判断当前用户是否有权限操作该节点（部门匹配或平台用户）
function canOperateNode(node) {
  const user = auth.getUserInfo();
  if (!user) return false;
  if (user.userType === 0) return true; // 平台用户可操作所有节点
  return user.deptId != null && String(user.deptId) === String(node.departmentId);
}

// 查找当前节点的前驱 PROCESSED 节点（跳过 ROLLED_BACK 和同部门节点）
function findPrevProcessedNode(node) {
  if (!detail.value?.nodes) return null;
  const candidates = detail.value.nodes
    .filter(n => String(n.itemId) === String(node.itemId) && n.nodeOrder < node.nodeOrder)
    .sort((a, b) => b.nodeOrder - a.nodeOrder);
  for (const n of candidates) {
    if (n.status === 'ROLLED_BACK') continue; // 跳过已回退节点
    if (n.status === 'PROCESSED') {
      // 跳过同部门的节点（如B新跳过B，找到A）
      if (String(n.departmentId) === String(node.departmentId)) continue;
      return n;
    }
    break; // 遇到其他状态停止
  }
  return null;
}

// 判断当前 PENDING 节点是否可回退其上一节点
// 规则：当前节点是 PENDING，且前驱节点是 PROCESSED（跳过 ROLLED_BACK）
// 权限：仅当前 PENDING 节点的部门可操作
function canRollbackPrevNode(node) {
  if (node.status !== 'PENDING') return false;
  const prevProcessed = findPrevProcessedNode(node);
  if (!prevProcessed) return false;
  const user = auth.getUserInfo();
  if (!user) return false;
  if (user.userType === 0) return true;
  if (user.deptId == null) return false;
  return String(user.deptId) === String(node.departmentId);
}

async function handleNodeAdvance(node) {
  // PENDING/PROCESSING 状态需要录入加工数据，打开弹窗
  if (node.status === 'PENDING' || node.status === 'PROCESSING') {
    processNode.value = node;
    processQuantity.value = '';
    processRemark.value = '';
    showProcessDialog.value = true;
    return;
  }
  // 其他状态直接推进
  const nextStatus = nodeNextStatus(node.status, node);
  if (!nextStatus) return;
  const label = nodeActionLabel(node.status, node);
  try {
    await showConfirm('确认操作', `确认将「${node.departmentName}」节点推进为「${nodeStatusLabel(nextStatus)}」？`);
  } catch { return; }
  try {
    const userInfo = auth.getUserInfo();
    const url = apiCfg.getUrl('/goods/process/' + node.id + '/status');
    await http.post(url, {
      nodeId: node.id,
      targetStatus: nextStatus,
      operatorId: userInfo?.userId || 0,
      operatorName: userInfo?.realName || ''
    });
    uni.showToast({ title: '状态更新成功', icon: 'success' });
    setTimeout(() => loadDetail(), 500);
  } catch { /* handled */ }
}

async function handleSubmitProcess() {
  if (!processNode.value || !processQuantity.value) return;
  const qty = Number(processQuantity.value);
  const orig = Number(processNode.value.originalQuantity);
  if (qty > orig) {
    uni.showToast({ title: '加工后数量不能大于原始数量(' + orig + ')', icon: 'none' });
    return;
  }
  if (qty < 0) {
    uni.showToast({ title: '加工后数量不能为负数', icon: 'none' });
    return;
  }
  processSubmitting.value = true;
  try {
    const userInfo = auth.getUserInfo();
    const url = apiCfg.getUrl('/goods/process');
    await http.post(url, {
      nodeId: processNode.value.id,
      processedQuantity: qty,
      remark: processRemark.value || null,
      operatorId: userInfo?.userId || 0,
      operatorName: userInfo?.realName || ''
    });
    showProcessDialog.value = false;
    uni.showToast({ title: '加工数据提交成功', icon: 'success' });
    setTimeout(() => loadDetail(), 500);
  } catch { /* handled */ }
  processSubmitting.value = false;
}

// ====== 回退节点功能 ======
const showRollbackDialog = ref(false);
const rollbackNode = ref(null);
const rollbackTargetNode = ref(null); // 被回退的 PROCESSED 节点
const rollbackReason = ref('');
const rollbackSubmitting = ref(false);

function handleRollback(node) {
  // node 是当前 PENDING 节点，找到它的前驱 PROCESSED 节点（跳过 ROLLED_BACK）作为回退目标
  rollbackNode.value = node;
  rollbackTargetNode.value = findPrevProcessedNode(node);
  rollbackReason.value = '';
  showRollbackDialog.value = true;
}

async function handleSubmitRollback() {
  if (!rollbackNode.value || !rollbackReason.value.trim()) return;
  rollbackSubmitting.value = true;
  try {
    const userInfo = auth.getUserInfo();
    const url = apiCfg.getUrl('/goods/process/' + rollbackNode.value.id + '/rollback');
    await http.post(url, {
      nodeId: rollbackNode.value.id,
      operatorId: userInfo?.userId || 0,
      operatorName: userInfo?.realName || '',
      reason: rollbackReason.value.trim()
    });
    showRollbackDialog.value = false;
    uni.showToast({ title: '回退成功', icon: 'success' });
    setTimeout(() => loadDetail(), 500);
  } catch { /* handled */ }
  rollbackSubmitting.value = false;
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return y + "-" + m + "-" + day + " " + h + ":" + min;
}

function previewPhoto(urls, idx) {
  uni.previewImage({ urls, current: idx });
}

async function loadDetail() {
  try {
    const orderId = props.id;
    if (!orderId) return;
    const url = apiCfg.getUrl("/goods/orders/" + orderId);
    const res = await http.get(url);
    detail.value = res.data;
  } catch {
    uni.showToast({ title: "加载失败", icon: "none" });
  }
}

async function loadDistributeDepts() {
  if (distributeDeptLoading.value) return;
  distributeDeptLoading.value = true;
  try {
    const userInfo = auth.getUserInfo();
    const tenantId = userInfo?.tenantId;
    const params = tenantId ? { tenantId } : null;
    const url = apiCfg.getUrl("/depts/options");
    console.log("[distribute] 请求部门选项:", url, "params:", params);
    const res = await http.get(url, params, { silent: true });
    console.log("[distribute] 部门选项响应:", JSON.stringify(res.data));
    distributeDeptOptions.value = res.data || [];
    deptOptionsLoaded = true;
    if (distributeDeptOptions.value.length === 0) {
      console.warn("[distribute] 部门列表为空，请检查租户下是否已创建部门");
    }
  } catch (e) {
    console.error("[distribute] 加载部门选项失败:", e);
    distributeDeptOptions.value = [];
  } finally {
    distributeDeptLoading.value = false;
  }
}

async function handleSubmit() {
  const confirmed = await showConfirm({
    title: "确认提交",
    content: "提交后无法修改，确认提交开单 " + detail.value.orderNo + "？"
  });
  if (!confirmed) return;
  try {
    const url = apiCfg.getUrl("/goods/orders/" + props.id + "/submit");
    await http.post(url, {});
    uni.showToast({ title: "提交成功", icon: "success" });
    setTimeout(() => loadDetail(), 500);
  } catch { /* handled */ }
}

async function handleCancel() {
  const action = detail.value.status === "DRAFT" ? "取消" : "取消分发";
  const confirmed = await showConfirm({
    title: "确认" + action,
    content: "确认" + action + "开单 " + detail.value.orderNo + "？"
  });
  if (!confirmed) return;
  try {
    const url = apiCfg.getUrl("/goods/orders/" + props.id + "/cancel");
    await http.post(url, {});
    uni.showToast({ title: action + "成功", icon: "success" });
    setTimeout(() => loadDetail(), 500);
  } catch { /* handled */ }
}

async function handleDistribute() {
  const itemSteps = distributeOrderItems.value
    .filter(item => getItemSteps(item.id).length > 0)
    .map(item => ({
      itemId: item.id,
      steps: getItemSteps(item.id)
    }));
  if (itemSteps.length === 0) {
    uni.showToast({ title: "请至少为一个货物配置加工节点", icon: "none" });
    return;
  }
  try {
    const url = apiCfg.getUrl("/goods/orders/" + props.id + "/distribute");
    await http.post(url, { itemSteps, operatorId: 0 });
    showDistributeDialog.value = false;
    distributeItemStepsMap.value = {};
    distributeOrderItems.value = [];
    uni.showToast({ title: "分发成功", icon: "success" });
    setTimeout(() => loadDetail(), 500);
  } catch { /* handled */ }
}

async function handleCancelDistribute() {
  const confirmed = await showConfirm({
    title: "取消分发",
    content: "确认取消分发开单 " + detail.value.orderNo + "？取消后可重新提交。"
  });
  if (!confirmed) return;
  try {
    const url = apiCfg.getUrl("/goods/orders/" + props.id + "/cancel-distribute");
    await http.post(url, {});
    uni.showToast({ title: "已取消分发", icon: "success" });
    setTimeout(() => loadDetail(), 500);
  } catch { /* handled */ }
}

async function handleResubmit() {
  const confirmed = await showConfirm({
    title: "重新提交",
    content: "确认重新提交开单 " + detail.value.orderNo + "？"
  });
  if (!confirmed) return;
  try {
    const url = apiCfg.getUrl("/goods/orders/" + props.id + "/resubmit");
    await http.post(url, {});
    uni.showToast({ title: "已重新提交", icon: "success" });
    setTimeout(() => loadDetail(), 500);
  } catch { /* handled */ }
}

function goEdit() {
  uni.navigateTo({
    url: "/pages/goods-order/order?id=" + props.id
  });
}


async function handleExport() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const token = uni.getStorageSync("token");
    const exportUrl = apiCfg.apiBase + "/goods/export/" + props.id + "/excel";
    uni.showLoading({ title: "导出中..." });
    const res = await uni.downloadFile({
      url: exportUrl,
      header: { Authorization: "Bearer " + token }
    });
    uni.hideLoading();
    if (res.statusCode === 200 && res.tempFilePath) {
      await uni.openDocument({ filePath: res.tempFilePath });
      uni.showToast({ title: "导出成功", icon: "success" });
    } else {
      uni.showToast({ title: "导出失败", icon: "none" });
    }
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: "导出失败", icon: "none" });
  } finally {
    exporting.value = false;
  }
}

function goBack() {
  uni.navigateBack({ delta: 1 });
}

// 打开分发弹窗时懒加载部门选项，并初始化货物列表
watch(showDistributeDialog, (val) => {
  if (val) {
    if (!deptOptionsLoaded) {
      loadDistributeDepts();
    }
    // 从已加载的详情中提取货物列表
    if (detail.value?.items) {
      distributeOrderItems.value = detail.value.items.map(it => ({
        id: it.id,
        itemName: it.itemName || '未知',
        quantity: it.quantity || 0,
        unit: it.unit || '个'
      }));
    }
    distributeItemStepsMap.value = {};
  } else {
    distributeItemStepsMap.value = {};
    distributeOrderItems.value = [];
  }
});

let _kbHandler = null;
onMounted(() => {
  loadDetail();
  fetchDictData('goods_node_status').then(items => { nodeStatusItems.value = items; });
  _kbHandler = uni.onKeyboardHeightChange(res => {
    keyboardHeight.value = res.height || 0;
  });
});
onUnmounted(() => {
  if (_kbHandler) _kbHandler();
});

onShow(() => {
  // 从编辑页返回时重新加载最新数据
  loadDetail();
});
</script>

<style>
page {
  background-color: #f5f7fa;
}
</style>

<style scoped>
.go-container { display: flex; flex-direction: column; height: 100vh; }

.detail-scroll { flex: 1; height: 0; width: 100%; box-sizing: border-box; padding: 20rpx 0; }
.loading-state { text-align: center; padding: 120rpx 0; color: #94a3b8; font-size: 28rpx; }

.status-bar { padding: 16rpx 24rpx; display: flex; align-items: center; }
.status-tag { font-size: 24rpx; padding: 6rpx 20rpx; border-radius: 8rpx; }
.status-tag.draft { background: #f1f5f9; color: #64748b; }
.status-tag.pending { background: #fef3c7; color: #d97706; }
.status-tag.processing { background: #dbeafe; color: #2563eb; }
.status-tag.completed { background: #d1fae5; color: #059669; }
.status-tag.cancelled { background: #fee2e2; color: #dc2626; }
.export-link { font-size: 24rpx; color: #3b82f6; margin-left: auto; padding: 6rpx 16rpx; }

.section { background: #fff; border-radius: 16rpx; padding: 24rpx; margin: 0 24rpx 20rpx; transition: background 0.2s; }
/* 弹窗打开时卡片变暗，与新增开单弹窗体验一致 */
.dialog-open .section { background: #e4e6eb; }
.section-title { font-size: 30rpx; font-weight: 600; color: #1e293b; margin-bottom: 16rpx; }

.info-grid { display: flex; flex-wrap: wrap; }
.info-item { width: 50%; margin-bottom: 16rpx; }
.info-item:last-child:nth-child(odd) { width: 100%; }
.info-label { font-size: 24rpx; color: #94a3b8; display: block; margin-bottom: 4rpx; }
.info-value { font-size: 28rpx; color: #334155; }
.info-value.mono { font-family: monospace; letter-spacing: 1rpx; }

.item-card { background: #f8fafc; border-radius: 12rpx; padding: 20rpx; margin-bottom: 16rpx; }
.item-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.item-name { font-size: 30rpx; font-weight: 600; color: #1e293b; }
.item-qty { font-size: 28rpx; color: #3b82f6; font-weight: 500; }
.item-card-body { margin-bottom: 12rpx; }
.item-info { display: flex; padding: 4rpx 0; }
.item-label { width: 80rpx; font-size: 24rpx; color: #94a3b8; }
.item-text { font-size: 26rpx; color: #334155; }
.item-text.bold { font-weight: 600; color: #ef4444; }
.item-photos { display: flex; gap: 12rpx; margin-bottom: 12rpx; }
.item-photo { width: 100rpx; height: 100rpx; border-radius: 12rpx; background: #e2e8f0; }
.item-remark { font-size: 24rpx; color: #94a3b8; }

.item-flow-group { background: #fff; border-radius: 16rpx; padding: 20rpx; margin-bottom: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.item-flow-header { display: flex; align-items: center; gap: 10rpx; margin-bottom: 20rpx; padding-bottom: 16rpx; border-bottom: 1rpx solid #f1f5f9; }
.item-flow-icon { font-size: 32rpx; }
.item-flow-name { font-size: 28rpx; font-weight: 600; color: #1e293b; }
.item-flow-count { font-size: 22rpx; color: #64748b; background: #f1f5f9; padding: 2rpx 12rpx; border-radius: 6rpx; }
.node-list { display: flex; flex-direction: column; gap: 16rpx; }

/* 节点卡片基础 */
.node-card {
  display: flex; border-radius: 16rpx; overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
  transition: all 0.2s;
}
.nc-bar { width: 8rpx; flex-shrink: 0; }
.nc-body { flex: 1; padding: 20rpx 24rpx; }

/* 状态配色 */
.nc-PENDING { background: #f8fafc; }
.nc-PENDING .nc-bar { background: #cbd5e1; }
.nc-PROCESSING { background: #eff6ff; }
.nc-PROCESSING .nc-bar { background: #3b82f6; }
.nc-PROCESSED { background: #f0fdf4; }
.nc-PROCESSED .nc-bar { background: #10b981; }
.nc-COMPLETED { background: #f0fdf4; opacity: 0.75; }
.nc-COMPLETED .nc-bar { background: #059669; }
.nc-ROLLED_BACK { background: #fef2f2; }
.nc-ROLLED_BACK .nc-bar { background: #ef4444; }

/* 头部 */
.nc-head { display: flex; justify-content: space-between; align-items: center; }
.nc-head-left { display: flex; align-items: center; gap: 12rpx; }
.nc-idx {
  width: 40rpx; height: 40rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 22rpx; font-weight: 700; color: #fff; flex-shrink: 0;
}
.nci-PENDING { background: #94a3b8; }
.nci-PROCESSING { background: #3b82f6; }
.nci-PROCESSED { background: #10b981; }
.nci-COMPLETED { background: #059669; }
.nci-ROLLED_BACK { background: #ef4444; }
.nc-dept-wrap { display: flex; align-items: center; gap: 8rpx; }
.nc-dept { font-size: 28rpx; font-weight: 600; color: #1e293b; }
.nc-tag { font-size: 18rpx; padding: 2rpx 10rpx; border-radius: 6rpx; font-weight: 500; }
.nc-tag-new { color: #f97316; background: #fff7ed; }
.nc-tag-reset { color: #7c3aed; background: #faf5ff; }

/* 状态徽章 */
.nc-badge {
  display: flex; align-items: center; gap: 4rpx;
  padding: 4rpx 14rpx; border-radius: 20rpx; font-size: 22rpx;
}
.ncb-s-PENDING { background: #f1f5f9; color: #64748b; }
.ncb-s-PROCESSING { background: #dbeafe; color: #2563eb; }
.ncb-s-PROCESSED { background: #d1fae5; color: #059669; }
.ncb-s-COMPLETED { background: #dcfce7; color: #16a34a; }
.ncb-s-ROLLED_BACK { background: #fee2e2; color: #dc2626; }
.nc-badge-icon { font-size: 20rpx; font-weight: 700; }
.nc-badge-text { font-size: 22rpx; }

/* 加工数据 */
.nc-data {
  display: flex; gap: 24rpx; margin-top: 14rpx;
  padding: 12rpx 16rpx; background: rgba(0,0,0,0.02); border-radius: 10rpx;
}
.nc-data-item { display: flex; flex-direction: column; align-items: center; }
.nc-data-label { font-size: 20rpx; color: #94a3b8; margin-bottom: 4rpx; }
.nc-data-val { font-size: 28rpx; font-weight: 600; color: #334155; }
.nc-data-green { color: #059669; }
.nc-data-red { color: #ef4444; }

/* 操作人+时间 */
.nc-meta { display: flex; gap: 16rpx; margin-top: 10rpx; }
.nc-meta-text { font-size: 22rpx; color: #94a3b8; }

/* 回退原因 */
.nc-reason { margin-top: 10rpx; padding: 8rpx 14rpx; background: #fef2f2; border-radius: 8rpx; }
.nc-reason-text { font-size: 22rpx; color: #dc2626; }

.nc-remark { font-size: 22rpx; color: #94a3b8; margin-top: 8rpx; display: block; font-style: italic; }

/* 操作按钮区 */
.nc-actions { margin-top: 16rpx; display: flex; align-items: center; gap: 16rpx; flex-wrap: wrap; }
.nc-btn {
  font-size: 26rpx; padding: 12rpx 36rpx; border-radius: 12rpx;
  border: none; color: #fff; font-weight: 600; line-height: 1.4;
}
.nc-btn::after { display: none; }
.nc-btn-primary { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.nc-btn-primary:active { opacity: 0.85; }
.nc-locked { font-size: 24rpx; color: #94a3b8; font-style: italic; }

/* 已回退节点标记 */
.nc-rolled-back-tag {
  margin-top: 14rpx; padding: 10rpx 16rpx;
  background: #fef2f2; border-radius: 10rpx; border: 1rpx solid #fecaca;
}
.nc-rolled-back-text { font-size: 24rpx; color: #dc2626; font-weight: 500; }

/* 回退按钮（与录入按钮同行） */
.nc-btn-rollback {
  background: #fff; color: #dc2626; border: 1rpx solid #fecaca;
  font-size: 26rpx; padding: 12rpx 36rpx; border-radius: 12rpx;
  font-weight: 500; line-height: 1.4;
}
.nc-btn-rollback:active { background: #fef2f2; }
.nc-btn-rollback::after { display: none; }

/* 变更记录 */
.nc-history { margin-top: 10rpx; padding: 6rpx 0; }
.nc-history-text { font-size: 22rpx; color: #64748b; }
.nc-history:active .nc-history-text { color: #3b82f6; }

/* 录入加工弹窗 */
.proc-panel {
  width: 100%; max-height: 80vh; background: #fff;
  border-radius: 24rpx 24rpx 0 0; display: flex; flex-direction: column;
}
.proc-panel-head {
  display: flex; align-items: center; justify-content: center;
  position: relative; padding: 24rpx 32rpx 16rpx;
  border-bottom: 1rpx solid #f1f5f9;
}
.proc-panel-title { font-size: 32rpx; font-weight: 600; color: #1e293b; }
.proc-panel-body { padding: 24rpx 32rpx; flex: 1; overflow-y: auto; }
.proc-info { display: flex; justify-content: space-between; margin-bottom: 16rpx; }
.proc-info-label { font-size: 26rpx; color: #64748b; }
.proc-info-value { font-size: 26rpx; color: #1e293b; font-weight: 500; }
.proc-field { margin-bottom: 20rpx; }
.proc-field-label { font-size: 26rpx; color: #334155; font-weight: 500; display: block; margin-bottom: 10rpx; }
.proc-field-input {
  width: 100%; height: 76rpx; border: 1rpx solid #e2e8f0; border-radius: 12rpx;
  padding: 0 20rpx; font-size: 28rpx; color: #1e293b; background: #f8fafc;
}
.proc-loss { font-size: 24rpx; color: #f59e0b; background: #fffbeb; padding: 12rpx 16rpx; border-radius: 8rpx; }
.proc-panel-footer {
  display: flex; gap: 20rpx; padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #f1f5f9;
}
.proc-cancel { flex: 1; height: 80rpx; line-height: 80rpx; text-align: center; background: #f1f5f9; color: #334155; border-radius: 16rpx; font-size: 30rpx; border: none; }
.proc-confirm { flex: 1; height: 80rpx; line-height: 80rpx; text-align: center; background: #3b82f6; color: #fff; border-radius: 16rpx; font-size: 30rpx; border: none; }
.proc-confirm[disabled] { opacity: 0.5; }
.proc-confirm-danger { background: #ef4444 !important; }
.proc-confirm-danger[disabled] { opacity: 0.5; }
.proc-field-textarea {
  width: 100%; min-height: 140rpx; border: 1rpx solid #e2e8f0; border-radius: 12rpx;
  padding: 16rpx 20rpx; font-size: 28rpx; color: #1e293b; background: #f8fafc;
  box-sizing: border-box;
}

.footer-bar { display: flex; padding: 20rpx 24rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); background: #fff; border-top: 1rpx solid #e2e8f0; gap: 20rpx; }
.btn-draft { flex: 1; height: 80rpx; line-height: 80rpx; text-align: center; background: #f1f5f9; color: #334155; border-radius: 16rpx; font-size: 30rpx; border: none; }
.btn-submit { flex: 1; height: 80rpx; line-height: 80rpx; text-align: center; background: #3b82f6; color: #fff; border-radius: 16rpx; font-size: 30rpx; border: none; }
.btn-edit { flex: 1; height: 80rpx; line-height: 80rpx; text-align: center; background: #f0f9ff; color: #2563eb; border-radius: 16rpx; font-size: 30rpx; border: 1rpx solid #bfdbfe; }
.btn-cancel { flex: 1; height: 80rpx; line-height: 80rpx; text-align: center; background: #fef2f2; color: #dc2626; border-radius: 16rpx; font-size: 30rpx; border: none; }
.btn-distribute { flex: 1; height: 80rpx; line-height: 80rpx; text-align: center; background: #f59e0b; color: #fff; border-radius: 16rpx; font-size: 30rpx; border: none; }

/* ===== 分发弹层（底部弹出） ===== */
.img-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: flex-end; }
.dist-panel {
  width: 100%;
  max-height: 85vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
}

.dist-panel-head {
  display: flex;
  align-items: center;
  padding: 28rpx 30rpx 20rpx;
  border-bottom: 1rpx solid #f1f5f9;
  position: relative;
}
.dist-panel-head-line {
  position: absolute;
  top: 12rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 60rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background: #e2e8f0;
}
.dist-panel-title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 700;
  color: #1e293b;
}
.dist-panel-close {
  font-size: 32rpx;
  color: #94a3b8;
  padding: 8rpx;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 分区标签 */
.dist-section-label {
  font-size: 26rpx;
  font-weight: 600;
  color: #64748b;
  padding: 16rpx 30rpx 10rpx;
  text-transform: uppercase;
  letter-spacing: 1rpx;
}

/* 已选加工节点 */
.dist-steps-section {
  border-bottom: 1rpx solid #f1f5f9;
  padding-bottom: 8rpx;
}
.dist-steps-empty {
  text-align: center;
  padding: 40rpx 0;
  color: #94a3b8;
  font-size: 26rpx;
}
.dist-steps-empty-icon { font-size: 48rpx; display: block; margin-bottom: 12rpx; }

.dist-step-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 24rpx;
  margin: 0 16rpx 8rpx;
  background: #f8fafc;
  border-radius: 16rpx;
  transition: background 0.15s;
}
.dist-step-card:active { background: #f1f5f9; }
.dist-step-card-left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.dist-step-number {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #3b82f6;
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dist-step-dept-avatar {
  width: 52rpx;
  height: 52rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  flex-shrink: 0;
  margin-left: 14rpx;
}
.dist-step-dept-name {
  font-size: 28rpx;
  color: #1e293b;
  font-weight: 500;
  margin-left: 16rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dist-step-card-actions {
  display: flex;
  gap: 6rpx;
  align-items: center;
  flex-shrink: 0;
  margin-left: 12rpx;
}
.dist-step-move-btn {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  color: #64748b;
  background: #fff;
  border-radius: 10rpx;
  border: 1rpx solid #e2e8f0;
}
.dist-step-move-btn.disabled {
  opacity: 0.25;
  pointer-events: none;
}
.dist-step-del-btn {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #ef4444;
  background: #fef2f2;
  border-radius: 10rpx;
}

/* 可选部门 */
.dist-avail-section { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.dist-avail-search {
  margin: 8rpx 24rpx 12rpx;
  display: flex;
  align-items: center;
  background: #f1f5f9;
  border-radius: 16rpx;
  padding: 0 20rpx;
  height: 68rpx;
  flex-shrink: 0;
}
.dist-avail-search-icon { font-size: 26rpx; margin-right: 10rpx; }
.dist-avail-search-input {
  flex: 1;
  font-size: 26rpx;
  color: #334155;
  height: 68rpx;
}
.dist-avail-search-clear {
  font-size: 26rpx;
  color: #94a3b8;
  padding: 6rpx;
  margin-left: 8rpx;
}

.dist-avail-list {
  flex: 1;
  max-height: 34vh;
  padding: 0 24rpx;
}

.dist-avail-empty {
  text-align: center;
  padding: 60rpx 0;
  color: #94a3b8;
  font-size: 26rpx;
}
.dist-avail-empty-icon { font-size: 48rpx; display: block; margin-bottom: 12rpx; }

.dist-avail-card {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  border-radius: 16rpx;
  margin-bottom: 6rpx;
  transition: background 0.15s;
}
.dist-avail-card:active { background: #f8fafc; }
.dist-avail-card-avatar {
  width: 52rpx;
  height: 52rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  flex-shrink: 0;
}
.dist-avail-card-name {
  flex: 1;
  font-size: 28rpx;
  color: #1e293b;
  font-weight: 500;
  margin-left: 18rpx;
}
.dist-avail-card-add {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #eff6ff;
  color: #3b82f6;
  font-size: 28rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.dist-avail-card:active .dist-avail-card-add {
  background: #3b82f6;
  color: #fff;
}

/* 按货物独立配置加工流程 */
.dist-items-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 24rpx;
}

.dist-item-card {
  background: #f8fafc;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  border: 1rpx solid #e2e8f0;
}

.dist-item-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.dist-item-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dist-item-qty {
  font-size: 24rpx;
  color: #64748b;
  background: #e2e8f0;
  padding: 2rpx 14rpx;
  border-radius: 6rpx;
  flex-shrink: 0;
}

.dist-item-action {
  font-size: 22rpx;
  color: #3b82f6;
  padding: 4rpx 12rpx;
  background: #eff6ff;
  border-radius: 8rpx;
}

.dist-item-action.dist-item-clear {
  color: #ef4444;
  background: #fef2f2;
}

/* 已选步骤芯片 */
.dist-item-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 14rpx;
  padding: 10rpx;
  background: #fff;
  border-radius: 10rpx;
  min-height: 40rpx;
  align-items: center;
}

.dist-step-chip {
  display: flex;
  align-items: center;
  background: #eff6ff;
  border: 1rpx solid #bfdbfe;
  border-radius: 8rpx;
  padding: 4rpx 6rpx 4rpx 10rpx;
  gap: 6rpx;
}

.dist-step-chip-num {
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  background: #3b82f6;
  color: #fff;
  font-size: 20rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dist-step-chip-name {
  font-size: 24rpx;
  color: #1e293b;
  font-weight: 500;
}

.dist-step-chip-del {
  font-size: 22rpx;
  color: #ef4444;
  padding: 2rpx 6rpx;
  font-weight: 600;
}

/* 部门快捷添加按钮 */
.dist-item-dept-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.dist-dept-btn {
  display: flex;
  align-items: center;
  padding: 8rpx 16rpx;
  background: #fff;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: #3b82f6;
  transition: all 0.15s;
}

.dist-dept-btn:active {
  background: #eff6ff;
  border-color: #3b82f6;
}

/* 确认按钮 */
.dist-confirm-bar {
  padding: 16rpx 24rpx;
  border-top: 1rpx solid #f1f5f9;
}
.dist-confirm-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #fff;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
}

/* 版本历史 */
.link-btn { font-size: 26rpx; color: #3b82f6; padding: 4rpx 12rpx; }
.version-log-item {
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  border-left: 4rpx solid #3b82f6;
}
.version-log-item.snap-item {
  border-left-color: #10b981;
  background: #f0fdf4;
}
.version-log-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.version-log-type {
  font-size: 26rpx;
  font-weight: 600;
  color: #1e293b;
}
.version-log-time {
  font-size: 22rpx;
  color: #94a3b8;
}
.version-log-body {
  font-size: 24rpx;
  color: #475569;
  margin-bottom: 8rpx;
}
.version-log-field {
  display: block;
  margin-bottom: 4rpx;
  color: #64748b;
}
.version-log-field-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx;
  padding: 6rpx 12rpx;
  background: #fff;
  border-radius: 8rpx;
  margin-bottom: 6rpx;
  font-size: 24rpx;
}
.version-log-field-label {
  color: #334155;
  font-weight: 500;
  min-width: 120rpx;
}
.version-log-change {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.version-log-old {
  color: #ef4444;
  text-decoration: line-through;
}
.version-log-arrow {
  color: #94a3b8;
  margin: 0 8rpx;
}
.version-log-new {
  color: #10b981;
}
.version-log-remark {
  display: block;
  font-size: 22rpx;
  color: #94a3b8;
  margin-top: 4rpx;
}
.version-log-footer {
  margin-top: 8rpx;
}
.version-log-operator {
  font-size: 22rpx;
  color: #94a3b8;
}


/* 订单生命周期 */
.lifecycle-bar {
  display: flex;
  align-items: flex-start;
  padding: 20rpx 16rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  overflow-x: auto;
}
.lifecycle-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  flex: 1;
  min-width: 100rpx;
  position: relative;
}
.lifecycle-step::after {
  content: '';
  position: absolute;
  top: 8rpx;
  left: calc(50% + 12rpx);
  right: calc(-50% + 12rpx);
  height: 4rpx;
  background: #cbd5e1;
}
.lifecycle-step:last-child::after {
  display: none;
}
.lifecycle-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #cbd5e1;
  margin-bottom: 8rpx;
  z-index: 1;
}
.lifecycle-dot.lifecycle-reached {
  background: #3b82f6;
}
.lifecycle-label {
  font-size: 22rpx;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4rpx;
}
.lifecycle-time {
  font-size: 18rpx;
  color: #94a3b8;
}
.lifecycle-empty {
  color: #cbd5e1;
}
</style>
