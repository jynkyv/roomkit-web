<template>
  <div class="room-container" :class="{ 'with-history': showHistoryPanel }">
    <!-- 左侧会议内容 -->
    <div class="room-content">
      <!-- 现有的房间组件 -->
      <conference-main-view display-mode="permanent"></conference-main-view>
    </div>
    
    <!-- 右侧翻译历史面板 -->
    <div v-show="showHistoryPanel" class="history-panel">
      <div class="panel-header">
        <div class="header-tabs">
          <div class="tab active">{{ t('Translation History') }}</div>
        </div>
        <div class="header-actions">
          <button class="clear-btn" @click="clearHistory" :title="t('Clear history')">
            <span class="clear-icon">🗑️</span>
          </button>
          <button class="close-btn" @click="toggleHistoryPanel">×</button>
        </div>
      </div>
      
      <div class="panel-content">
        <div v-if="translationHistory.length === 0" class="empty-history">
          <div class="empty-icon">📝</div>
          <p>{{ t('No translation history yet') }}</p>
        </div>
        <div v-else class="history-list">
          <div 
            v-for="(item, index) in translationHistory" 
            :key="item.id"
            class="history-item"
          >
            <div class="history-user">{{ item.userId }}</div>
            <div class="history-original">{{ item.original }}</div>
            <div class="history-translation">{{ item.translation }}</div>
            <div class="history-time">{{ formatTime(item.timestamp) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- WebSocket连接错误提示 -->
    <div v-if="showWebSocketError" class="websocket-error-overlay">
      <div class="websocket-error-modal">
        <div class="error-header">
          <h3>{{ t('Connection Error') }}</h3>
        </div>
        <div class="error-content">
          <p>{{ t('WebSocket connection failed. This may be due to browser cache issues.') }}</p>
          <p>{{ t('Please try the following solutions:') }}</p>
          <ul>
            <li>{{ t('1. Clear browser cache and refresh the page') }}</li>
            <li>{{ t('2. Try using incognito/private browsing mode') }}</li>
            <li>{{ t('3. Restart the browser') }}</li>
          </ul>
        </div>
        <div class="error-actions">
          <button @click="clearCacheAndRetry" class="btn-retry">
            {{ t('Clear Cache & Retry') }}
          </button>
          <button @click="dismissError" class="btn-dismiss">
            {{ t('Dismiss') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 字幕显示 -->
    <div class="subtitle-container" v-if="currentSubtitle">
      <div class="subtitle-content">
        <div class="subtitle-item" :key="currentSubtitle.id">
          <div class="subtitle-original">{{ currentSubtitle.original }}</div>
          <div class="subtitle-translation">{{ currentSubtitle.translation }}</div>
        </div>
      </div>
    </div>


  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { ConferenceMainView, conference, RoomEvent, LanguageOption, ThemeOption } from '../components/TUIRoom/index.ts';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import router from '../router/index';
import i18n, { useI18n } from '../locales/index';
import { getLanguage, getTheme, clearBrowserCache, checkAndFixWebSocketConnection } from  '../utils/utils';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { translationWebSocketService } from '../services/translationWebSocket';

const { t } = useI18n();
const { theme } = useUIKit();



// 字幕相关状态
const currentSubtitle = ref<{ original: string; translation: string; id: number; timestamp: number } | null>(null);
const subtitleTimeout = ref<number | null>(null);

// 翻译历史相关状态
const showHistoryPanel = ref(false);
const translationHistory = ref<Array<{
  id: string;
  original: string;
  translation: string;
  userId: string;
  timestamp: number;
}>>([]);



// WebSocket连接错误提示状态
const showWebSocketError = ref(false);



// 新字幕到来时显示并自动淡出
const showSubtitle = (original: string, translation: string) => {
  if (subtitleTimeout.value) {
    clearTimeout(subtitleTimeout.value);
    subtitleTimeout.value = null;
  }
  currentSubtitle.value = {
    original,
    translation,
    id: Date.now(),
    timestamp: Date.now(),
  };
  // 5秒后自动隐藏
  subtitleTimeout.value = window.setTimeout(() => {
    currentSubtitle.value = null;
    subtitleTimeout.value = null;
  }, 5000);
};

// 翻译历史相关方法
const toggleHistoryPanel = () => {
  showHistoryPanel.value = !showHistoryPanel.value;
};

const clearHistory = () => {
  translationHistory.value = [];
  // 触发全局事件，通知其他组件
  window.dispatchEvent(new CustomEvent('clear-translation-history'));
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) { // 1分钟内
    return t('Just now');
  } else if (diff < 3600000) { // 1小时内
    const minutes = Math.floor(diff / 60000);
    return `${minutes}${t('min ago')}`;
  } else if (diff < 86400000) { // 24小时内
    const hours = Math.floor(diff / 3600000);
    return `${hours}${t('h ago')}`;
  } else {
    return date.toLocaleDateString();
  }
};



// 监听WebSocket翻译结果
const handleTranslationResult = (data: any) => {
  if (data.fromUserId !== translationWebSocketService.getCurrentUserId()) {
    showSubtitle(data.data.original, data.data.translation);
  }
};

// 处理翻译广播
const handleTranslationBroadcast = (data: any) => {
  console.log('收到翻译广播:', data);
  
  // 显示字幕
  showSubtitle(data.zhText, data.jaText);
  
  // 添加到翻译历史
  const historyItem = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    original: data.zhText,
    translation: data.jaText,
    userId: data.userId,
    timestamp: data.timestamp || Date.now(),
  };
  
  translationHistory.value.unshift(historyItem);
  
  // 限制最多显示100条记录
  if (translationHistory.value.length > 100) {
    translationHistory.value = translationHistory.value.slice(0, 100);
  }
};

// 处理用户加入
const handleUserJoin = (data: any) => {
  console.log('用户加入:', data);
};

// 处理用户离开
const handleUserLeave = (data: any) => {
  console.log('用户离开:', data);
};

// 处理错误
const handleError = (data: any) => {
  console.error('WebSocket错误:', data);
  // 可以显示错误提示
};

// 初始化WebSocket连接
const initWebSocket = async () => {
  console.log('开始初始化WebSocket连接...');
  
  const userInfo = getUserInfo();
  const roomInfo = getRoomInfo();
  
  if (!userInfo || !roomInfo) {
    console.error('无法获取用户或房间信息');
    return;
  }
  
  try {
    await translationWebSocketService.connect(userInfo.userId, userInfo.userName, roomInfo.roomId);
    console.log('用户间通信WebSocket连接成功');
    
    // 注册事件监听器
    translationWebSocketService.on('translation_broadcast', handleTranslationBroadcast);
    translationWebSocketService.on('user_join', handleUserJoin);
    translationWebSocketService.on('user_leave', handleUserLeave);
    translationWebSocketService.on('error', handleError);
    
  } catch (error) {
    console.error('WebSocket连接失败:', error);
    showWebSocketErrorModal();
  }
};

// 获取用户信息
const getUserInfo = () => {
  try {
    const userInfoStr = sessionStorage.getItem('tuiRoom-userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      return {
        userId: userInfo.userId,
        userName: userInfo.userName
      };
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
  
  return null;
};

// 获取房间信息
const getRoomInfo = () => {
  try {
    const roomInfoStr = sessionStorage.getItem('tuiRoom-roomInfo');
    if (roomInfoStr) {
      const roomInfo = JSON.parse(roomInfoStr);
      return {
        roomId: roomInfo.roomId
      };
    }
  } catch (error) {
    console.error('获取房间信息失败:', error);
  }
  
  return null;
};

// 清理可能冲突的用户信息
const cleanupUserInfo = () => {
  console.log('开始清理用户信息...');
  
  // 检查WebSocket连接状态
  const isConnectionValid = checkAndFixWebSocketConnection();
  
  if (!isConnectionValid) {
    console.warn('检测到WebSocket连接问题，执行完整缓存清理...');
    clearBrowserCache();
  } else {
    console.log('WebSocket连接状态正常，执行基础清理...');
    
    // 只清理可能冲突的项
    const keysToClean = [
      'tuiRoom-currentUserInfo',
      'pendingRoomId'
    ];
    
    keysToClean.forEach(key => {
      try {
        const value = sessionStorage.getItem(key);
        if (value) {
          console.log(`清理存储项 ${key}:`, value);
          sessionStorage.removeItem(key);
        }
      } catch (error) {
        console.error(`清理存储项 ${key} 失败:`, error);
      }
    });
  }
  
  console.log('用户信息清理完成');
};

// 显示WebSocket连接错误提示
const showWebSocketErrorModal = () => {
  showWebSocketError.value = true;
  
  // 输出调试信息到控制台
  console.log('=== WebSocket连接问题诊断信息 ===');
  console.log('当前URL:', window.location.href);
  console.log('User Agent:', navigator.userAgent);
  console.log('sessionStorage内容:');
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key) {
      console.log(`  ${key}:`, sessionStorage.getItem(key));
    }
  }
  console.log('localStorage内容:');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      console.log(`  ${key}:`, localStorage.getItem(key));
    }
  }
  console.log('=== 诊断信息结束 ===');
};

