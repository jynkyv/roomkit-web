import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface SubtitleItem {
  originalText: string;
  translatedText: string;
  userName: string;
  timestamp: number;
  isPartial?: boolean; // 是否为部分结果
}

export const useSubtitleStore = defineStore('subtitle', () => {
  const subtitleResults = ref<SubtitleItem[]>([]);

  // 添加字幕
  const addSubtitle = (originalText: string, translatedText: string, userName: string, isPartial: boolean = false) => {
    subtitleResults.value.push({
      originalText,
      translatedText,
      userName,
      timestamp: Date.now(),
      isPartial,
    });

    // 保持字幕列表长度，最多保留50条
    if (subtitleResults.value.length > 50) {
      subtitleResults.value.shift();
    }
  };

  // 更新最后一个字幕（用于部分结果）
  const updateLastSubtitle = (originalText: string, translatedText: string) => {
    if (subtitleResults.value.length > 0) {
      const lastSubtitle = subtitleResults.value[subtitleResults.value.length - 1];
      lastSubtitle.originalText = originalText;
      lastSubtitle.translatedText = translatedText;
      lastSubtitle.timestamp = Date.now();
      lastSubtitle.isPartial = true;
    }
  };

  // 完成最后一个字幕（将部分结果标记为完整）
  const completeLastSubtitle = () => {
    if (subtitleResults.value.length > 0) {
      const lastSubtitle = subtitleResults.value[subtitleResults.value.length - 1];
      lastSubtitle.isPartial = false;
    }
  };

  // 清空字幕历史
  const clearSubtitles = () => {
    subtitleResults.value = [];
  };

  // 获取最近的字幕
  const getRecentSubtitles = (count: number = 3) => {
    return subtitleResults.value.slice(-count);
  };

  // 清理过期的字幕（可选，用于历史记录）
  const cleanOldSubtitles = (maxAge: number = 30 * 60 * 1000) => { // 默认30分钟
    const now = Date.now();
    subtitleResults.value = subtitleResults.value.filter(
      subtitle => now - subtitle.timestamp < maxAge
    );
  };

  return {
    subtitleResults,
    addSubtitle,
    updateLastSubtitle,
    completeLastSubtitle,
    clearSubtitles,
    getRecentSubtitles,
    cleanOldSubtitles,
  };
});
