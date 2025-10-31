<template>
  <div class="home-container">
    <!-- 移除自定义登出按钮，使用腾讯云会议原生登出 -->
    <pre-conference-view
      :user-info="userInfo"
      :room-id="givenRoomId"
      :enable-scheduled-conference="true"
      :is-show-logo="false"
      @on-create-room="handleCreateRoom"
      @on-enter-room="handleEnterRoom"
      @on-logout="handleLogout"
      @on-update-user-name="handleUpdateUserName"
    ></pre-conference-view>
  </div>
</template>

<script setup lang="ts">
import { PreConferenceView, conference, RoomEvent, LanguageOption, ThemeOption } from '../components/TUIRoom/index';
import { getBasicInfo } from '@/config/basic-info-config';
import router from '@/router';
import { useRoute } from 'vue-router';
import { Ref, ref, reactive, onMounted, onUnmounted } from 'vue';
import i18n from '../locales/index';
import { getLanguage, getTheme } from  '../utils/utils';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { useAuthStore } from '@/stores/auth';

const { theme } = useUIKit();
const route = useRoute();
const { roomId } = route.query;
const givenRoomId: Ref<string> = ref((roomId) as string);
const authStore = useAuthStore();

const userInfo = reactive({
  userId: '',
  userName: '',
  avatarUrl: '',
});

function setTUIRoomData(action: string, roomOption: Record<string, any>) {
  sessionStorage.setItem('tuiRoom-roomInfo', JSON.stringify({
    action,
    ...roomOption,
  }));
}

async function checkRoomExistWhenCreateRoom(roomId: string) {
  let isRoomExist = false;
  const tim = conference.getRoomEngine()?.getTIM();
  try {
    await tim?.searchGroupByID(roomId);
    isRoomExist = true;
  } catch (error: any) {
    // room does not exist
  }
  return isRoomExist;
}

/**
 * Generate room number when creating a room
**/
async function generateRoomId(): Promise<string> {
  const roomId = String(Math.ceil(Math.random() * 1000000));
  const isRoomExist = await checkRoomExistWhenCreateRoom(String(roomId));
  if (isRoomExist) {
    return await generateRoomId();
  }
  return roomId;
}

/**
 * Processing Click [Create Room]
**/
async function handleCreateRoom(roomOption: Record<string, any>) {
  setTUIRoomData('createRoom', roomOption);
  const roomId = await generateRoomId();
  router.push({
    path: 'room',
    query: {
      roomId,
    },
  });
}

/**
 * Processing Click [Enter Room]
**/
async function handleEnterRoom(roomOption: Record<string, any>) {
  setTUIRoomData('enterRoom', roomOption);
  router.push({
    path: 'room',
    query: {
      roomId: roomOption.roomId,
    },
  });
}

function handleUpdateUserName(userName: string) {
  try {
    const currentUserInfo = JSON.parse(sessionStorage.getItem('tuiRoom-userInfo') as string);
    currentUserInfo.userName = userName;
    sessionStorage.setItem('tuiRoom-userInfo', JSON.stringify(currentUserInfo));
  } catch (error) {
    console.log('sessionStorage error', error);
  }
}

// 使用腾讯云会议原生登出功能
const handleLogout = async () => {
  // 先调用腾讯云会议的登出
  await conference.logout();
  
  // 然后调用我们的认证登出
  await authStore.logout();
  
  // 跳转到登录页
  router.push('/login');
};

async function handleInit() {
  console.log('=== handleInit 开始 ===');
  
  sessionStorage.removeItem('tuiRoom-roomInfo');
  sessionStorage.removeItem('tuiRoom-userInfo');
  conference.setLanguage(getLanguage() as LanguageOption);
  !theme.value && conference.setTheme(getTheme() as ThemeOption);
  
  // 获取认证用户信息
  const currentUser = authStore.user;
  console.log('当前认证用户:', currentUser);
  
  // 获取基本配置信息，使用新的用户格式
  console.log('正在获取基本配置信息...');
  // 将User格式转换为getBasicInfo期望的格式
  const userForBasicInfo = currentUser ? {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.name, // 如果没有email，使用name
    avatar_url: currentUser.avatarUrl
  } : null;
  const currentUserInfo = getBasicInfo(userForBasicInfo);
  console.log('currentUserInfo:', currentUserInfo);
  
  if (!currentUserInfo) {
    console.error('获取基本配置信息失败');
    return;
  }
  
  // 设置用户信息
  userInfo.userId = currentUserInfo.userId;
  userInfo.userName = currentUserInfo.userName;
  userInfo.avatarUrl = currentUserInfo.avatarUrl;
  
  console.log('最终 userInfo:', userInfo);
  
  // 创建完整的用户信息对象，包含所有必要的字段
  const completeUserInfo = {
    sdkAppId: currentUserInfo.sdkAppId,
    userId: userInfo.userId,
    userSig: currentUserInfo.userSig,
    userName: userInfo.userName,
    avatarUrl: userInfo.avatarUrl,
  };
  
  console.log('completeUserInfo:', completeUserInfo);
  
  // 存储到 sessionStorage
  sessionStorage.setItem('tuiRoom-userInfo', JSON.stringify(completeUserInfo));
  
  // 登录腾讯云会议
  console.log('开始登录腾讯云会议...');
  console.log('登录参数:', { 
    sdkAppId: currentUserInfo.sdkAppId, 
    userId: userInfo.userId, 
    userSig: currentUserInfo.userSig 
  });
  
  try {
    await conference.login({ 
      sdkAppId: currentUserInfo.sdkAppId, 
      userId: userInfo.userId, 
      userSig: currentUserInfo.userSig 
    });
    console.log('腾讯云会议登录成功');
    
    await conference.setSelfInfo({ 
      userName: userInfo.userName, 
      avatarUrl: userInfo.avatarUrl 
    });
    console.log('设置用户信息成功');
  } catch (error) {
    console.error('腾讯云会议登录失败:', error);
  }
  
  console.log('=== handleInit 结束 ===');
}

const changeLanguage = (language: LanguageOption) => {
  i18n.global.locale.value = language;
  localStorage.setItem('tuiRoom-language', language);
}
const changeTheme = (theme: ThemeOption) => {
  localStorage.setItem('tuiRoom-currentTheme', theme);
};
const handleAcceptedInvitation = async (roomId: string) => {
  await handleEnterRoom({
    roomId,
    roomParam: {
      isOpenCamera: false,
      isOpenMicrophone: true,
    },
  });
};

onMounted(() => {
  conference.on(RoomEvent.LANGUAGE_CHANGED, changeLanguage);
  conference.on(RoomEvent.THEME_CHANGED, changeTheme);
  conference.on(RoomEvent.CONFERENCE_INVITATION_ACCEPTED, handleAcceptedInvitation);
});

onUnmounted(() => {
  conference.off(RoomEvent.LANGUAGE_CHANGED, changeLanguage);
  conference.off(RoomEvent.THEME_CHANGED, changeTheme);
  conference.off(RoomEvent.CONFERENCE_INVITATION_ACCEPTED, handleAcceptedInvitation);
});

handleInit();
</script>

<style scoped>
.home-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
