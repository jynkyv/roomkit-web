<template>
  <div class="room-container">
    <conference-main-view display-mode="permanent"></conference-main-view>

    <!-- 翻译按钮 -->
    <button
      @click="toggleTranslator"
      class="translator-toggle-btn"
      :class="{ active: showTranslator }"
    >
      🌐
    </button>

    <!-- 翻译组件 -->
    <RealtimeTranslator
      v-model:showTranslator="showTranslator"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { ConferenceMainView, conference, RoomEvent, LanguageOption, ThemeOption } from '@tencentcloud/roomkit-web-vue3';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import router from '../router/index';
import i18n, { useI18n } from '../locales/index';
import { getLanguage, getTheme } from  '../utils/utils';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import RealtimeTranslator from '../components/RealtimeTranslator.vue';
const { t } = useI18n();
const { theme } = useUIKit();

// 翻译相关状态
const showTranslator = ref(false);

const route = useRoute();
const roomInfo = sessionStorage.getItem('tuiRoom-roomInfo');
const userInfo = sessionStorage.getItem('tuiRoom-userInfo');
const roomId = String(route.query.roomId);
conference.setLanguage(getLanguage() as LanguageOption);
!theme.value && conference.setTheme(getTheme() as ThemeOption);
let isMaster = false;
let isExpectedJump = false;

// 翻译相关方法
const toggleTranslator = () => {
  showTranslator.value = !showTranslator.value;
};

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

.translator-toggle-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #e9ecef;
  font-size: 20px;
  cursor: pointer;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;

  &:hover {
    background: #f8f9fa;
    border-color: #28a745;
    transform: scale(1.05);
  }

  &.active {
    background: #28a745;
    border-color: #28a745;
    color: #fff;
  }
}

@media (max-width: 768px) {
  .translator-toggle-btn {
    top: 10px;
    right: 10px;
    width: 45px;
    height: 45px;
    font-size: 18px;
  }
}
</style>
