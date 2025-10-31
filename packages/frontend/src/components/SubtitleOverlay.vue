<template>
  <div v-if="visibleSubtitles.length > 0 && isTranslating" class="subtitle-overlay">
    <div class="subtitle-container">
      <div 
        v-for="(subtitle, index) in visibleSubtitles" 
        :key="subtitle.id"
        class="subtitle-item"
        :class="{ 
          'fade-out': subtitle.isFading,
          'partial': subtitle.isPartial 
        }"
      >
        <div class="subtitle-header">
          <span class="user">{{ subtitle.userName }}</span>
        </div>
        <div class="subtitle-content">
          <div class="original-text">{{ subtitle.originalText }}</div>
          <div class="translated-text">{{ subtitle.translatedText }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { useSubtitleStore } from '../stores/subtitle';

// 翻译状态管理
const isTranslating = ref(false);

// 字幕状态管理
const subtitleStore = useSubtitleStore();

// 可见字幕列表
const visibleSubtitles = ref<Array<{
  id: number;
  originalText: string;
  translatedText: string;
  userName: string;
  timestamp: number;
  isFading: boolean;
  isPartial?: boolean;
}>>([]);

// 字幕ID计数器
let subtitleIdCounter = 0;

// 监听翻译状态变化
const updateTranslationStatus = () => {
  // 检查是否有活跃的翻译会话
  const hasActiveSubtitles = subtitleStore.subtitleResults.length > 0;
  const hasRecentActivity = subtitleStore.subtitleResults.some(
    subtitle => Date.now() - subtitle.timestamp < 30000 // 30秒内有活动
  );
  isTranslating.value = hasActiveSubtitles && hasRecentActivity;
};

// 监听字幕数据变化
watch(() => subtitleStore.subtitleResults, (newResults, oldResults) => {
  // 更新翻译状态
  updateTranslationStatus();
  
  // 处理新字幕添加
  if (newResults.length > (oldResults?.length || 0)) {
    // 有新字幕添加
    const newSubtitle = newResults[newResults.length - 1];
    const subtitleId = ++subtitleIdCounter;
    

    
    // 添加到可见字幕列表
    visibleSubtitles.value.push({
      id: subtitleId,
      originalText: newSubtitle.originalText,
      translatedText: newSubtitle.translatedText,
      userName: newSubtitle.userName,
      timestamp: newSubtitle.timestamp,
      isFading: false,
      isPartial: newSubtitle.isPartial,
    });

    // 如果不是部分结果，设置淡出定时器
    if (!newSubtitle.isPartial) {
      // 10秒后开始淡出
      setTimeout(() => {
        const subtitleIndex = visibleSubtitles.value.findIndex(s => s.id === subtitleId);
        if (subtitleIndex !== -1) {
          visibleSubtitles.value[subtitleIndex].isFading = true;
          
          // 0.5秒后完全移除
          setTimeout(() => {
            const removeIndex = visibleSubtitles.value.findIndex(s => s.id === subtitleId);
            if (removeIndex !== -1) {
              visibleSubtitles.value.splice(removeIndex, 1);
            }
          }, 500);
        }
      }, 10000); // 10秒
    }
  } else if (newResults.length === oldResults?.length && newResults.length > 0) {
    // 字幕内容更新（部分结果）
    const lastSubtitle = newResults[newResults.length - 1];
    const lastVisibleSubtitle = visibleSubtitles.value[visibleSubtitles.value.length - 1];
    
    if (lastVisibleSubtitle && lastSubtitle.isPartial) {
      // 更新最后一个可见字幕的内容
      lastVisibleSubtitle.originalText = lastSubtitle.originalText;
      lastVisibleSubtitle.translatedText = lastSubtitle.translatedText;
      lastVisibleSubtitle.timestamp = lastSubtitle.timestamp;
      lastVisibleSubtitle.isPartial = lastSubtitle.isPartial;
    } else if (!lastVisibleSubtitle && newResults.length > 0) {
      // 如果没有可见字幕但有字幕数据，添加第一个字幕
      const subtitleId = ++subtitleIdCounter;
      visibleSubtitles.value.push({
        id: subtitleId,
        originalText: lastSubtitle.originalText,
        translatedText: lastSubtitle.translatedText,
        userName: lastSubtitle.userName,
        timestamp: lastSubtitle.timestamp,
        isFading: false,
        isPartial: lastSubtitle.isPartial,
      });
    }
  }
}, { deep: true });
</script>

<style scoped>
.subtitle-overlay {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  pointer-events: none;
  width: 90%; /* 使用百分比宽度，更宽 */
  max-width: 1200px; /* 增加最大宽度 */
}

.subtitle-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.subtitle-item {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  width: 100%; /* 占满容器宽度 */
  text-align: center;
  animation: subtitleFadeIn 0.3s ease-in-out;
  transition: all 0.5s ease;
}

.subtitle-item.fade-out {
  opacity: 0;
  transform: translateY(-10px);
}

.subtitle-item.partial {
  border-color: rgba(255, 193, 7, 0.6);
  background: rgba(0, 0, 0, 0.9);
}

.subtitle-header {
  margin-bottom: 8px;
}

.subtitle-header .user {
  font-weight: bold;
  color: #ffd700;
  font-size: 14px;
}

.subtitle-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.original-text {
  color: #fff;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 500;
}

.translated-text {
  color: #ffd700;
  font-size: 14px;
  line-height: 1.3;
  opacity: 0.9;
}

@keyframes subtitleFadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 响应式设计 - 手机端优化 */
@media (max-width: 768px) {
  .subtitle-overlay {
    bottom: 20px;
    left: 10px;
    right: 10px;
    width: calc(100% - 20px);
    max-width: 100%;
    transform: none;
    padding: 0;
  }
  
  .subtitle-container {
    gap: 6px;
  }
  
  .subtitle-item {
    padding: 12px 16px;
    border-radius: 12px;
    max-width: 100%;
    margin: 0 auto;
  }
  
  .subtitle-header {
    margin-bottom: 6px;
  }
  
  .subtitle-header .user {
    font-size: 12px;
  }
  
  .subtitle-content {
    gap: 6px;
  }
  
  .original-text {
    font-size: 15px;
    line-height: 1.5;
    word-wrap: break-word;
    word-break: break-word;
  }
  
  .translated-text {
    font-size: 13px;
    line-height: 1.4;
    word-wrap: break-word;
    word-break: break-word;
  }
}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
  .subtitle-overlay {
    bottom: 15px;
    left: 8px;
    right: 8px;
    width: calc(100% - 16px);
  }
  
  .subtitle-item {
    padding: 10px 14px;
    border-radius: 10px;
  }
  
  .subtitle-header .user {
    font-size: 11px;
  }
  
  .original-text {
    font-size: 14px;
  }
  
  .translated-text {
    font-size: 12px;
  }
}
</style>
