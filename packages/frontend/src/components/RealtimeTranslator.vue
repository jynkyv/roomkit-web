<!-- eslint-disable -->
<template>
  <div class="translator-widget" v-if="showTranslator">
    <div class="translator-header">
      <div class="translator-title">
        <span class="translator-icon">🌐</span>
        <span>{{ t('Translation') }}</span>
      </div>
      <div class="header-right">
        <span class="connection-status" :class="{ connected: isWebSocketConnected }">
          {{ isWebSocketConnected ? t('Connected') : t('Disconnected') }}
        </span>
        <button class="close-btn" @click="toggleTranslator">×</button>
      </div>
    </div>

    <div class="translator-content">
      <!-- 语言控制 -->
      <div class="language-controls">
        <div class="section-title">{{ t('Translation settings') }}</div>
        <div class="lang-selector">
          <select v-model="fromLang" class="lang-select" :disabled="isInitiating">
            <option value="zh-CHS">{{ t('Chinese') }}</option>
            <option value="ja">{{ t('Japanese') }}</option>
          </select>
          <span class="arrow">→</span>
          <select v-model="toLang" class="lang-select" :disabled="isInitiating">
            <option value="ja">{{ t('Japanese') }}</option> 
            <option value="zh-CHS">{{ t('Chinese') }}</option>
          </select>
        </div>
      </div>

      <!-- 用户选择器 -->
      <div class="user-selection">
        <div class="section-title">{{ t('Select translation target') }}</div>
        <UserSelector 
          v-model:showSelector="showUserSelector"
          @translation-started="handleTranslationStarted"
          @translation-stopped="handleTranslationStopped"
          :fromLang="fromLang"
          :toLang="toLang"
        />
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>

  <!-- 双语字幕显示 -->
  <div class="subtitle-container" v-if="showTranslator && currentSubtitle">
    <div class="subtitle-content">
      <div class="subtitle-item" :key="currentSubtitle.id">
        <div class="subtitle-original">{{ currentSubtitle.original }}</div>
        <div class="subtitle-translation">{{ currentSubtitle.translation }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import UserSelector from './UserSelector.vue'
import { translationWebSocketService, type TranslationUser } from '../services/translationWebSocket'
import { useI18n } from '../locales'

// 环境变量
const appKey = import.meta.env.VITE_YOUDAO_APP_KEY;
const appSecret = import.meta.env.VITE_YOUDAO_APP_SECRET;

// Props
interface Props {
  showTranslator: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:showTranslator': [value: boolean]
}>()

// 国际化
const { t } = useI18n();

// 响应式数据
const fromLang = ref('zh-CHS');
const toLang = ref('ja');
const apiFromLang = ref('zh-CHS');
const apiToLang = ref('ja');
const isRecording = ref(false);
const isInitiating = ref(false); // 发起翻译的状态
const connectionStatus = ref(t('Disconnected'));
const error = ref('');
const showUserSelector = ref(false);
const currentTargetUser = ref<TranslationUser | null>(null);
const isWebSocketConnected = ref(false);

// 新增：管理翻译会话
const activeTranslationSessions = ref<Map<string, {
  targetUserId: string;
  targetUserName: string;
  isInitiator: boolean; // true表示我是发起者，false表示我是被翻译者
  fromLang: string;
  toLang: string;
}>>(new Map());

// 新增：管理我被要求翻译的会话（key为发起者id）
const activeIncomingSessions = ref<Map<string, {
  fromUserId: string;
  fromUserName: string;
  fromLang: string;
  toLang: string;
}>>(new Map());

const recognitionResults = ref<Array<{ text: string; timestamp: number }>>([]);
const translationResults = ref<Array<{ text: string; timestamp: number }>>([]);

// 专门用于WebSocket翻译结果的数组
const websocketTranslationResults = ref<Array<{ original: string; translation: string; timestamp: number }>>([]);

// WebSocket相关
// 注意：ws变量只用于有道WebSocket，不要和用户间WebSocket混用！
let ws: WebSocket | null = null;
let audioContext: any = null;
let processor: any = null;
let stream: any = null;

// 计算属性
const hasValidConfig = computed(() => {
  return !!appKey && !!appSecret;
});

const canStart = computed(() => {
  return hasValidConfig.value && currentTargetUser.value;
});

// 字幕结果计算属性 - 只显示WebSocket接收到的翻译结果
const subtitleResults = computed(() => {
  return websocketTranslationResults.value.map((result, index) => ({
    original: result.original,
    translation: result.translation,
    id: index,
    timestamp: result.timestamp
  }));
});

// 字幕显示状态
const visibleSubtitles = ref<Set<number>>(new Set());

// 字幕淡出效果
const fadeOutSubtitle = (id: number) => {
  setTimeout(() => {
    visibleSubtitles.value.delete(id);
  }, 5000); // 5秒后开始淡出
};

// 监听字幕变化，添加新字幕到可见列表
const addNewSubtitle = () => {
  if (subtitleResults.value.length > 0) {
    const latestSubtitle = subtitleResults.value[subtitleResults.value.length - 1];
    visibleSubtitles.value.add(latestSubtitle.id);
    fadeOutSubtitle(latestSubtitle.id);
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
  
  // 如果没有用户信息，返回null
  return null;
};

// 初始化WebSocket连接
const initWebSocket = async () => {
  const userInfo = getUserInfo();
  if (!userInfo) {
    console.error('无法获取用户信息，用户间通信WebSocket连接失败');
    error.value = t('Failed to get user info');
    return;
  }

  try {
    await translationWebSocketService.connect(userInfo.userId, userInfo.userName);
    isWebSocketConnected.value = true;
    connectionStatus.value = t('Connected');
    console.log('用户间通信WebSocket连接成功，用户:', userInfo.userName);
  } catch (error) {
    console.error('用户间通信WebSocket连接失败:', error);
    error.value = t('WebSocket connection failed');
  }
};

// 方法
const toggleTranslator = () => {
  emit('update:showTranslator', !props.showTranslator);
};

// 处理翻译开始（作为发起者）
const handleTranslationStarted = (userId: string, userName: string) => {
  // 创建新的翻译会话
  const sessionId = `initiator_${userId}`;
  activeTranslationSessions.value.set(sessionId, {
    targetUserId: userId,
    targetUserName: userName,
    isInitiator: true,
    fromLang: fromLang.value,
    toLang: toLang.value
  });
  
  currentTargetUser.value = {
    id: userId,
    name: userName,
    isOnline: true
  };
  showUserSelector.value = false;
  isInitiating.value = true;
  
  // 作为发起者，只发送指令，不录音
  connectionStatus.value = t('Waiting for target user to start translation...');
  console.log(`发送翻译指令给用户: ${userName} (${userId})`);
};

// 处理翻译停止（作为发起者停止对目标用户的翻译）
const handleTranslationStopped = (userId: string) => {
  const sessionId = `initiator_${userId}`;
  const session = activeTranslationSessions.value.get(sessionId);
  
  if (session && session.isInitiator) {
    // 只停止作为发起者的翻译会话
    activeTranslationSessions.value.delete(sessionId);
    currentTargetUser.value = null;
    isInitiating.value = false;
    console.log(`停止对用户 ${session.targetUserName} 的翻译`);
    
    // 发送停止翻译指令给目标用户
    translationWebSocketService.stopTranslation(userId);
  } else {
    // 如果不是发起者，说明是用户主动停止，不需要发送停止指令
    console.log('用户主动停止翻译，不发送停止指令');
    // 清理本地状态
    activeTranslationSessions.value.delete(sessionId);
    currentTargetUser.value = null;
    isInitiating.value = false;
  }
};

// SHA256
const sha256 = async (str: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// 生成签名
const generateSign = async (
  appKey: string,
  salt: string,
  curtime: string,
  appSecret: string,
): Promise<string> => {
  const signStr = appKey + salt + curtime + appSecret
  return await sha256(signStr)
}

// 生成UUID
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// 获取麦克风音频流
const getMicrophoneStream = async () => {
  try {
    console.log('获取麦克风音频流...');
    const micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      } 
    });
    console.log('麦克风音频流获取成功');
    return micStream;
  } catch (error) {
    console.error('获取麦克风音频流失败:', error);
    throw error;
  }
};

