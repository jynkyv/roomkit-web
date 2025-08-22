<template>
  <div class="history-control-container">
    <icon-button
      :title="t('Translation History')"
      :is-active="showHistoryPanel"
      @click-icon="toggleHistoryPanel"
    >
      <IconChat size="24" />
    </icon-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { IconChat } from '@tencentcloud/uikit-base-component-vue3';
import IconButton from '../common/base/IconButton.vue';
import { useI18n } from '../../../../locales';
import { translationWebSocketService } from '../../../../services/translationWebSocket';

// 国际化
const { t } = useI18n();

// 响应式数据
const showHistoryPanel = ref(false);

// 计算属性
const hasHistory = computed(() => {
  return translationHistory.value.length > 0;
});

// 翻译历史相关状态
const translationHistory = ref<Array<{
  id: string;
  original: string;
  translation: string;
  userId: string;
  timestamp: number;
}>>([]);

// 方法
const toggleHistoryPanel = () => {
  showHistoryPanel.value = !showHistoryPanel.value;
  // 触发全局事件，通知主页面切换布局
  window.dispatchEvent(new CustomEvent('toggle-history-panel', { 
    detail: { show: showHistoryPanel.value } 
  }));
};

// 清空历史记录
const clearHistory = () => {
  translationHistory.value = [];
  // 触发全局事件，通知其他组件
  window.dispatchEvent(new CustomEvent('clear-translation-history'));
};

// 添加翻译历史记录
const addToHistory = (original: string, translation: string, userId: string = 'unknown') => {
  const historyItem = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    original,
    translation,
    userId,
    timestamp: Date.now()
  };
  
  translationHistory.value.unshift(historyItem);
  
  // 限制最多显示100条记录
  if (translationHistory.value.length > 100) {
    translationHistory.value = translationHistory.value.slice(0, 100);
  }
};

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) { // 1分钟内
    return t('Just now');
  } else if (diff < 3600000) { // 1小时内
    const minutes = Math.floor(diff / 60000);
    return `${minutes}${t('min ago')}`;
  } else if (diff < 86400000) { // 24小时内
    const hours = Math.floor(diff / 3600000);
    return `${hours}${t('h ago')}`;
  } else {
    return date.toLocaleDateString();
  }
};

// WebSocket事件处理
const handleTranslationBroadcast = (data: any) => {
  console.log('收到翻译广播:', data);
  
  // 添加到翻译历史
  addToHistory(data.zhText, data.jaText, data.userId);
};

// 监听全局事件
const handleGlobalTranslationBroadcast = (event: CustomEvent) => {
  const { original, translation, userId } = event.detail;
  addToHistory(original, translation, userId);
};

// 监听全局清空历史事件
const handleGlobalClearHistory = () => {
  translationHistory.value = [];
};

// 组件挂载时初始化
onMounted(() => {
  // 注册WebSocket事件监听器
  translationWebSocketService.on('translation_broadcast', handleTranslationBroadcast);
  
  // 监听全局事件
  window.addEventListener('translation-broadcast', handleGlobalTranslationBroadcast as EventListener);
  window.addEventListener('clear-translation-history', handleGlobalClearHistory);
  
  // 将历史数据暴露到全局，供主页面使用
  (window as any).translationHistoryData = {
    history: translationHistory,
    formatTime,
    clearHistory
  };
});

// 组件卸载时清理
onUnmounted(() => {
  // 移除WebSocket事件监听器
  translationWebSocketService.off('translation_broadcast', handleTranslationBroadcast);
  
  // 移除全局事件监听器
  window.removeEventListener('translation-broadcast', handleGlobalTranslationBroadcast as EventListener);
  window.removeEventListener('clear-translation-history', handleGlobalClearHistory);
  
  // 清理全局数据
  delete (window as any).translationHistoryData;
});
</script>

<style scoped>
.history-control-container {
  position: relative;
}
</style>
