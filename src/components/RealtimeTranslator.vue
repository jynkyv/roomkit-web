<!-- eslint-disable -->
<template>
  <div class="translator-widget" v-if="showTranslator">
    <div class="translator-header">
      <div class="translator-title">
        <span class="translator-icon">🌐</span>
        <span>实时翻译</span>
      </div>
      <button class="close-btn" @click="toggleTranslator">×</button>
    </div>

    <div class="translator-content">
      <!-- 用户选择器 -->
      <div v-if="!isRecording" class="user-selection">
        <UserSelector 
          v-model:showSelector="showUserSelector"
          @translation-started="handleTranslationStarted"
          @translation-stopped="handleTranslationStopped"
        />
      </div>

      <!-- 语言控制 -->
      <div v-if="!isRecording" class="language-controls">
        <div class="section-title">翻译设置</div>
        <div class="lang-selector">
          <select v-model="fromLang" class="lang-select">
            <option value="zh-CHS">中文</option>
            <option value="en">英语</option>
            <option value="ja">日语</option>
            <option value="ko">韩语</option>
          </select>
          <span class="arrow">→</span>
          <select v-model="toLang" class="lang-select">
            <option value="en">英语</option>
            <option value="zh-CHS">中文</option>
            <option value="ja">日语</option>
            <option value="ko">韩语</option>
          </select>
        </div>
      </div>

      <!-- 控制按钮 -->
      <div class="action-buttons">
        <button
          v-if="!isRecording"
          @click="showUserSelector = true"
          class="btn btn-select-user"
        >
          选择用户
        </button>
        <button
          v-if="isRecording"
          @click="stopRecording"
          class="btn btn-stop"
        >
          停止翻译
        </button>
        <button @click="clearResults" :disabled="isRecording" class="btn btn-clear">
          清空结果
        </button>
      </div>

      <!-- 状态指示器 -->
      <div class="status-indicator" :class="{ active: isRecording }">
        <div class="status-text">{{ connectionStatus }}</div>
        <div v-if="currentTargetUser" class="target-user">
          翻译目标: {{ currentTargetUser.name }}
        </div>
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
import { translationWebSocketService, type TranslationUser } from '@/services/translationWebSocket'

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

// 响应式数据
const fromLang = ref('zh-CHS');
const toLang = ref('en');
const isRecording = ref(false);
const connectionStatus = ref('未连接');
const error = ref('');
const showUserSelector = ref(false);
const currentTargetUser = ref<TranslationUser | null>(null);
const isInitiator = ref(false); // 是否是发起翻译的用户
const isWebSocketConnected = ref(false);

const recognitionResults = ref<Array<{ text: string; timestamp: number }>>([]);
const translationResults = ref<Array<{ text: string; timestamp: number }>>([]);

// WebSocket相关
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

// 字幕结果计算属性
const subtitleResults = computed(() => {
  const results: Array<{ original: string; translation: string; id: number; timestamp: number }> = [];
  const maxLength = Math.max(recognitionResults.value.length, translationResults.value.length);
  
  for (let i = 0; i < maxLength; i++) {
    const original = recognitionResults.value[i]?.text || '';
    const translation = translationResults.value[i]?.text || '';
    if (original || translation) {
      results.push({ 
        original, 
        translation, 
        id: i,
        timestamp: recognitionResults.value[i]?.timestamp || translationResults.value[i]?.timestamp || Date.now()
      });
    }
  }
  
  // 只显示最新的3条字幕
  return results.slice(-3);
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
    console.error('无法获取用户信息，WebSocket连接失败');
    error.value = '无法获取用户信息';
    return;
  }

  try {
    await translationWebSocketService.connect(userInfo.userId, userInfo.userName);
    isWebSocketConnected.value = true;
    connectionStatus.value = '已连接';
    console.log('WebSocket连接成功，用户:', userInfo.userName);
  } catch (error) {
    console.error('WebSocket连接失败:', error);
    error.value = 'WebSocket连接失败';
  }
};

// 方法
const toggleTranslator = () => {
  emit('update:showTranslator', !props.showTranslator);
};

// 处理翻译开始（作为发起者）
const handleTranslationStarted = (userId: string, userName: string) => {
  currentTargetUser.value = {
    id: userId,
    name: userName,
    isOnline: true
  };
  showUserSelector.value = false;
  isInitiator.value = true;
  
  // 作为发起者，只发送指令，不录音
  connectionStatus.value = '等待目标用户开始翻译...';
  console.log(`发送翻译指令给用户: ${userName} (${userId})`);
};

