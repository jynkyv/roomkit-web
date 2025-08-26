<template>
  <div class="translation-history">
    <div class="history-header">
      <h3>{{ t('Translation History') }}</h3>
      <div class="header-actions">
        <button @click="clearHistory" class="clear-btn" :disabled="subtitleResults.length === 0">
          {{ t('Clear history') }}
        </button>
      </div>
    </div>
    
    <div class="history-content">
      <div v-if="subtitleResults.length === 0" class="empty-state">
        <div class="empty-icon">📝</div>
        <p>{{ t('No translation history yet') }}</p>
      </div>
      
      <div v-else class="history-list">
        <div 
          v-for="subtitle in reversedSubtitles" 
          :key="subtitle.id"
          class="history-item"
        >
          <div class="item-header">
            <span class="username">{{ subtitle.userName }}</span>
            <span class="timestamp">{{ formatTimestamp(subtitle.timestamp) }}</span>
          </div>
          
          <div class="item-content">
            <div class="original-text">
              <span class="label">{{ t('Original') }}:</span>
              <span class="text">{{ subtitle.originalText }}</span>
            </div>
            
            <div class="translated-text">
              <span class="label">{{ t('Translation') }}:</span>
              <span class="text">{{ subtitle.translatedText }}</span>
            </div>
          </div>
          
          <div v-if="subtitle.isPartial" class="partial-indicator">
            {{ t('Partial result') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../locales';
import { useSubtitleStore } from '../stores/subtitle';

// 在侧边栏中不需要props

// 国际化
const { t } = useI18n();

// 使用字幕存储
const subtitleStore = useSubtitleStore();
const { subtitleResults } = subtitleStore;

// 计算属性 - 反转字幕列表以显示最新的在前面
const reversedSubtitles = computed(() => {
  return [...subtitleResults].reverse();
});

// 方法
const clearHistory = () => {
  subtitleStore.clearSubtitles();
};

const formatTimestamp = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) { // 1分钟内
    return t('Just now');
  } else if (diff < 3600000) { // 1小时内
    const minutes = Math.floor(diff / 60000);
    return `${minutes} ${t('min ago')}`;
  } else { // 1小时以上
    const hours = Math.floor(diff / 3600000);
    return `${hours} ${t('h ago')}`;
  }
};
</script>

<style scoped>
.translation-history {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: transparent;
  border-bottom: 1px solid var(--border-color-base, #e9ecef);
}

.history-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary, #333);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clear-btn {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.clear-btn:hover:not(:disabled) {
  background: #c82333;
}

.clear-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}



.history-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-color-secondary, #6c757d);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.history-list {
  padding: 0;
}

.history-item {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color-base, #f1f3f4);
  transition: background-color 0.2s;
}

.history-item:hover {
  background-color: var(--list-color-hover, #f8f9fa);
}

.history-item:last-child {
  border-bottom: none;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.username {
  font-weight: 600;
  color: var(--text-color-primary, #333);
  font-size: 14px;
}

.timestamp {
  font-size: 12px;
  color: var(--text-color-secondary, #6c757d);
}

.item-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.original-text,
.translated-text {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.label {
  font-size: 12px;
  color: var(--text-color-secondary, #6c757d);
  min-width: 60px;
  flex-shrink: 0;
}

.text {
  font-size: 14px;
  color: var(--text-color-primary, #333);
  line-height: 1.4;
  word-break: break-word;
}

.partial-indicator {
  margin-top: 8px;
  padding: 4px 8px;
  background: #fff3cd;
  color: #856404;
  border-radius: 4px;
  font-size: 11px;
  display: inline-block;
}

/* 滚动条样式 */
.history-content::-webkit-scrollbar {
  width: 6px;
}

.history-content::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.history-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.history-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style> 
