<template>
  <div class="room-container">
    <conference-main-view display-mode="permanent"></conference-main-view>

    <!-- AI转录字幕显示 -->
    <subtitle-display
      v-if="aiTranscriptionEnabled"
      ref="subtitleDisplayRef"
      :subtitle="currentSubtitle"
      :show-history="true"
      :show-info="true"
      :max-history-count="20"
    />

    <!-- AI转录控制面板 -->
    <div v-if="aiTranscriptionEnabled" class="transcription-controls">
      <!-- 调试信息 -->
      <div class="debug-info" style="background: rgba(0,0,0,0.8); color: white; padding: 8px; margin-bottom: 10px; font-size: 12px; border-radius: 4px;">
        <div>AI转录启用: {{ aiTranscriptionEnabled }}</div>
        <div>房主权限: {{ isMaster }}</div>
        <div>转录状态: {{ transcriptionActive }}</div>
        <div>任务ID: {{ currentTaskId || '无' }}</div>
      </div>

      <button
        :class="['control-btn', { 'active': transcriptionActive }]"
        :disabled="!isMaster"
        @click="toggleTranscription"
      >
        {{ transcriptionActive ? '停止转录' : '开始转录' }}
      </button>
      <button
        class="control-btn clear-btn"
        @click="clearSubtitles"
      >
        清空字幕
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { ConferenceMainView, conference, RoomEvent, LanguageOption, ThemeOption } from '@tencentcloud/roomkit-web-vue3';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import router from '@/router';
import i18n, { useI18n } from '../locales/index';
import { getLanguage, getTheme } from  '../utils/utils';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import SubtitleDisplay from '../components/SubtitleDisplay.vue';
import { AITranscriptionManager, TranscriptionMessageHandler, type SubtitleMessage } from '../utils/aiTranscription';
import { AI_TRANSCRIPTION_CONFIG, SDKAPPID } from '../config/basic-info-config';
const { t } = useI18n();
const { theme } = useUIKit();

const route = useRoute();
const roomInfo = sessionStorage.getItem('tuiRoom-roomInfo');
const userInfo = sessionStorage.getItem('tuiRoom-userInfo');
const roomId = String(route.query.roomId);
conference.setLanguage(getLanguage() as LanguageOption);
!theme.value && conference.setTheme(getTheme() as ThemeOption);
let isExpectedJump = false;

// AI转录相关状态
const aiTranscriptionEnabled = ref(AI_TRANSCRIPTION_CONFIG.ENABLED);
const transcriptionActive = ref(false);
const currentSubtitle = ref<SubtitleMessage | undefined>(undefined);
const currentTaskId = ref<string>('');
const subtitleDisplayRef = ref();
const isMaster = ref(false);

// AI转录管理器
let transcriptionManager: AITranscriptionManager | null = null;
let messageHandler: TranscriptionMessageHandler | null = null;

if (!roomId) {
  router.push({ path: 'home' });
} else if (!roomInfo) {
  router.push({ path: 'home', query: { roomId } });
}

onMounted(async () => {
  const { action, isSeatEnabled, roomParam, hasCreated } = JSON.parse(roomInfo as string);
  const { sdkAppId, userId, userSig, userName, avatarUrl } = JSON.parse(userInfo as string);
  console.log('房间信息:', { action, isSeatEnabled, hasCreated });

  if (action === 'createRoom') {
    isMaster.value = true;
    console.log('设置为房主权限');
  } else {
    console.log('非房主，action:', action);
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

    // 初始化AI转录功能
    initTranscription();
  } catch (error: any) {
    sessionStorage.removeItem('tuiRoom-currentUserInfo');
  }
});