// 清除缓存并重试WebSocket连接
const clearCacheAndRetry = () => {
  clearBrowserCache();
  showWebSocketError.value = false;
  initWebSocket(); // 重新尝试连接
};

// 关闭WebSocket连接错误提示
const dismissError = () => {
  showWebSocketError.value = false;
};

const route = useRoute();
const roomInfo = sessionStorage.getItem('tuiRoom-roomInfo');
const userInfo = sessionStorage.getItem('tuiRoom-userInfo');
const roomId = String(route.query.roomId);
conference.setLanguage(getLanguage() as LanguageOption);
!theme.value && conference.setTheme(getTheme() as ThemeOption);
let isMaster = false;
let isExpectedJump = false;

if (!roomId) {
  router.push({ path: 'home' });
} else if (!roomInfo) {
  router.push({ path: 'home', query: { roomId } });
}

// 组件挂载时初始化
onMounted(async () => {
  // 清理可能冲突的用户信息
  cleanupUserInfo();
  
  // 监听历史面板切换事件
  window.addEventListener('toggle-history-panel', (event: any) => {
    showHistoryPanel.value = event.detail.show;
  });
  
  // 监听清空历史事件
  window.addEventListener('clear-translation-history', () => {
    translationHistory.value = [];
  });
  
  const { action, isSeatEnabled, roomParam, hasCreated } = JSON.parse(roomInfo as string);
  const { sdkAppId, userId, userSig, userName, avatarUrl } = JSON.parse(userInfo as string);
  if (action === 'createRoom') {
    isMaster = true;
  }
  try {
    console.log('sdkAppId', sdkAppId);
    console.log('userId', userId);
    console.log('userSig', userSig);
    await conference.login({ sdkAppId, userId, userSig });
    await conference.setSelfInfo({ userName, avatarUrl });
    if (action === 'createRoom' && !hasCreated) {
      await conference.start(roomId, {
        roomName: `${userName || userId}${t('Quick Conference')}`,
        isSeatEnabled,
        ...roomParam,
      });
      const newRoomInfo = { action, roomId, roomName: roomId, isSeatEnabled, roomParam, hasCreated: true };
      sessionStorage.setItem('tuiRoom-roomInfo', JSON.stringify(newRoomInfo));
    } else {
      await conference.join(roomId, roomParam);
    }
    
    // 会议初始化完成后再连接WebSocket
    await initWebSocket();
    
  } catch (error: any) {
    sessionStorage.removeItem('tuiRoom-currentUserInfo');
    console.error('会议初始化失败:', error);
  }
});

