/**
 * i18n Instructions for use：
 *
 * <script>
 * import i18n, { useI18n } from '../locale';
 * const { t } = useI18n();
 *
 * // case 1: There are no variables in the translation text
 * t('happy');
 * i18n.t('happy');
 * // case 2: Variable exists in translation text
 * t('kick sb. out of room', { someOneName: 'xiaoming' });
 * i18n.t('kick sb. out of room', { someOneName: 'xiaoming' });
 *
 * // switch language
 * switch (i18n.global.locale.value) {
 *  case 'ja-JP':
 *    i18n.global.locale.value = 'zh-CN';
 *    break;
 *  case 'zh-CN':
 *    i18n.global.locale.value = 'ja-JP';
 *    break;
 * }
 * </script>
 */

import { getLanguage } from '../utils/utils';
import ZH from './zh-CN';
import JA from './ja-JP';
import { ref } from 'vue';

const locale = ref('');
class TUIKitI18n {
  messages: Record<string, any>;
  global: Record<string, any>;

  constructor(options: { messages: Record<string, any>; locale: string }) {
    this.messages = options.messages;
    locale.value = options.locale;
    this.global = {};
    this.global.locale = locale;
    this.global.t = this.t.bind(this);
  }

  private getNamed(option: Record<string, any>) {
    return (key: string) => option[key] || key;
  }

  private t(key: any, option?: Record<string, any>) {
    const currentLocale = locale.value || 'zh-CN';
    const message = this.messages[currentLocale];
    
    // 如果当前语言的消息不存在，使用中文作为后备
    if (!message) {
      console.warn(`Translation messages for locale '${currentLocale}' not found, falling back to 'zh-CN'`);
      const fallbackMessage = this.messages['zh-CN'];
      if (!fallbackMessage || !fallbackMessage[key]) {
        console.warn(`Translation key '${key}' not found in any locale`);
        return key;
      }
      if (typeof fallbackMessage[key] === 'function') {
        const named = this.getNamed(option || {});
        return fallbackMessage[key]({ named });
      }
      return fallbackMessage[key];
    }
    
    if (!message[key]) {
      console.warn(`Translation key '${key}' not found in locale '${currentLocale}'`);
      return key;
    }
    if (typeof message[key] === 'function') {
      const named = this.getNamed(option || {});
      return message[key]({ named });
    }
    return message[key];
  }

  public install() {}
}

// 确保有默认语言
const defaultLocale = getLanguage() || 'zh-CN';
console.log('初始化国际化系统，默认语言:', defaultLocale);

const i18n = new TUIKitI18n({
  locale: defaultLocale,
  messages: {
    'zh-CN': ZH,
    'ja-JP': JA,
  },
});

// 确保初始化时就有正确的语言设置
if (!i18n.global.locale.value) {
  i18n.global.locale.value = defaultLocale;
}

export default i18n;

export function useI18n() {
  return {
    t: i18n.global.t.bind(i18n),
  };
}