// 处理翻译停止
const handleTranslationStopped = (userId: string) => {
  if (currentTargetUser.value?.id === userId) {
    stopRecording();
    currentTargetUser.value = null;
    isInitiator.value = false;
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
    error.value = '请配置有道智云API密钥'
    return
  }
  
  try {
    error.value = ''
    connectionStatus.value = '连接中...'

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
    connectionStatus.value = '翻译中...'
  } catch (err) {
    error.value = `录音失败: ${err instanceof Error ? err.message : String(err)}`
    connectionStatus.value = '连接失败'
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
      from: fromLang.value,
      to: toLang.value,
      format: 'wav',
      channel: '1',
      version: 'v1',
      rate: '16000',
      streamEpType: 'short',
      transPattern: 'sentence',
      noitn: '0',
    })

    const wsUrl = `wss://openapi.youdao.com/stream_speech_trans?${params.toString()}`

    console.log('WebSocket连接URL:', wsUrl);

    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      connectionStatus.value = '已连接'
      console.log('WebSocket连接成功');
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
              if (result.context) {
                recognitionResults.value.push({
                  text: result.context,
                  timestamp: Date.now(),
                })
                console.log('识别结果:', result.context);
              }
              if (result.tranContent) {
                translationResults.value.push({
                  text: result.tranContent,
                  timestamp: Date.now(),
                })
                console.log('翻译结果:', result.tranContent);
                
                // 发送翻译结果给发起翻译的用户
                if (currentTargetUser.value) {
                  translationWebSocketService.sendTranslationResult(currentTargetUser.value.id, {
                    original: result.context || '',
                    translation: result.tranContent,
                    timestamp: Date.now(),
                    fromUserId: translationWebSocketService.getCurrentUserId(),
                    toUserId: currentTargetUser.value.id
                  });
                }
              }
            }
          } else if (data.action === 'error') {
            const errorMsg = getErrorMessage(data.errorCode);
            error.value = `识别错误: ${data.errorCode} - ${errorMsg}`
            connectionStatus.value = '连接错误'
            console.error('识别错误:', data);
          }
        } catch (err) {
          console.error('解析消息失败:', err)
        }
      }
    }

    ws.onerror = (event) => {
      error.value = 'WebSocket连接错误'
      connectionStatus.value = '连接错误'
      console.error('WebSocket错误:', event);
      reject(new Error('WebSocket连接失败'))
    }

    ws.onclose = () => {
      connectionStatus.value = '连接已关闭'
      console.log('WebSocket连接已关闭');
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
  
  return errorMessages[errorCode] || '未知错误';
};

// 停止录音
const stopRecording = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ end: 'true' }))
    ws.close()
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
  connectionStatus.value = '已停止'
  currentTargetUser.value = null;
  isInitiator.value = false;
}

// 清空结果
const clearResults = () => {
  recognitionResults.value = []
  translationResults.value = []
  error.value = ''
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
    recognitionResults.value.push({
      text: data.data.original,
      timestamp: data.data.timestamp,
    });
    translationResults.value.push({
      text: data.data.translation,
      timestamp: data.data.timestamp,
    });
  }
};

// 监听开始翻译指令（作为被翻译的用户）
const handleStartTranslation = (data: any) => {
  if (data.toUserId === translationWebSocketService.getCurrentUserId()) {
    console.log('收到开始翻译指令，开始录音和翻译');
    currentTargetUser.value = {
      id: data.fromUserId,
      name: '发起用户', // 这里可以从用户列表获取名称
      isOnline: true
    };
    startRecording();
  }
};

// 监听停止翻译指令
const handleStopTranslation = (data: any) => {
  if (data.toUserId === translationWebSocketService.getCurrentUserId()) {
    console.log('收到停止翻译指令');
    stopRecording();
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
  stopRecording();
  translationWebSocketService.off('translation_result', handleTranslationResult);
  translationWebSocketService.off('start_translation', handleStartTranslation);
  translationWebSocketService.off('stop_translation', handleStopTranslation);
  
  // 断开WebSocket连接
  translationWebSocketService.disconnect();
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
  [recognitionResults, translationResults],
  ([recog, trans]) => {
    if (recog.length > 0 || trans.length > 0) {
      const lastRecog = recog[recog.length - 1]?.text || '';
      const lastTrans = trans[trans.length - 1]?.text || '';
      if (lastRecog || lastTrans) {
        showSubtitle(lastRecog, lastTrans);
      }
    }
  },
  { deep: true }
);
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

.btn-select-user {
  background: #007bff;
  color: #fff;
}

.btn-select-user:hover {
  background: #0056b3;
}

.btn-stop {
  background: #dc3545;
  color: #fff;
}

.btn-stop:hover {
  background: #c82333;
}

.btn-clear {
  background: #f8f9fa;
  color: #6c757d;
  border: 1px solid #dee2e6;
}

.btn-clear:hover {
  background: #e9ecef;
}

.status-indicator {
  text-align: center;
  padding: 8px;
  margin-bottom: 12px;
  border-radius: 6px;
  background: #f8f9fa;
  color: #6c757d;
  font-size: 13px;
  transition: all 0.2s;
}

.status-indicator.active {
  background: #d4edda;
  color: #155724;
}

.status-text {
  margin-bottom: 4px;
}

.target-user {
  font-size: 12px;
  color: #28a745;
  font-weight: 500;
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
