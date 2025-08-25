<template>
  <div class="room-container">
    <!-- 左侧会议内容 -->
    <div class="room-content">
      <!-- 现有的房间组件 -->
      <conference-main-view display-mode="permanent"></conference-main-view>
    </div>

    <!-- 多用户字幕显示 -->
    <div class="subtitle-container" v-if="displaySubtitles.length > 0">
      <div class="subtitle-content">
        <div 
          v-for="[userId, subtitle] in displaySubtitles" 
          :key="subtitle.id"
          class="subtitle-item"
        >
          <div class="subtitle-user" v-if="subtitle.userName">{{ subtitle.userName }}</div>
          <div class="subtitle-original">{{ subtitle.original }}</div>
          <div class="subtitle-translation">{{ subtitle.translation }}</div>
        </div>
      </div>
    </div>

    <!-- 单用户字幕显示（兼容性，保留但不再使用） -->
    <div class="subtitle-container" v-if="currentSubtitle">
      <div class="subtitle-content">
        <div class="subtitle-item" :key="currentSubtitle.id">
          <div class="subtitle-user" v-if="currentSubtitle.userName">{{ currentSubtitle.userName }}</div>
          <div class="subtitle-original">{{ currentSubtitle.original }}</div>
          <div class="subtitle-translation">{{ currentSubtitle.translation }}</div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue';
import { ConferenceMainView, conference, RoomEvent, LanguageOption, ThemeOption } from '../components/TUIRoom/index.ts';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import router from '../router/index';
import i18n, { useI18n } from '../locales/index';
import { getLanguage, getTheme, clearBrowserCache, checkAndFixWebSocketConnection } from  '../utils/utils';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { translationWebSocketService } from '../services/translationWebSocket';
import { useSubtitleStore } from '../stores/subtitle';
import { LanguageConfigService } from '../services/languageConfig';

const { t } = useI18n();
const { theme } = useUIKit();

// 字幕store
const subtitleStore = useSubtitleStore();

// 多用户字幕状态管理
const activeSubtitles = ref<Map<string, {
  original: string;
  translation: string;
  id: number;
  timestamp: number;
  userName: string;
  timeoutId: number;
}>>(new Map());

// 计算属性：只显示最新的3个字幕
const displaySubtitles = computed(() => {
  const subtitles = Array.from(activeSubtitles.value.entries());
  // 按时间戳排序，最新的在前
  subtitles.sort((a, b) => b[1].timestamp - a[1].timestamp);
  // 只返回最新的3个
  return subtitles.slice(0, 3);
});

// 字幕相关状态（保留用于兼容性）
const currentSubtitle = ref<{ original: string; translation: string; id: number; timestamp: number; userName?: string } | null>(null);
const subtitleTimeout = ref<number | null>(null);


// WebSocket连接错误提示状态
// const showWebSocketError = ref(false); // Removed


// 多用户字幕显示函数
const showSubtitle = (original: string, translation: string, userName?: string) => {
  const displayUserName = userName || '未知用户';
  const userId = displayUserName; // 使用用户名作为唯一标识
  
  // 清除该用户的旧定时器
  const existingSubtitle = activeSubtitles.value.get(userId);
  if (existingSubtitle) {
    clearTimeout(existingSubtitle.timeoutId);
  }
  
  // 创建新的字幕条目
  const subtitleId = Date.now();
  const timeoutId = window.setTimeout(() => {
    activeSubtitles.value.delete(userId);
  }, 5000); // 5秒后自动隐藏
  
  activeSubtitles.value.set(userId, {
    original,
    translation,
    id: subtitleId,
    timestamp: Date.now(),
    userName: displayUserName,
    timeoutId
  });
};

// 兼容性函数（保留原有逻辑）
const showSingleSubtitle = (original: string, translation: string, userName?: string) => {
  if (subtitleTimeout.value) {
    clearTimeout(subtitleTimeout.value);
    subtitleTimeout.value = null;
  }
  currentSubtitle.value = {
    original,
    translation,
    id: Date.now(),
    timestamp: Date.now(),
    userName: userName || '未知用户',
  };
  // 5秒后自动隐藏
  subtitleTimeout.value = window.setTimeout(() => {
    currentSubtitle.value = null;
    subtitleTimeout.value = null;
  }, 5000);
};

// 监听字幕store变化，显示最新的字幕
watch(() => subtitleStore.subtitleResults, (newResults) => {
  if (newResults.length > 0) {
    const latestSubtitle = newResults[newResults.length - 1];
    showSubtitle(
      latestSubtitle.originalText,
      latestSubtitle.translatedText,
      latestSubtitle.userName
    );
  }
}, { deep: true });