// 开始录音（作为被翻译的用户）
const startRecording = async () => {
  if (!hasValidConfig.value) {
    error.value = t('Please configure Youdao API key')
    return
  }
  
  try {
    error.value = ''
    connectionStatus.value = t('Recording...')

    // 获取麦克风音频流
    stream = await getMicrophoneStream();
    console.log('音频流:', stream);

    // 如果还没有创建音频上下文，创建一个
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
    }

    // 创建音频源
    const source = audioContext.createMediaStreamSource(stream);

    // 使用较小的缓冲区大小，确保实时性
    processor = audioContext.createScriptProcessor(2048, 1, 1);

    processor.onaudioprocess = (e: any) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0)
        const audioData = new Int16Array(inputData.length)

        // 转换音频数据为16位PCM格式
        for (let i = 0; i < inputData.length; i++) {
          // 将浮点数转换为16位整数，确保范围在-32768到32767之间
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          audioData[i] = Math.round(sample * 32767);
        }

        // 检查音频数据是否有效（有声音）
        const hasAudio = audioData.some(sample => Math.abs(sample) > 100);
        if (hasAudio) {
          console.log('发送音频数据，长度:', audioData.length);
          ws.send(audioData.buffer)
        }
      }
    }

    source.connect(processor)
    processor.connect(audioContext.destination)

    await connectWebSocket()

    isRecording.value = true
    connectionStatus.value = t('Recording...')
  } catch (err) {
    error.value = `${t('Recording failed')}: ${err instanceof Error ? err.message : String(err)}`
    connectionStatus.value = t('Connection failed')
    console.error('录音失败:', err);
  }
}

