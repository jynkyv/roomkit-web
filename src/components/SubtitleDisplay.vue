<template>
  <div v-if="showSubtitle" class="subtitle-container">
    <div class="subtitle-content">
      <div class="subtitle-text" :class="{ 'typing': isTyping }">
        {{ currentSubtitle }}
      </div>
      <div v-if="showInfo" class="subtitle-info">
        <span class="speaker">{{ currentSpeaker }}</span>
        <span class="time">{{ currentTime }}</span>
      </div>
    </div>

    <!-- 字幕历史记录 -->
    <div v-if="showHistory && subtitleHistory.length > 0" class="subtitle-history">
      <div
        v-for="(historyItem, index) in subtitleHistory"
        :key="index"
        class="history-item"
      >
        <div class="history-speaker">{{ historyItem.sender }}</div>
        <div class="history-text">{{ historyItem.text }}</div>
        <div class="history-time">{{ historyItem.startTime }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { SubtitleMessage } from '@/utils/aiTranscription';

interface Props {
  subtitle?: SubtitleMessage;
  showHistory?: boolean;
  showInfo?: boolean;
  maxHistoryCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: undefined,
  showHistory: true,
  showInfo: true,
  maxHistoryCount: 10,
});

const currentSubtitle = ref('');
const currentSpeaker = ref('');
const currentTime = ref('');
const isTyping = ref(false);
const subtitleHistory = ref<SubtitleMessage[]>([]);

// 计算属性
const showSubtitle = computed(() => currentSubtitle.value || subtitleHistory.value.length > 0);

// 监听字幕变化
watch(() => props.subtitle, (newSubtitle) => {
  if (newSubtitle) {
    handleNewSubtitle(newSubtitle);
  }
}, { deep: true });

// 处理新字幕
const handleNewSubtitle = (subtitle: SubtitleMessage) => {
  if (subtitle.isComplete) {
    // 完整句子，添加到历史记录
    subtitleHistory.value.push(subtitle);

    // 限制历史记录数量
    if (subtitleHistory.value.length > props.maxHistoryCount) {
      subtitleHistory.value.shift();
    }

    // 清空当前显示
    currentSubtitle.value = '';
    currentSpeaker.value = '';
    currentTime.value = '';
    isTyping.value = false;
  } else {
    // 实时字幕，显示当前内容
    currentSubtitle.value = subtitle.text;
    currentSpeaker.value = subtitle.sender;
    currentTime.value = subtitle.startTime;
    isTyping.value = true;
  }
};

// 清空字幕
const clearSubtitles = () => {
  currentSubtitle.value = '';
  currentSpeaker.value = '';
  currentTime.value = '';
  isTyping.value = false;
  subtitleHistory.value = [];
};

// 暴露方法
defineExpose({
  clearSubtitles,
});
</script>

<style scoped>
.subtitle-container {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  max-width: 80%;
  pointer-events: none;
}

.subtitle-content {
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 10px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.subtitle-text {
  color: white;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
  text-align: center;
  min-height: 22px;
}

.subtitle-text.typing::after {
  content: '|';
  animation: blink 1s infinite;
  color: #4CAF50;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.subtitle-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.speaker {
  font-weight: 600;
  color: #4CAF50;
}

.time {
  font-family: monospace;
}

.subtitle-history {
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.history-item {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.history-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.history-speaker {
  font-size: 12px;
  color: #4CAF50;
  font-weight: 600;
  margin-bottom: 4px;
}

.history-text {
  color: white;
  font-size: 14px;
  line-height: 1.3;
  margin-bottom: 4px;
}

.history-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: monospace;
}

/* 滚动条样式 */
.subtitle-history::-webkit-scrollbar {
  width: 4px;
}

.subtitle-history::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.subtitle-history::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.subtitle-history::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .subtitle-container {
    bottom: 80px;
    max-width: 90%;
  }

  .subtitle-text {
    font-size: 14px;
  }

  .subtitle-history {
    max-height: 150px;
  }
}
</style>
