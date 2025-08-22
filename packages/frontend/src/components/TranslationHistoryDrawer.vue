<template>
  <div v-if="showHistoryDrawer" class="history-drawer">
    <div class="drawer-header">
      <h3>{{ t('Translation History') }}</h3>
      <button @click="closeHistory" class="close-btn">×</button>
    </div>
    <div class="drawer-content">
      <div 
        v-for="(subtitle, index) in subtitleStore.subtitleResults" 
        :key="index"
        class="history-item"
      >
        <div class="history-user">{{ subtitle.userName }}</div>
        <div class="history-original">{{ subtitle.originalText }}</div>
        <div class="history-translation">{{ subtitle.translatedText }}</div>
        <div class="history-time">{{ formatTime(subtitle.timestamp) }}</div>
      </div>
      <div v-if="subtitleStore.subtitleResults.length === 0" class="empty-history">
        {{ t('No translation history') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '../locales';
import { useSubtitleStore } from '../stores/subtitle';

// Props
interface Props {
  showHistoryDrawer: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:showHistoryDrawer': [value: boolean];
}>();

// 国际化
const { t } = useI18n();

// 字幕状态管理
const subtitleStore = useSubtitleStore();

// 方法
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString();
};

const closeHistory = () => {
  emit('update:showHistoryDrawer', false);
};
</script>

<style scoped>
.history-drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: 350px;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  z-index: 1002;
  display: flex;
  flex-direction: column;
  animation: drawerSlideIn 0.3s ease-out;
}

@keyframes drawerSlideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
}

.drawer-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e9ecef;
  color: #333;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.history-item {
  padding: 15px;
  margin-bottom: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #007bff;
  transition: background 0.2s;
}

.history-item:hover {
  background: #e9ecef;
}

.history-user {
  font-weight: bold;
  color: #007bff;
  margin-bottom: 5px;
  font-size: 14px;
}

.history-original {
  color: #333;
  margin-bottom: 5px;
  line-height: 1.4;
  font-size: 14px;
}

.history-translation {
  color: #666;
  font-size: 14px;
  line-height: 1.3;
  opacity: 0.9;
}

.history-time {
  color: #666;
  font-size: 12px;
}

.empty-history {
  text-align: center;
  color: #666;
  padding: 40px 20px;
  font-style: italic;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .history-drawer {
    width: 100%;
  }
}
</style>