// 处理翻译广播
const handleTranslationBroadcast = (data: any) => {
  console.log('收到翻译广播:', data);
  
  // 获取当前用户信息，判断是否是自己发送的消息
  const currentUserInfo = getUserInfo();
  const isOwnMessage = currentUserInfo && data.userId === currentUserInfo.userId;
  
  // 获取语言配置
  const languageConfig = LanguageConfigService.getConfig();
  
  // 根据语言配置决定显示内容
  let displayOriginal: string;
  let displayTranslation: string;
  
  if (data.oriLang === languageConfig.sourceLanguage) {
    // 如果广播的源语言是本客户端的源语言，显示original作为主字幕
    displayOriginal = data.original;
    displayTranslation = data.translation;
  } else if (data.targetLang === languageConfig.sourceLanguage) {
    // 如果广播的目标语言是本客户端的源语言，显示translation作为主字幕
    displayOriginal = data.translation;
    displayTranslation = data.original;
  } else {
    // 默认显示（兼容性处理）
    displayOriginal = data.original;
    displayTranslation = data.translation;
  }
  
  console.log('语言配置智能显示:', {
    clientSourceLang: languageConfig.sourceLanguage,
    broadcastOriLang: data.oriLang,
    broadcastTargetLang: data.targetLang,
    displayOriginal,
    displayTranslation
  });
  
  // 显示字幕，使用实际的用户名
  const displayUserName = data.userName || '未知用户';
  showSubtitle(displayOriginal, displayTranslation, displayUserName);
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
    console.log('sessionStorage中的房间信息:', roomInfoStr);
    if (roomInfoStr) {
      const roomInfo = JSON.parse(roomInfoStr);
      console.log('解析后的房间信息:', roomInfo);
      return {
        roomId: roomInfo.roomId
      };
    }
  } catch (error) {
    console.error('获取房间信息失败:', error);
  }
  console.warn('未找到房间信息');
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
// const showWebSocketErrorModal = () => { // Removed
//   // showWebSocketError.value = true; // Removed
//   
//   // 输出调试信息到控制台
//   console.log('=== WebSocket连接问题诊断信息 ===');
//   console.log('当前URL:', window.location.href);
//   console.log('User Agent:', navigator.userAgent);
//   console.log('sessionStorage内容:');
//   for (let i = 0; i < sessionStorage.length; i++) {
//     const key = sessionStorage.key(i);
//     if (key) {
//       console.log(`  ${key}:`, sessionStorage.getItem(key));
//     }
//   }
//   console.log('localStorage内容:');
//   for (let i = 0; i < localStorage.length; i++) {
//     const key = localStorage.key(i);
//     if (key) {
//       console.log(`  ${key}:`, localStorage.getItem(key));
//     }
//   }
//   console.log('=== 诊断信息结束 ===');
// };

// 清除缓存并重试WebSocket连接
// const clearCacheAndRetry = () => { // Removed
//   clearBrowserCache();
//   // showWebSocketError.value = false; // Removed
//   initWebSocket(); // 重新尝试连接
// };

// 关闭WebSocket连接错误提示
// const dismissError = () => { // Removed
//   // showWebSocketError.value = false; // Removed
// };

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
  // window.addEventListener('toggle-history-panel', (event: any) => {
  //   // showHistoryPanel.value = event.detail.show; // Removed
  // });
  
  // 监听清空历史事件
  // window.addEventListener('clear-translation-history', () => {
  //   // translationHistory.value = []; // Removed
  // });
  
  const userInfo = getUserInfo();
  const roomInfo = getRoomInfo();
  
  if (!userInfo || !roomInfo) {
    console.error('无法获取用户或房间信息');
    return;
  }
  
  // 从sessionStorage获取完整的用户和房间信息
  const userInfoStr = sessionStorage.getItem('tuiRoom-userInfo');
  const roomInfoStr = sessionStorage.getItem('tuiRoom-roomInfo');
  
  if (!userInfoStr || !roomInfoStr) {
    console.error('sessionStorage中缺少用户或房间信息');
    return;
  }
  
  const fullUserInfo = JSON.parse(userInfoStr);
  const fullRoomInfo = JSON.parse(roomInfoStr);
  
  const { action, isSeatEnabled, roomParam, hasCreated } = fullRoomInfo;
  const { sdkAppId, userId, userSig, userName, avatarUrl } = fullUserInfo;
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
  // 清理所有字幕定时器
  activeSubtitles.value.forEach((subtitle) => {
    clearTimeout(subtitle.timeoutId);
  });
  activeSubtitles.value.clear();
  
  // 清理单用户字幕定时器
  if (subtitleTimeout.value) {
    clearTimeout(subtitleTimeout.value);
  }
  
  translationWebSocketService.off('translation_broadcast', handleTranslationBroadcast);
  translationWebSocketService.off('user_join', handleUserJoin);
  translationWebSocketService.off('user_leave', handleUserLeave);
  translationWebSocketService.off('error', handleError);
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

.room-content {
  flex: 1;
  min-width: 0; /* 防止flex子元素溢出 */
  width: 100%;
  height: 100%;
}

/* 字幕样式 */
.subtitle-container {
  position: fixed;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  max-width: 80%;
  text-align: center;
}

.subtitle-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.subtitle-item {
  background: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 10px 16px;
  border-radius: 6px;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.subtitle-user {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 3px;
  color: #ffd700;
}

.subtitle-original {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 3px;
  color: #ffffff;
  line-height: 1.3;
}

.subtitle-translation {
  font-size: 13px;
  color: #cccccc;
  font-style: italic;
  line-height: 1.2;
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
    padding: 10px 15px;
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
