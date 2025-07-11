<template>
  <div class="translation-control-container">
    <icon-button
      :is-active="isTranslating"
      :title="t('Translation')"
      @click-icon="toggleTranslationPanel"
    >
      <IconLanguage size="24" />
    </icon-button>
    
    <!-- 翻译面板 -->
    <div v-show="showTranslationPanel" class="translation-panel">
      <div class="panel-header">
        <h3>{{ t('Translation') }}</h3>
        <button class="close-btn" @click="toggleTranslationPanel">×</button>
      </div>
      
      <div class="panel-content">
        <!-- 直接使用 RealtimeTranslator 组件 -->
        <RealtimeTranslator 
          :showTranslator="true"
          @update:showTranslator="handleTranslatorVisibilityChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IconLanguage } from '@tencentcloud/uikit-base-component-vue3';
import IconButton from '../common/base/IconButton.vue';
import { useI18n } from '../../../../locales';
import RealtimeTranslator from '../../../../components/RealtimeTranslator.vue';
import { translationWebSocketService } from '../../../../services/translationWebSocket';

const { t } = useI18n();

// 响应式数据
const showTranslationPanel = ref(false);

// 计算属性 - 检查是否有活跃的翻译会话
const isTranslating = computed(() => {
  return translationWebSocketService.isWebSocketConnected() && 
         (translationWebSocketService.getUsers().length > 0);
});

// 方法
const toggleTranslationPanel = () => {
  showTranslationPanel.value = !showTranslationPanel.value;
};

// 处理翻译器可见性变化
const handleTranslatorVisibilityChange = (visible: boolean) => {
  // 如果翻译器被关闭，也关闭面板
  if (!visible) {
    showTranslationPanel.value = false;
  }
};
</script>

<style scoped>
.translation-control-container {
  position: relative;
}

.translation-panel {
  position: absolute;
  bottom: 100%;
  right: 0;
  width: 460px; /* 从420px增加到460px */
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  margin-bottom: 10px;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
  border-bottom: 1px solid #e9ecef;
}

.panel-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #e9ecef;
}

.panel-content {
  padding: 0; /* 移除内边距，让 RealtimeTranslator 自己控制样式 */
  max-height: 500px;
  overflow-y: auto;
}

/* 覆盖 RealtimeTranslator 的一些样式，使其适合在面板中显示 */
.panel-content :deep(.translator-widget) {
  position: static;
  width: 100%;
  border-radius: 0;
  box-shadow: none;
  margin: 0;
}

.panel-content :deep(.translator-header) {
  border-radius: 0;
  border-bottom: 1px solid #e9ecef;
}

.panel-content :deep(.translator-content) {
  padding: 16px;
}

@media (max-width: 768px) {
  .translation-panel {
    width: 400px; /* 从360px增加到400px */
    right: -50px;
  }
}
</style> 