// 连接WebSocket
const connectWebSocket = async (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    const salt = generateUUID()
    const curtime = Math.floor(Date.now() / 1000).toString()
    const sign = await generateSign(appKey, salt, curtime, appSecret)

    const params = new URLSearchParams({
      appKey: appKey,
      salt,
      curtime,
      sign,
      signType: 'v4',
      from: apiFromLang.value,
      to: apiToLang.value,
      format: 'wav',
      channel: '1',
      version: 'v1',
      rate: '16000',
      streamEpType: 'short',
      transPattern: 'sentence',
      noitn: '0',
    })

    const wsUrl = `wss://openapi.youdao.com/stream_speech_trans?${params.toString()}`

    console.log('有道翻译WebSocket连接URL:', wsUrl);
    console.log('使用的语言设置:', { from: apiFromLang.value, to: apiToLang.value });

    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      connectionStatus.value = t('Connected')
      console.log('有道翻译WebSocket连接成功，语言设置:', { from: apiFromLang.value, to: apiToLang.value });
      resolve()
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data)
          console.log('收到WebSocket消息:', data);
          
          if (data.action === 'started' && data.errorCode === '0') {
            connectionStatus.value = '开始识别...'
            console.log('开始识别成功');
          } else if (data.action === 'recognition') {
            if (data.result) {
              const result = data.result
              // 处理识别结果
              if (result.context) {
                console.log('识别结果:', result.context);
              }
              // 处理翻译结果
              if (result.tranContent) {
                console.log('翻译结果:', result.tranContent);
                
                // 发送翻译结果给所有正在请求我的用户
                sendTranslationResultsToAll(result.context || '', result.tranContent);
              }
            } else if (data.action === 'error') {
              const errorMsg = getErrorMessage(data.errorCode);
              error.value = `识别错误: ${data.errorCode} - ${errorMsg}`
              connectionStatus.value = '连接错误'
              console.error('识别错误:', data);
            }
          }
        } catch (err) {
          console.error('解析消息失败:', err)
        }
      }
    }

    ws.onerror = (event) => {
      error.value = t('Connection error')
      connectionStatus.value = t('Connection error')
      console.error('有道翻译WebSocket错误:', event);
      reject(new Error('有道翻译WebSocket连接失败'))
    }

    ws.onclose = () => {
      connectionStatus.value = t('Connection closed')
      console.log('有道翻译WebSocket连接已关闭');
      ws = null;
    }
  })
}

