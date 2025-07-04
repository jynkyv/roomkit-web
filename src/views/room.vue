<template>
  <conference-main-view display-mode="permanent"></conference-main-view>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { ConferenceMainView, conference, RoomEvent, LanguageOption, ThemeOption, roomService } from '@tencentcloud/roomkit-web-vue3';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import router from '../router';
import i18n, { useI18n } from '../locales/index';
import { getLanguage, getTheme } from  '../utils/utils';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { startAITranscription } from '../http';
import { generateBotUserInfo } from '../utils/generateUserSig';

// 在 conference-main-view 组件 onmounted 之前调用
roomService.setComponentConfig({ AIControl: { visible: true } });
const { t } = useI18n();
const { theme } = useUIKit();

const route = useRoute();
const roomInfo = sessionStorage.getItem('tuiRoom-roomInfo');
const userInfo = sessionStorage.getItem('tuiRoom-userInfo');
const roomId = String(route.query.roomId);
conference.setLanguage(getLanguage() as LanguageOption);
!theme.value && conference.setTheme(getTheme() as ThemeOption);
let isMaster = false;
let isExpectedJump = false;

// 获取 sdkAppId
const sdkAppId = JSON.parse(roomInfo as string)?.roomParam?.sdkAppId || JSON.parse(userInfo as string)?.sdkAppId;

if (!roomId) {
  router.push({ path: 'home' });
} else if (!roomInfo) {
  router.push({ path: 'home', query: { roomId } });
}

onMounted(async () => {
  const { action, isSeatEnabled, roomParam, hasCreated } = JSON.parse(roomInfo as string);
  const { sdkAppId: userSdkAppId, userId, userSig, userName, avatarUrl } = JSON.parse(userInfo as string);
  if (action === 'createRoom') {
    isMaster = true;
  }
  try {
    await conference.login({ sdkAppId: userSdkAppId, userId, userSig });
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

// const handleAITask = (data: { roomId: string }) => {
//   const { roomId } = data;
//   // 生成随机机器人用户信息
//   const botUserInfo = generateBotUserInfo(sdkAppId, '1cb3faaed3543947fa61450a179db1de95b3469d27555e305aace5eb5a7f5e8b'); // 请替换为您的实际密钥
//   startAITranscription({
//     RoomId: roomId,
//     UserId: botUserInfo.userId, // 随机生成的机器人用户ID
//     UserSig: botUserInfo.userSig, // 动态生成的机器人 userSig
//     SdkAppId: sdkAppId,
//     RoomIdType: 1, // 房间类型为字符串房间
//   });
// };

// conference.on(RoomEvent.ROOM_JOIN, handleAITask);
// conference.on(RoomEvent.ROOM_START, handleAITask);
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
  conference.off(RoomEvent.ROOM_JOIN, handleAITask);
  conference.off(RoomEvent.ROOM_START, handleAITask);
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
</style>
