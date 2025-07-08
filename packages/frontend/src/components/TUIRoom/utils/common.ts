import { getUrlParam } from './utils';

const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
};

type ThemeOption = 'LIGHT' | 'DARK';

/**
 * Get Language
 * @returns language
 */
export function getLanguage() {
  const isWxMiniProgram = typeof wx !== 'undefined' && wx.getSystemInfoSync;

  let language =
    getUrlParam('lang') ||
    navigator.language ||
    (isWxMiniProgram ? 'zh-CN' : 'zh-CN');
  language = language.replace(/_/, '-').toLowerCase();
  const isZh = language.startsWith('zh');
  const isJa = language.startsWith('ja');
  language = isZh ? 'zh-CN' : isJa ? 'ja-JP' : 'zh-CN';

  return language;
}

/**
 * Determine if a string is a number
 * @returns boolean
 */
export function checkNumber(roomId: string) {
  const reg = /^\d+$/;
  return reg.test(roomId);
}

export function toTargetTheme(themeOption: ThemeOption) {
  const theme = themeOption === 'DARK' ? THEME.DARK : THEME.LIGHT;
  return theme;
}

// RoomKit schedule conference passwords restricted to digital checksums
export const invalidDigitalPasswordRegex = /[^\d]+/g;
// RoomKit enter room Password legitimacy verification
export const invalidPasswordRegex =
  /[^A-Za-z0-9!@#$%^&*()_+{}|:"<>?`~';[\]\\/.,-=]+/g;
