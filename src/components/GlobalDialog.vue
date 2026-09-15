<template>
  <transition name="dialog-overlay">
    <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
      <transition name="dialog-card" appear>
        <div v-if="visible" class="dialog-card" :class="[`dialog-${type}`]">
          <!-- 顶部进度条 -->
          <div class="dialog-top-bar"></div>

          <!-- 图标区 -->
          <div class="dialog-icon-wrap" :class="[`icon-${type}`]">
            <span class="dialog-icon-text">{{ iconEmoji }}</span>
          </div>

          <!-- 标题 -->
          <h3 class="dialog-title">{{ title }}</h3>

          <!-- 内容 -->
          <div class="dialog-body">
            <p v-if="message" class="dialog-message">{{ message }}</p>
            <slot />
          </div>

          <!-- 按钮 -->
          <div class="dialog-actions">
            <button
              v-if="showCancel"
              class="dialog-btn dialog-btn-cancel"
              @click="handleCancel"
            >{{ cancelText }}</button>
            <button
              class="dialog-btn dialog-btn-confirm"
              :class="{ 'btn-danger': type === 'danger', 'btn-primary': type === 'success' }"
              @click="handleConfirm"
            >{{ confirmText }}</button>
          </div>

          <!-- 关闭按钮（右上角） -->
          <button v-if="showClose" class="dialog-close" @click="handleCancel">✕</button>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: Boolean,
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  type: { type: String, default: 'info' },  // 'info' | 'success' | 'warning' | 'danger'
  showCancel: { type: Boolean, default: true },
  showClose: { type: Boolean, default: true },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' }
})

const emit = defineEmits(['confirm', 'cancel', 'update:visible'])

const iconEmoji = computed(() => {
  const map = { info: '💬', success: '✅', warning: '⚠️', danger: '🚨' }
  return map[props.type] || '💬'
})

function handleConfirm() {
  emit('confirm')
  emit('update:visible', false)
}
function handleCancel() {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}
.dialog-overlay-enter-active, .dialog-overlay-leave-active {
  transition: opacity 0.25s ease;
}
.dialog-overlay-enter-from, .dialog-overlay-leave-to { opacity: 0; }

.dialog-card {
  min-width: 360px;
  max-width: 480px;
  background: linear-gradient(160deg, #1e1e36 0%, #0f0f20 100%);
  border-radius: 18px;
  border: var(--border-strong);
  box-shadow: 0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 var(--outline-soft);
  padding: 28px 28px 24px;
  position: relative;
  text-align: center;
  overflow: hidden;
}
.dialog-card-enter-active {
  animation: dialogPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes dialogPop {
  0% { opacity: 0; transform: scale(0.8) translateY(20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* 顶部彩色条 */
.dialog-top-bar {
  position: absolute; top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--accent-gradient);
}
.dialog-danger .dialog-top-bar { background: linear-gradient(90deg, #ff6666, #ff3344); }
.dialog-success .dialog-top-bar { background: linear-gradient(90deg, #00ff88, #00d4ff); }
.dialog-warning .dialog-top-bar { background: linear-gradient(90deg, #ff8800, #ffcc00); }

/* 图标 */
.dialog-icon-wrap {
  width: 56px; height: 56px;
  border-radius: 50%;
  background: rgba(0,212,255,0.12);
  border: 2px solid rgba(0,212,255,0.3);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
  animation: ring 2s ease-out infinite;
}
.dialog-icon-text { font-size: 26px; }
.icon-success {
  background: rgba(0,255,136,0.12); border-color: rgba(0,255,136,0.4);
}
.icon-warning {
  background: rgba(255,136,0,0.12); border-color: rgba(255,136,0,0.4);
  animation: ringWarning 2s ease-out infinite;
}
.icon-danger {
  background: rgba(255,102,102,0.15); border-color: rgba(255,102,102,0.5);
  animation: ringDanger 1.8s ease-out infinite;
}
@keyframes ringWarning {
  0% { box-shadow: 0 0 0 0 rgba(255,136,0,0.5); }
  70% { box-shadow: 0 0 0 14px rgba(255,136,0,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,136,0,0); }
}
@keyframes ringDanger {
  0% { box-shadow: 0 0 0 0 rgba(255,102,102,0.6); }
  70% { box-shadow: 0 0 0 14px rgba(255,102,102,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,102,102,0); }
}

/* 标题 */
.dialog-title {
  font-size: 17px; font-weight: bold; color: #fff;
  margin-bottom: 10px; letter-spacing: 0.5px;
}

/* 内容 */
.dialog-body { margin-bottom: 20px; }
.dialog-message {
  font-size: 14px; color: var(--text-sub);
  line-height: 1.7; word-break: break-word;
  white-space: pre-line;
}

/* 按钮 */
.dialog-actions {
  display: flex; gap: 10px; justify-content: flex-end;
}
.dialog-btn {
  border-radius: var(--radius-pill);
  padding: 9px 22px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.dialog-btn-cancel {
  background: var(--surface-2);
  color: var(--text-sub);
  border: var(--border-default);
}
.dialog-btn-cancel:hover {
  background: var(--surface-4);
  color: #fff;
}
.dialog-btn-confirm {
  background: var(--accent-gradient);
  color: #fff;
  border: none;
  font-weight: bold;
  box-shadow: 0 4px 16px rgba(0,212,255,0.3);
}
.dialog-btn-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0,212,255,0.5);
}
.dialog-btn-confirm.btn-danger {
  background: linear-gradient(135deg, #ff6666, #ff3344);
  box-shadow: 0 4px 16px rgba(255,102,102,0.3);
}
.dialog-btn-confirm.btn-primary {
  background: linear-gradient(135deg, #00ff88, #00d4ff);
  box-shadow: 0 4px 16px rgba(0,255,136,0.3);
}

/* 关闭按钮 */
.dialog-close {
  position: absolute; top: 10px; right: 12px;
  width: 28px; height: 28px;
  border-radius: 50%;
  padding: 0;
  font-size: 13px;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.2s;
}
.dialog-close:hover {
  background: rgba(255,102,102,0.15);
  color: var(--danger);
  transform: rotate(90deg);
}
</style>
