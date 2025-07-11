<template>
  <div class="room-container">
    <conference-main-view display-mode="permanent"></conference-main-view>

    <!-- 只保留字幕显示，翻译控制已集成到底部控制栏 -->
    <div class="subtitle-container" v-if="currentSubtitle">
      <div class="subtitle-content">
        <div class="subtitle-item" :key="currentSubtitle.id">
          <div class="subtitle-original">{{ currentSubtitle.original }}</div>
          <div class="subtitle-translation">{{ currentSubtitle.translation }}</div>
        </div>
      </div>
    </div>

    <!-- 翻译历史记录 -->
    <div 
      class="translation-history" 
      v-if="translationHistory.length > 0 && showHistory"
      :style="{ left: historyPosition.x + 'px', top: historyPosition.y + 'px' }"
      ref="historyRef"
    >
      <div 
        class="history-header"
        @mousedown="startDrag"
        @touchstart="startDrag"
      >
        <span class="history-title">{{ t('Translation History') }}</span>
        <button class="clear-history-btn" @click="clearHistory" :title="t('Clear history')">
          ×
        </button>
      </div>
      <div class="history-content">
        <div 
          v-for="(item, index) in translationHistory" 
          :key="item.id"
          class="history-item"
        >
          <div class="history-text">{{ item.translation }}</div>
          <div class="history-time">{{ formatTime(item.timestamp) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { ConferenceMainView, conference, RoomEvent, LanguageOption, ThemeOption } from '../components/TUIRoom/index.ts';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import router from '../router/index';
import i18n, { useI18n } from '../locales/index';
import { getLanguage, getTheme } from  '../utils/utils';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { translationWebSocketService } from '../services/translationWebSocket';

const { t } = useI18n();
const { theme } = useUIKit();

// 字幕相关状态
const currentSubtitle = ref<{ original: string; translation: string; id: number; timestamp: number } | null>(null);
const subtitleTimeout = ref<number | null>(null);

// 翻译历史相关状态
const translationHistory = ref<Array<{
  id: string;
  translation: string;
  timestamp: number;
}>>([]);

// 控制历史记录显示状态
const showHistory = ref(true);

// 拖拽相关状态
const historyRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const dragStartPos = ref({ x: 0, y: 0 });
const historyPosition = ref({ x: 420, y: 20 }); // 初始位置

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

// 添加翻译历史记录
const addToHistory = (translation: string) => {
  const historyItem = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    translation,
    timestamp: Date.now()
  };
  
  translationHistory.value.unshift(historyItem);
  
  // 限制最多显示100条记录
  if (translationHistory.value.length > 100) {
    translationHistory.value = translationHistory.value.slice(0, 100);
  }
};

// 清空历史记录
const clearHistory = () => {
  translationHistory.value = [];
  showHistory.value = false; // 清空时也隐藏历史记录
};

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

// 开始拖拽
const startDrag = (event: MouseEvent | TouchEvent) => {
  event.preventDefault();
  isDragging.value = true;
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
  
  dragStartPos.value = {
    x: clientX - historyPosition.value.x,
    y: clientY - historyPosition.value.y
  };
  
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('touchmove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchend', stopDrag);
};

// 拖拽中
const onDrag = (event: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return;
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
  
  const newX = clientX - dragStartPos.value.x;
  const newY = clientY - dragStartPos.value.y;
  
  // 限制在窗口范围内
  const maxX = window.innerWidth - 300; // 历史记录宽度
  const maxY = window.innerHeight - 200; // 历史记录高度
  
  historyPosition.value = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(0, Math.min(newY, maxY))
  };
};

// 停止拖拽
const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchend', stopDrag);
};

// 监听WebSocket翻译结果
const handleTranslationResult = (data: any) => {
  if (data.fromUserId !== translationWebSocketService.getCurrentUserId()) {
    showSubtitle(data.data.original, data.data.translation);
    
    // 添加到历史记录
    if (data.data.translation) {
      addToHistory(data.data.translation);
      // 显示历史记录
      showHistory.value = true;
    }
  }
};

