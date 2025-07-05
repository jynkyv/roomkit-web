import { createI18n, useI18n } from 'vue-i18n';
import { getLanguage } from '../utils/utils';
import ZH from './zh-CN';
import JA from './ja-JP';

// Register i8n instance and introduce language files
const i18n = createI18n({
  legacy: false,
  locale: getLanguage() || 'zh-CN',
  messages: {
    'zh-CN': ZH,
    'ja-JP': JA,
  },
});

export default i18n;

export { useI18n };