// 获取错误信息
const getErrorMessage = (errorCode: string): string => {
  const errorMessages: { [key: string]: string } = {
    '108': '音频格式错误，请检查音频参数设置',
    '101': '缺少必要参数',
    '102': '签名错误',
    '103': '访问频率受限',
    '104': '账户余额不足',
    '105': 'qps超限',
    '106': '长连接达到上限',
    '107': '参数错误',
    '109': '音频数据错误',
    '110': '音频数据过大',
    '111': '音频数据过小',
    '112': '音频数据为空',
    '113': '音频数据格式不支持',
    '114': '音频数据采样率不支持',
    '115': '音频数据声道数不支持',
    '116': '音频数据位深度不支持',
    '117': '音频数据编码格式不支持',
    '118': '音频数据压缩格式不支持',
    '119': '音频数据加密格式不支持',
    '120': '音频数据签名错误',
    '121': '音频数据时间戳错误',
    '122': '音频数据序列号错误',
    '123': '音频数据校验和错误',
    '124': '音频数据长度错误',
    '125': '音频数据偏移量错误',
    '126': '音频数据块大小错误',
    '127': '音频数据块数量错误',
    '128': '音频数据块索引错误',
    '129': '音频数据块数据错误',
    '130': '音频数据块校验错误',
    '131': '音频数据块压缩错误',
    '132': '音频数据块加密错误',
    '133': '音频数据块签名错误',
    '134': '音频数据块时间戳错误',
    '135': '音频数据块序列号错误',
    '136': '音频数据块校验和错误',
    '137': '音频数据块长度错误',
    '138': '音频数据块偏移量错误',
    '139': '音频数据块大小错误',
    '140': '音频数据块数量错误',
    '141': '音频数据块索引错误',
    '142': '音频数据块数据错误',
    '143': '音频数据块校验错误',
    '144': '音频数据块压缩错误',
    '145': '音频数据块加密错误',
    '146': '音频数据块签名错误',
    '147': '音频数据块时间戳错误',
    '148': '音频数据块序列号错误',
    '149': '音频数据块校验和错误',
    '150': '音频数据块长度错误'
  };
  
  return errorMessages[errorCode] || t('Unknown error');
};

// 停止录音
const stopRecording = () => {
  // 只关闭有道翻译的WebSocket连接，不影响用户间通信的WebSocket
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ end: 'true' }))
    ws.close()
    ws = null;
  }

  if (processor) {
    processor.disconnect()
    processor = null
  }

  if (audioContext) {
    audioContext.close()
    audioContext = null
  }

  // 停止音频流
  if (stream) {
    stream.getTracks().forEach((track: any) => {
      track.stop();
    });
    stream = null;
  }

  isRecording.value = false
  connectionStatus.value = t('Connection closed')
  currentTargetUser.value = null;
  isInitiating.value = false;
}

// 停止有道翻译（只停止有道API，不关闭用户间WebSocket）
const stopYoudaoTranslation = () => {
  // 只关闭有道翻译的WebSocket连接，不影响用户间通信的WebSocket
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ end: 'true' }))
    ws.close()
    ws = null;
  }

  if (processor) {
    processor.disconnect()
    processor = null
  }

  if (audioContext) {
    audioContext.close()
    audioContext = null
  }

  // 停止音频流
  if (stream) {
    stream.getTracks().forEach((track: any) => {
      track.stop();
    });
    stream = null;
  }

  isRecording.value = false
  connectionStatus.value = t('Connection closed')
  currentTargetUser.value = null;
  isInitiating.value = false;
}

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

// 监听字幕变化
watch(subtitleResults, (newResults, oldResults) => {
  if (newResults.length > (oldResults?.length || 0)) {
    addNewSubtitle();
  }
}, { deep: true });

// 监听WebSocket翻译结果（作为接收者）
const handleTranslationResult = (data: any) => {
  if (data.fromUserId !== translationWebSocketService.getCurrentUserId()) {
    // 收到其他用户的翻译结果
    websocketTranslationResults.value.push({
      original: data.data.original,
      translation: data.data.translation,
      timestamp: data.data.timestamp,
    });
    console.log('收到WebSocket翻译结果:', data.data);
  }
};

// 监听开始翻译指令（作为被翻译的用户）
const handleStartTranslation = (data: any) => {
  if (data.toUserId === translationWebSocketService.getCurrentUserId()) {
    console.log('收到开始翻译指令:', data);
    console.log('当前本地语言设置:', { fromLang: fromLang.value, toLang: toLang.value });
    console.log('指令中的语言设置:', { fromLang: data.fromLang, toLang: data.toLang });
    
    // 新增一条被要求翻译的会话
    activeIncomingSessions.value.set(data.fromUserId, {
      fromUserId: data.fromUserId,
      fromUserName: data.fromUserName || '发起用户',
      fromLang: data.fromLang || 'zh-CHS',
      toLang: data.toLang || 'en',
    });
    
    // 设置API专用的语言设置，不修改本地翻译设置
    if (data.fromLang) {
      apiFromLang.value = data.fromLang;
      console.log('设置 apiFromLang:', data.fromLang);
    }
    if (data.toLang) {
      apiToLang.value = data.toLang;
      console.log('设置 apiToLang:', data.toLang);
    }
    
    console.log('设置后的API语言设置:', { from: apiFromLang.value, to: apiToLang.value });
    
    // 如果已经在录音，先停止当前连接
    if (isRecording.value) {
      console.log('停止当前翻译连接，使用新的语言设置重新连接');
      stopYoudaoTranslation();
    }
    
    // 延迟一下确保连接完全关闭，然后重新开始录音
    setTimeout(() => {
      startRecording();
    }, 100);
  }
};