onBeforeRouteLeave((to: any, from: any, next: any) => {
  if (!isExpectedJump) {
    const message = isMaster.value
      ? t('This action causes the room to be disbanded, does it continue?')
      : t('This action causes the room to be exited, does it continue?');
    if (window.confirm(message)) {
      if (isMaster.value) {
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

onUnmounted(async () => {
  // 停止AI转录
  await stopTranscriptionOnUnmount();

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

// AI转录相关方法
const initTranscription = () => {
  console.log('初始化AI转录功能...');
  console.log('AI转录配置:', AI_TRANSCRIPTION_CONFIG);

  if (!aiTranscriptionEnabled.value) {
    console.log('AI转录功能未启用');
    return;
  }

  try {
    const { SECRET_ID, SECRET_KEY, REGION } = AI_TRANSCRIPTION_CONFIG;
    console.log('创建转录管理器...', { SECRET_ID: SECRET_ID ? '已设置' : '未设置', REGION });

    transcriptionManager = new AITranscriptionManager(SECRET_ID, SECRET_KEY, SDKAPPID, REGION);
    messageHandler = new TranscriptionMessageHandler(conference);

    // 设置字幕回调
    messageHandler.onSubtitle((subtitle) => {
      console.log('收到字幕:', subtitle);
      currentSubtitle.value = subtitle;
    });

    console.log('AI转录功能初始化完成');
  } catch (error) {
    console.error('AI转录功能初始化失败:', error);
  }
};

const toggleTranscription = async () => {
  console.log('点击转录按钮，检查状态:', {
    transcriptionManager: !!transcriptionManager,
    isMaster,
    transcriptionActive: transcriptionActive.value,
  });

  if (!transcriptionManager) {
    console.error('转录管理器未初始化');
    alert('转录管理器未初始化，请检查配置');
    return;
  }

  if (!isMaster.value) {
    console.error('只有房主可以启动转录');
    alert('只有房主可以启动转录功能');
    return;
  }

  try {
    if (transcriptionActive.value) {
      // 停止转录
      console.log('正在停止转录...');
      await transcriptionManager.stopTranscription(currentTaskId.value);
      transcriptionActive.value = false;
      currentTaskId.value = '';
      console.log('AI转录已停止');
    } else {
      // 开始转录
      console.log('正在启动转录...');
      const userInfoData = JSON.parse(userInfo as string);
      console.log('用户信息:', userInfoData);
      console.log('房间信息:', { roomId, mode: AI_TRANSCRIPTION_CONFIG.TRANSCRIPTION_MODE });

      const taskId = await transcriptionManager.startTranscription(
        roomId,
        userInfoData.userId,
        userInfoData.userSig,
        AI_TRANSCRIPTION_CONFIG.TRANSCRIPTION_MODE,
      );
      currentTaskId.value = taskId;
      transcriptionActive.value = true;
      console.log('AI转录已启动，任务ID:', taskId);
    }
  } catch (error: any) {
    console.error('AI转录操作失败:', error);
    alert(`AI转录操作失败: ${error.message || error}`);
  }
};

const clearSubtitles = () => {
  currentSubtitle.value = undefined;
  subtitleDisplayRef.value?.clearSubtitles();
};

// 在组件卸载时停止转录
const stopTranscriptionOnUnmount = async () => {
  if (transcriptionActive.value && transcriptionManager && currentTaskId.value) {
    try {
      await transcriptionManager.stopTranscription(currentTaskId.value);
    } catch (error) {
      console.error('停止转录失败:', error);
    }
  }
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

.transcription-controls {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-btn {
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 10px 16px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  min-width: 100px;
}

.control-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.3);
}

.control-btn.active {
  background: rgba(76, 175, 80, 0.8);
  border-color: #4CAF50;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clear-btn {
  background: rgba(244, 67, 54, 0.8);
  border-color: #f44336;
}

.clear-btn:hover:not(:disabled) {
  background: rgba(244, 67, 54, 0.9);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .transcription-controls {
    top: 10px;
    right: 10px;
  }

  .control-btn {
    padding: 8px 12px;
    font-size: 12px;
    min-width: 80px;
  }
}
</style>
