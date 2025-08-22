export interface LanguageConfig {
  sourceLanguage: string;
  targetLanguage: string;
}

export class LanguageConfigService {
  private static readonly CONFIG_KEY = 'translation-language-config';
  
  // 获取语言配置
  static getConfig(): LanguageConfig {
    try {
      const savedConfig = localStorage.getItem(this.CONFIG_KEY);
      if (savedConfig) {
        return JSON.parse(savedConfig);
      }
    } catch (error) {
      console.error('获取语言配置失败:', error);
    }
    
    // 默认配置
    return {
      sourceLanguage: 'zh-CHS',
      targetLanguage: 'ja',
    };
  }
  
  // 保存语言配置
  static saveConfig(config: LanguageConfig): void {
    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('保存语言配置失败:', error);
    }
  }
  
  // 检查是否有有效配置
  static hasValidConfig(): boolean {
    try {
      const config = this.getConfig();
      return config.sourceLanguage && config.targetLanguage && 
             config.sourceLanguage !== config.targetLanguage;
    } catch (error) {
      return false;
    }
  }
  
  // 获取语言名称
  static getLanguageName(code: string): string {
    const languageNames: Record<string, string> = {
      'zh-CHS': '中文',
      'ja': '日本語',
    };
    return languageNames[code] || code;
  }
  
  // 清除配置
  static clearConfig(): void {
    try {
      localStorage.removeItem(this.CONFIG_KEY);
    } catch (error) {
      console.error('清除语言配置失败:', error);
    }
  }
}
