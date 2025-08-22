import { useSubtitleStore } from '../stores/subtitle';

class SubtitleService {
  private subtitleStore = useSubtitleStore();

  // 添加字幕
  addSubtitle(text: string, userName: string) {
    this.subtitleStore.addSubtitle(text, userName);
  }

  // 清空字幕
  clearSubtitles() {
    this.subtitleStore.clearSubtitles();
  }

  // 获取字幕历史
  getSubtitleHistory() {
    return this.subtitleStore.subtitleResults;
  }

  // 获取最近的字幕
  getRecentSubtitles(count: number = 3) {
    return this.subtitleStore.getRecentSubtitles(count);
  }
}

// 创建单例实例
export const subtitleService = new SubtitleService();
