<template>
  <div class="translation-control-container">
    <icon-button
      :title="t('Translation')"
      :is-active="isTranslating"
      @click-icon="toggleTranslationPanel"
    >
      <IconLanguage size="24" />
    </icon-button>
    
    <!-- 翻译面板 -->
    <div v-show="showTranslationPanel" class="translation-panel-wrapper" @click.self="toggleTranslationPanel">
      <div class="translation-panel">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IconLanguage } from '@tencentcloud/uikit-base-component-vue3';
import IconButton from '../common/base/IconButton.vue';
import { useI18n } from '../../../../locales';
import RealtimeTranslator from '../../../../components/RealtimeTranslator.vue';
import { translationWebSocketService } from '../../../../services/translationWebSocket';

// 国际化
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

/* 桌面端：绝对定位的面板 */
.translation-panel-wrapper {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 10px;
  z-index: 1000;
}

.translation-panel {
  width: 460px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
  border-radius: 12px 12px 0 0;
  background: #f8f9fa;
}

.panel-header h3 {
  margin: 0;
  font-size: 15px;
  color: #333;
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
.panel-content :deep(.realtime-translator) {
  position: static;
  width: 100%;
  border-radius: 0;
  box-shadow: none;
  margin: 0;
  background: white;
}

.panel-content :deep(.connection-status) {
  display: none; /* 隐藏连接状态，因为面板中不需要 */
}

.panel-content :deep(.error-message) {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  z-index: 1000;
}

/* 手机端：全屏覆盖 */
@media (max-width: 768px) {
  .translation-panel-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    margin: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .translation-panel {
    width: 90%;
    max-width: 100%;
    max-height: 90vh;
    margin: 0;
    border-radius: 16px 16px 0 0;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    flex-shrink: 0;
    padding: 16px 20px;
    border-radius: 16px 16px 0 0;
  }

  .panel-header h3 {
    font-size: 18px;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    font-size: 24px;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    max-height: calc(90vh - 60px);
    -webkit-overflow-scrolling: touch;
  }
}
</style> 
