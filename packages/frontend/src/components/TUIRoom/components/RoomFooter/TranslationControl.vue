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
    <div v-if="showTranslationPanel" class="translation-panel">
      <div class="panel-header">
        <h3>{{ t('Translation') }}</h3>
        <button class="close-btn" @click="toggleTranslationPanel">×</button>
      </div>
      
      <div class="panel-content">
        <!-- 语言控制 -->
        <div class="language-controls">
          <div class="section-title">{{ t('Translation settings') }}</div>
          <div class="lang-selector">
            <select v-model="fromLang" class="lang-select" :disabled="isInitiating">
              <option value="zh-CHS">{{ t('Chinese') }}</option>
              <option value="ja">{{ t('Japanese') }}</option>
            </select>
            <span class="arrow">→</span>
            <select v-model="toLang" class="lang-select" :disabled="isInitiating">
              <option value="ja">{{ t('Japanese') }}</option> 
              <option value="zh-CHS">{{ t('Chinese') }}</option>
            </select>
          </div>
        </div>

        <!-- 用户选择器 -->
        <div class="user-selection">
          <div class="section-title">{{ t('Select translation target') }}</div>
          <UserSelector 
            v-model:showSelector="showUserSelector"
            @translation-started="handleTranslationStarted"
            @translation-stopped="handleTranslationStopped"
            :fromLang="fromLang"
            :toLang="toLang"
            :activeTranslationSessions="activeTranslationSessions"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { IconLanguage } from '@tencentcloud/uikit-base-component-vue3';
import IconButton from '../common/base/IconButton.vue';
import { useI18n } from '../../../../locales';
import UserSelector from '../../../../components/UserSelector.vue';
import { translationWebSocketService, type TranslationUser } from '../../../../services/translationWebSocket';

// 创建一个简单的翻译图标组件
const IconTranslation = {
  template: '<span style="font-size: 24px;">🌐</span>'
};

const { t } = useI18n();

// 响应式数据
const showTranslationPanel = ref(false);
const fromLang = ref('zh-CHS');
const toLang = ref('ja');
const isInitiating = ref(false);
const showUserSelector = ref(false);
const currentTargetUser = ref<TranslationUser | null>(null);

// 管理翻译会话
const activeTranslationSessions = ref<Map<string, {
  targetUserId: string;
  targetUserName: string;
  isInitiator: boolean;
  fromLang: string;
  toLang: string;
}>>(new Map());

// 计算属性
const isTranslating = computed(() => {
  return isInitiating.value || activeTranslationSessions.value.size > 0;
});

// 方法
const toggleTranslationPanel = () => {
  showTranslationPanel.value = !showTranslationPanel.value;
};

// 同步翻译状态
const syncTranslationState = () => {
  const hasActiveInitiatorSessions = Array.from(activeTranslationSessions.value.values())
    .some(session => session.isInitiator);
  
  if (hasActiveInitiatorSessions) {
    isInitiating.value = true;
    const firstInitiatorSession = Array.from(activeTranslationSessions.value.values())
      .find(session => session.isInitiator);
    
    if (firstInitiatorSession) {
      currentTargetUser.value = {
        id: firstInitiatorSession.targetUserId,
        name: firstInitiatorSession.targetUserName,
        isOnline: true
      };
    }
  } else {
    isInitiating.value = false;
    currentTargetUser.value = null;
  }
};

// 处理翻译开始
const handleTranslationStarted = (userId: string, userName: string) => {
  const sessionId = `initiator_${userId}`;
  activeTranslationSessions.value.set(sessionId, {
    targetUserId: userId,
    targetUserName: userName,
    isInitiator: true,
    fromLang: fromLang.value,
    toLang: toLang.value
  });
  
  currentTargetUser.value = {
    id: userId,
    name: userName,
    isOnline: true
  };
  showUserSelector.value = false;
  isInitiating.value = true;
  
  console.log(`发送翻译指令给用户: ${userName} (${userId})`);
};

// 处理翻译停止
const handleTranslationStopped = (userId: string) => {
  const sessionId = `initiator_${userId}`;
  const session = activeTranslationSessions.value.get(sessionId);
  
  if (session && session.isInitiator) {
    activeTranslationSessions.value.delete(sessionId);
    currentTargetUser.value = null;
    isInitiating.value = false;
    console.log(`停止对用户 ${session.targetUserName} 的翻译`);
    
    translationWebSocketService.stopTranslation(userId);
  } else {
    console.log('用户主动停止翻译，不发送停止指令');
    activeTranslationSessions.value.delete(sessionId);
    currentTargetUser.value = null;
    isInitiating.value = false;
  }
};

// 组件挂载时同步状态
onMounted(() => {
  syncTranslationState();
});
</script>

<style scoped>
.translation-control-container {
  position: relative;
}

.translation-panel {
  position: absolute;
  bottom: 100%;
  right: 0;
  width: 380px;
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
  padding: 16px;
}

.section-title {
  font-weight: 600;
  font-size: 14px;
  color: #495057;
  margin-bottom: 8px;
}

.language-controls {
  margin-bottom: 16px;
}

.lang-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lang-select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  color: #495057;
}

.lang-select:disabled {
  background: #f8f9fa;
  color: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.arrow {
  color: #6c757d;
  font-size: 14px;
}

.user-selection {
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .translation-panel {
    width: 320px;
    right: -50px;
  }
}
</style> 
