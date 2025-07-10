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

// 监听WebSocket翻译结果
const handleTranslationResult = (data: any) => {
  if (data.fromUserId !== translationWebSocketService.getCurrentUserId()) {
    showSubtitle(data.data.original, data.data.translation);
  }
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
  } catch (error: any) {
    sessionStorage.removeItem('tuiRoom-currentUserInfo');
  }
  
  // 注册翻译结果监听
  translationWebSocketService.on('translation_result', handleTranslationResult);
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
}
</style>