// 监听停止翻译指令（作为被翻译的用户停止翻译）
const handleStopTranslation = (data: any) => {
  if (data.toUserId === translationWebSocketService.getCurrentUserId()) {
    console.log('收到停止翻译指令');
    activeIncomingSessions.value.delete(data.fromUserId);
    // 如果没有任何被要求翻译的会话了，才停止有道API
    if (activeIncomingSessions.value.size === 0) {
      stopYoudaoTranslation();
    }
  }
};

// 组件挂载时注册事件监听器
const setupWebSocketListeners = () => {
  translationWebSocketService.on('translation_result', handleTranslationResult);
  translationWebSocketService.on('start_translation', handleStartTranslation);
  translationWebSocketService.on('stop_translation', handleStopTranslation);
};

// 组件挂载时初始化WebSocket连接
onMounted(async () => {
  // 注册事件监听器
  setupWebSocketListeners();
  
  // 初始化WebSocket连接
  await initWebSocket();
});

// 组件卸载时清理资源
onUnmounted(() => {
  // 只停止有道翻译，不关闭用户间WebSocket连接
  if (isRecording.value) {
    stopYoudaoTranslation();
  }
  
  translationWebSocketService.off('translation_result', handleTranslationResult);
  translationWebSocketService.off('start_translation', handleStartTranslation);
  translationWebSocketService.off('stop_translation', handleStopTranslation);
  
  // 注意：不要在这里断开用户间WebSocket连接，因为其他组件可能还在使用
  // translationWebSocketService.disconnect();
});

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

// 监听翻译结果，显示字幕
watch(
  websocketTranslationResults,
  (results) => {
    if (results.length > 0) {
      const lastResult = results[results.length - 1];
      if (lastResult.original || lastResult.translation) {
        showSubtitle(lastResult.original, lastResult.translation);
      }
    }
  },
  { deep: true }
);

// 发送翻译结果给所有正在请求我的用户
const sendTranslationResultsToAll = (original: string, translation: string) => {
  for (const [fromUserId, session] of activeIncomingSessions.value.entries()) {
    translationWebSocketService.sendTranslationResult(fromUserId, {
      original,
      translation,
      timestamp: Date.now(),
      fromUserId: translationWebSocketService.getCurrentUserId(),
      toUserId: fromUserId,
    });
  }
};
</script>

<style scoped>
.translator-widget {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 380px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

.translator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
  border-bottom: 1px solid #e9ecef;
}

.translator-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 15px;
}

.translator-icon {
  font-size: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.connection-status {
  font-size: 13px;
  font-weight: 500;
  color: #28a745;
}

.connection-status.connected {
  color: #28a745;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #e9ecef;
}

.translator-content {
  padding: 16px;
}

.section-title {
  font-weight: 600;
  font-size: 14px;
  color: #495057;
  margin-bottom: 8px;
}

.user-selection {
  margin-bottom: 16px;
}

.language-controls {
  margin-bottom: 16px;
}

.lang-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lang-select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  color: #495057;
}

.lang-select:disabled {
  background: #f8f9fa;
  color: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.lang-select:disabled:hover {
  border-color: #dee2e6;
}

.arrow {
  color: #6c757d;
  font-size: 14px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-stop {
  background: #dc3545;
  color: #fff;
}

.btn-stop:hover {
  background: #c82333;
}

.error-message {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  color: #721c24;
  font-size: 13px;
}

@media (max-width: 768px) {
  .translator-widget {
    top: 10px;
    right: 10px;
    left: 10px;
    width: auto;
  }
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

/* 字幕淡入淡出动画 */
.subtitle-fade-enter-active,
.subtitle-fade-leave-active {
  transition: all 0.8s ease;
}

.subtitle-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.subtitle-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.subtitle-item.fade-out {
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.5s ease;
}
</style> 