// 组件卸载时清理
onUnmounted(() => {
  translationWebSocketService.off('translation_result', handleTranslationResult);
  translationWebSocketService.off('translation_broadcast', handleTranslationBroadcast);
  translationWebSocketService.off('user_join', handleUserJoin);
  translationWebSocketService.off('user_leave', handleUserLeave);
  translationWebSocketService.off('error', handleError);
  
  // 移除事件监听器
  window.removeEventListener('toggle-history-panel', () => {});
  window.removeEventListener('clear-translation-history', () => {});
});

onBeforeRouteLeave((to: any, from: any, next: any) => {
  if (!isExpectedJump) {
    const message = isMaster
      ? t('This action causes the room to be disbanded, does it continue?')
      : t('This action causes the room to be exited, does it continue?');
    if (window.confirm(message)) {
      if (isMaster) {
        conference?.dismiss();
      } else {
        conference?.leave();
      }
      next();
    } else {
      next(false);
    }
  } else {
    next();
  }
});

const backToPage = (page:string, shouldClearUserInfo: boolean) => {
  sessionStorage.removeItem('tuiRoom-roomInfo');
  shouldClearUserInfo && sessionStorage.removeItem('tuiRoom-currentUserInfo');
  goToPage(page);
};
const backToHome = () => backToPage('home', false);
const backToHomeAndClearUserInfo = () => backToPage('home', true);
const changeLanguage = (language: LanguageOption) => {
  i18n.global.locale.value = language;
  localStorage.setItem('tuiRoom-language', language);
};
const changeTheme = (theme: ThemeOption) => {
  localStorage.setItem('tuiRoom-currentTheme', theme);
};
conference.on(RoomEvent.ROOM_DISMISS, backToHome);
conference.on(RoomEvent.ROOM_LEAVE, backToHome);
conference.on(RoomEvent.KICKED_OUT, backToHome);
conference.on(RoomEvent.ROOM_ERROR, backToHome);
conference.on(RoomEvent.KICKED_OFFLINE, backToHome);
conference.on(RoomEvent.USER_SIG_EXPIRED, backToHomeAndClearUserInfo);
conference.on(RoomEvent.USER_LOGOUT, backToHomeAndClearUserInfo);
conference.on(RoomEvent.LANGUAGE_CHANGED, changeLanguage);
conference.on(RoomEvent.THEME_CHANGED, changeTheme);

