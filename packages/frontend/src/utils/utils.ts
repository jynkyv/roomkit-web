/**
 * Get the value of the specified key from window.location.href
 * @param {*} key key to get
 * @returns Get the value of the specified key from window.location.href
 * @example
 * const value = getUrlParam(key);
 */
export function getUrlParam(key: string) {
  const url = window?.location.href.replace(/^[^?]*\?/, '');
  const regexp = new RegExp(`(^|&)${key}=([^&#]*)(&|$|)`, 'i');
  const paramMatch = url?.match(regexp);

  return paramMatch ? paramMatch[2] : null;
}

/**
 * Get language
 * @returns language
 */
export function getLanguage() {
  let language = getUrlParam('lang')
    || localStorage.getItem('tuiRoom-language')
    || navigator.language
    || 'zh-CN';
  language = language.replace(/_/, '-').toLowerCase();
  const isZh = language.startsWith('zh');
  const isJa = language.startsWith('ja');
  language = isZh ? 'zh-CN' : isJa ? 'ja-JP' : 'zh-CN';

  return language;
}

/**
 * Get Theme
 * @returns Theme
 */
export function getTheme() {
  let storedTheme = localStorage.getItem('tuiRoom-currentTheme') || 'LIGHT';

  if (storedTheme === 'light') {
    storedTheme = 'LIGHT';
  } else if (storedTheme === 'dark') {
    storedTheme = 'DARK';
  }

  return storedTheme;
}

export function setItemInSessionStorage(key: string, value: object) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function generateTempUserID(userId: string) {
  const timestamp = String(Date.now()).slice(-4);
  return `${userId}_${timestamp}`;
}

export function isValidTestUserId(userId: string) {
  const regex = /_([0-9]{4})$/;
  return regex.test(userId);
}

/**
 * 清理浏览器缓存和存储，解决WebSocket连接问题
 */
export const clearBrowserCache = () => {
  console.log('开始清理浏览器缓存...');
  
  // 清理sessionStorage
  const sessionKeysToClean = [
    'tuiRoom-userInfo',
    'tuiRoom-roomInfo', 
    'tuiRoom-currentUserInfo',
    'pendingRoomId'
  ];
  
  sessionKeysToClean.forEach(key => {
    try {
      if (sessionStorage.getItem(key)) {
        console.log(`清理sessionStorage: ${key}`);
        sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`清理sessionStorage失败 ${key}:`, error);
    }
  });
  
  // 清理localStorage
  const localKeysToClean = [
    'pendingRoomId',
    'tuiRoom-language',
    'tuiRoom-currentTheme'
  ];
  
  localKeysToClean.forEach(key => {
    try {
      if (localStorage.getItem(key)) {
        console.log(`清理localStorage: ${key}`);
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`清理localStorage失败 ${key}:`, error);
    }
  });
  
  // 清理IndexedDB（如果存在）
  if ('indexedDB' in window) {
    try {
      indexedDB.databases().then(databases => {
        databases.forEach(db => {
          console.log(`清理IndexedDB: ${db.name}`);
          indexedDB.deleteDatabase(db.name);
        });
      });
    } catch (error) {
      console.error('清理IndexedDB失败:', error);
    }
  }
  
  // 清理Service Worker（如果存在）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        console.log('清理Service Worker');
        registration.unregister();
      });
    });
  }
  
  console.log('浏览器缓存清理完成');
};

/**
 * 强制刷新页面，清除所有缓存
 */
export const forceRefreshPage = () => {
  console.log('强制刷新页面...');
  
  // 清理缓存
  clearBrowserCache();
  
  // 强制刷新页面
  window.location.reload();
};

/**
 * 检查并修复WebSocket连接问题
 */
export const checkAndFixWebSocketConnection = () => {
  console.log('检查WebSocket连接状态...');
  
  const userInfo = sessionStorage.getItem('tuiRoom-userInfo');
  const roomInfo = sessionStorage.getItem('tuiRoom-roomInfo');
  
  console.log('当前用户信息:', userInfo);
  console.log('当前房间信息:', roomInfo);
  
  if (!userInfo || !roomInfo) {
    console.warn('检测到用户信息或房间信息缺失，建议清理缓存后重试');
    return false;
  }
  
  try {
    const userInfoObj = JSON.parse(userInfo);
    const roomInfoObj = JSON.parse(roomInfo);
    
    // 检查用户信息是否完整
    if (!userInfoObj.userId || !userInfoObj.userName) {
      console.warn('检测到用户信息不完整，建议清理缓存后重试');
      return false;
    }
    
    // 检查房间信息是否完整（创建房间时可能还没有roomId）
    if (!roomInfoObj.action) {
      console.warn('检测到房间信息不完整，建议清理缓存后重试');
      return false;
    }
    
    console.log('用户信息和房间信息检查通过');
    return true;
  } catch (error) {
    console.error('解析用户信息或房间信息失败:', error);
    return false;
  }
};