// 监听翻译广播
const handleTranslationBroadcast = (data: any) => {
  console.log('收到翻译广播:', data);
  showSubtitle(data.original, data.translation);
  
  // 添加到历史记录
  if (data.translation) {
    addToHistory(data.translation);
    // 显示历史记录
    showHistory.value = true;
  }
};

// 监听翻译开始事件
const handleTranslationStarted = () => {
  // 翻译开始时显示历史记录
  showHistory.value = true;
};

// 监听翻译停止事件
const handleTranslationStopped = () => {
  // 翻译停止时隐藏历史记录
  showHistory.value = false;
  console.log('翻译停止，隐藏翻译历史');
};

// 监听翻译状态更新
const handleTranslationStatusUpdated = (statusMap: Record<string, any>) => {
  console.log('翻译状态更新:', statusMap);
  
  // 检查当前用户是否还在查看任何翻译
  const currentUserId = translationWebSocketService.getCurrentUserId();
  let isViewingAnyTranslation = false;
  
  for (const [userId, status] of Object.entries(statusMap)) {
    if (status.viewers && Array.isArray(status.viewers)) {
      if (status.viewers.includes(currentUserId)) {
        isViewingAnyTranslation = true;
        break;
      }
    }
  }
  
  // 如果当前用户没有在查看任何翻译，隐藏历史记录
  if (!isViewingAnyTranslation) {
    showHistory.value = false;
    console.log('当前用户没有在查看任何翻译，隐藏翻译历史');
  }
};

// 初始化WebSocket连接
const initWebSocket = async () => {
  const userInfo = getUserInfo();
  const roomInfo = getRoomInfo();
  
  if (!userInfo) {
    console.error('无法获取用户信息，用户间通信WebSocket连接失败');
    return;
  }
  
  if (!roomInfo) {
    console.error('无法获取房间信息，用户间通信WebSocket连接失败');
    return;
  }
  
  try {
    await translationWebSocketService.connect(userInfo.userId, userInfo.userName, roomInfo.roomId);
    console.log('用户间通信WebSocket连接成功');
    
    // 注册事件监听器
    translationWebSocketService.on('translation_result', handleTranslationResult);
    translationWebSocketService.on('translation_broadcast', handleTranslationBroadcast);
    translationWebSocketService.on('translation_started', handleTranslationStarted);
    translationWebSocketService.on('translation_stopped', handleTranslationStopped);
    translationWebSocketService.on('translation_status_updated', handleTranslationStatusUpdated);
    
  } catch (error) {
    console.error('用户间通信WebSocket连接失败:', error);
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
  translationWebSocketService.off('translation_started', handleTranslationStarted);
  translationWebSocketService.off('translation_stopped', handleTranslationStopped);
  translationWebSocketService.off('translation_status_updated', handleTranslationStatusUpdated);
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
  translationWebSocketService.off('translation_started', handleTranslationStarted);
  translationWebSocketService.off('translation_stopped', handleTranslationStopped);
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

/* 翻译历史记录样式 */
.translation-history {
  position: fixed;
  width: 300px;
  max-height: 200px; /* 限制高度，只显示约5条记录 */
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  z-index: 999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  user-select: none; /* 防止拖拽时选中文字 */
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px 8px 0 0;
  cursor: move; /* 显示拖拽光标 */
  user-select: none;
}

.history-header:hover {
  background: rgba(0, 0, 0, 0.4);
}

.history-title {
  font-weight: 500;
  font-size: 12px;
  color: #fff;
  pointer-events: none; /* 防止标题文字影响拖拽 */
}

.clear-history-btn {
  background: none;
  border: none;
  color: #ccc;
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  pointer-events: auto; /* 确保按钮可以点击 */
}

.clear-history-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.history-content {
  max-height: 140px; /* 限制内容区域高度 */
  overflow-y: auto;
  padding: 8px 0;
}

.history-content::-webkit-scrollbar {
  width: 4px;
}

.history-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.history-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.history-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

.history-item {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background-color 0.2s;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.history-item:last-child {
  border-bottom: none;
}

.history-text {
  color: #fff;
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 4px;
  word-wrap: break-word;
}

.history-time {
  color: #ccc;
  font-size: 11px;
  opacity: 0.7;
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
  
  .translation-history {
    width: calc(100vw - 20px);
    max-width: 300px;
    max-height: 150px;
  }
}
</style>