onUnmounted(() => {
  conference.off(RoomEvent.ROOM_DISMISS, backToHome);
  conference.off(RoomEvent.ROOM_LEAVE, backToHome);
  conference.off(RoomEvent.KICKED_OUT, backToHome);
  conference.off(RoomEvent.ROOM_ERROR, backToHome);
  conference.off(RoomEvent.KICKED_OFFLINE, backToHome);
  conference.off(RoomEvent.USER_SIG_EXPIRED, backToHomeAndClearUserInfo);
  conference.off(RoomEvent.USER_LOGOUT, backToHomeAndClearUserInfo);
  conference.off(RoomEvent.LANGUAGE_CHANGED, changeLanguage);
  conference.off(RoomEvent.THEME_CHANGED, changeTheme);
  
  // 移除翻译结果监听
  translationWebSocketService.off('translation_result', handleTranslationResult);
  translationWebSocketService.off('translation_broadcast', handleTranslationBroadcast);
  translationWebSocketService.off('user_join', handleUserJoin);
  translationWebSocketService.off('user_leave', handleUserLeave);
  translationWebSocketService.off('error', handleError);
});

const goToPage = (routePath: string) => {
  isExpectedJump = true;
  router.replace({ path: routePath });
};
</script>

<style lang="scss">
#app {
  position: relative;
  width: 100%;
  height: 100%;
  font-family: 'PingFang SC';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.room-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
}

.room-container.with-history {
  /* 当显示历史面板时，调整布局 */
}

.room-content {
  flex: 1;
  min-width: 0; /* 防止flex子元素溢出 */
  transition: width 0.3s ease;
}

.room-container.with-history .room-content {
  width: calc(100% - 400px); /* 当显示历史面板时，会议内容占剩余空间 */
}



.room-content {
  width: 100%;
  height: 100%;
}

/* 翻译历史面板样式 */
.history-panel {
  width: 400px;
  height: 100vh;
  background: #1e1e1e;
  color: #d4d4d4;
  display: flex;
  flex-direction: column;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 13px;
  border-left: 1px solid #3c3c3c;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #2d2d30;
  border-bottom: 1px solid #3c3c3c;
  flex-shrink: 0;
  min-height: 32px;
}

