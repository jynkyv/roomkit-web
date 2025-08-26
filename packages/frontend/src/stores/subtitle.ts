import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface SubtitleItem {
  id: string; // 唯一标识符
  userId: string; // 用户ID
  originalText: string;
  translatedText: string;
  userName: string;
  timestamp: number;
  isPartial?: boolean; // 是否为部分结果
}

export const useSubtitleStore = defineStore('subtitle', () => {
  const subtitleResults = ref<SubtitleItem[]>([]);

  // 生成唯一ID
  const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // 添加字幕
  const addSubtitle = (originalText: string, translatedText: string, userName: string, userId: string, isPartial: boolean = false) => {
    const subtitle: SubtitleItem = {
      id: generateId(),
      userId,
      originalText,
      translatedText,
      userName,
      timestamp: Date.now(),
      isPartial,
    };
    
    subtitleResults.value.push(subtitle);

    // 保持字幕列表长度，最多保留50条
    if (subtitleResults.value.length > 50) {
      subtitleResults.value.shift();
    }
    
    return subtitle.id; // 返回生成的ID
  };

  // 根据用户ID更新字幕（用于部分结果）
  const updateSubtitleByUserId = (userId: string, originalText: string, translatedText: string) => {
    const subtitle = subtitleResults.value.find(item => item.userId === userId && item.isPartial);
    if (subtitle) {
      subtitle.originalText = originalText;
      subtitle.translatedText = translatedText;
      subtitle.timestamp = Date.now();
      return true;
    }
    return false;
  };

  // 根据ID更新字幕
  const updateSubtitleById = (id: string, originalText: string, translatedText: string) => {
    const subtitle = subtitleResults.value.find(item => item.id === id);
    if (subtitle) {
      subtitle.originalText = originalText;
      subtitle.translatedText = translatedText;
      subtitle.timestamp = Date.now();
      return true;
    }
    return false;
  };

  // 完成字幕（将部分结果标记为完整）
  const completeSubtitle = (userId: string) => {
    const subtitle = subtitleResults.value.find(item => item.userId === userId && item.isPartial);
    if (subtitle) {
      subtitle.isPartial = false;
      return true;
    }
    return false;
  };

  // 根据ID完成字幕
  const completeSubtitleById = (id: string) => {
    const subtitle = subtitleResults.value.find(item => item.id === id);
    if (subtitle) {
      subtitle.isPartial = false;
      return true;
    }
    return false;
  };

  // 清空字幕历史
  const clearSubtitles = () => {
    subtitleResults.value = [];
  };

  // 获取最近的字幕
  const getRecentSubtitles = (count: number = 3) => {
    return subtitleResults.value.slice(-count);
  };

  // 根据用户ID获取字幕
  const getSubtitleByUserId = (userId: string) => {
    return subtitleResults.value.find(item => item.userId === userId);
  };

  // 根据ID获取字幕
  const getSubtitleById = (id: string) => {
    return subtitleResults.value.find(item => item.id === id);
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
    updateSubtitleByUserId,
    updateSubtitleById,
    completeSubtitle,
    completeSubtitleById,
    clearSubtitles,
    getRecentSubtitles,
    getSubtitleByUserId,
    getSubtitleById,
    cleanOldSubtitles,
  };
});