.header-tabs {
  display: flex;
  align-items: center;
}

.tab {
  padding: 6px 12px;
  background: #007acc;
  color: white;
  border-radius: 4px 4px 0 0;
  font-size: 12px;
  font-weight: 500;
  cursor: default;
}

.tab.active {
  background: #007acc;
}

.header-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.clear-btn, .close-btn {
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  padding: 4px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.2s;
  font-size: 14px;
}

.clear-btn:hover, .close-btn:hover {
  background-color: #3c3c3c;
  color: #ffffff;
}

.close-btn {
  font-size: 16px;
  font-weight: bold;
}

.clear-icon {
  font-size: 12px;
}

.panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
}

.empty-history {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #6c757d;
  text-align: center;
}

.empty-history p {
  margin: 16px 0 0 0;
  font-size: 14px;
  color: #6c757d;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.history-list::-webkit-scrollbar {
  width: 8px;
}

.history-list::-webkit-scrollbar-track {
  background: #2d2d30;
}

.history-list::-webkit-scrollbar-thumb {
  background: #5a5a5a;
  border-radius: 4px;
}

.history-list::-webkit-scrollbar-thumb:hover {
  background: #7a7a7a;
}

.history-item {
  padding: 12px 16px;
  border-bottom: 1px solid #3c3c3c;
  transition: background-color 0.2s;
}

.history-item:hover {
  background-color: #2d2d30;
}

.history-item:last-child {
  border-bottom: none;
}

.history-user {
  font-size: 11px;
  color: #569cd6;
  margin-bottom: 4px;
  font-weight: 500;
}

.history-original {
  font-size: 13px;
  color: #d4d4d4;
  margin-bottom: 4px;
  line-height: 1.4;
}

.history-translation {
  font-size: 13px;
  color: #4ec9b0;
  margin-bottom: 4px;
  line-height: 1.4;
  font-weight: 500;
}

.history-time {
  font-size: 10px;
  color: #6a9955;
  text-align: right;
}

/* WebSocket连接错误提示样式 */
.websocket-error-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.websocket-error-modal {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  text-align: center;
  max-width: 400px;
  width: 90%;
}

.error-header h3 {
  color: #333;
  margin-bottom: 10px;
  font-size: 20px;
}

.error-content p {
  color: #555;
  font-size: 14px;
  margin-bottom: 10px;
  line-height: 1.5;
}

.error-content ul {
  list-style: none;
  padding: 0;
  margin: 0 0 20px 0;
  text-align: left;
}

.error-content ul li {
  color: #666;
  font-size: 13px;
  margin-bottom: 5px;
  line-height: 1.4;
}

.error-actions {
  display: flex;
  justify-content: space-around;
  gap: 10px;
}

.btn-retry, .btn-dismiss {
  padding: 8px 15px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: background-color 0.3s ease;
}

.btn-retry {
  background-color: #4CAF50;
  color: white;
}

.btn-retry:hover {
  background-color: #388E3C;
}

.btn-dismiss {
  background-color: #f44336;
  color: white;
}

.btn-dismiss:hover {
  background-color: #D32F2F;
}

/* 字幕样式 */
.subtitle-container {
  position: fixed;
  bottom: 80px;
  left: 0;
  right: 0;
  z-index: 1001;
  padding: 0 20px;
  pointer-events: none;
}

.subtitle-content {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subtitle-item {
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 12px 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.subtitle-original {
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
  line-height: 1.4;
}

.subtitle-translation {
  color: #ffd700;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.3;
  opacity: 0.9;
}



@media (max-width: 768px) {
  .subtitle-container {
    bottom: 60px;
    padding: 0 15px;
  }
  
  .subtitle-content {
    max-width: 100%;
  }
  
  .subtitle-item {
    padding: 10px 12px;
  }
  
  .subtitle-original {
    font-size: 14px;
  }
  
  .subtitle-translation {
    font-size: 12px;
  }
  
  /* 移动端历史面板样式 */
  .room-container.with-history .room-content {
    width: 0;
    overflow: hidden;
  }
  
  .history-panel {
    width: 100%;
  }
}
</style>
