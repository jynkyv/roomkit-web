<!-- eslint-disable -->
<template>
  <div class="realtime-translator">
    <!-- 连接状态 -->
    <div class="connection-status">
      <span :class="['status-indicator', { connected: translationWebSocketService.isWebSocketConnected() }]">
        {{ connectionStatus }}
      </span>
      <div class="streaming-mode-info">
        <span class="mode-badge">流式翻译模式</span>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- 语言配置面板 -->
    <div class="language-config-panel">
      <div class="config-header">
        <h4>{{ t('Translation Settings') }}</h4>
      </div>
      
      <div class="language-selector">
        <div class="language-group">
          <label>{{ t('I speak') }}</label>
          <select v-model="languageConfig.sourceLanguage" @change="updateLanguageConfig">
            <option value="zh-CHS">中文</option>
            <option value="ja">日本語</option>
          </select>
        </div>
        
        <div class="arrow">→</div>
        
        <div class="language-group">
          <label>{{ t('I want to translate to') }}</label>
          <select v-model="languageConfig.targetLanguage" @change="updateLanguageConfig">
            <option value="ja">日本語</option>
            <option value="zh-CHS">中文</option>
          </select>
        </div>
      </div>
      
      <div class="config-actions">
        <button @click="saveLanguageConfig" class="save-btn">
          {{ t('Save') }}
        </button>
        <button @click="resetLanguageConfig" class="reset-btn">
          {{ t('Reset') }}
        </button>
      </div>
    </div>

    <!-- 翻译控制 -->
    <div class="translation-controls">
      <button 
        @click="toggleRecording" 
        :disabled="!canStartReactive"
        :class="['record-btn', { recording: isRecording }]"
      >
        {{ isRecording ? t('Stop') : t('Start') }}
      </button>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from '../locales';
import { translationWebSocketService } from '../services/translationWebSocket';
import { LanguageConfigService, type LanguageConfig } from '../services/languageConfig';
import { useSubtitleStore } from '../stores/subtitle';

// 环境变量
const appKey = import.meta.env.VITE_YOUDAO_APP_KEY;
const appSecret = import.meta.env.VITE_YOUDAO_APP_SECRET;

// Props
interface Props {
  showTranslator: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:showTranslator': [value: boolean];
}>();

// 国际化
const { t } = useI18n();

// 字幕状态管理
const subtitleStore = useSubtitleStore();

// 响应式数据
const isRecording = ref(false);
const connectionStatus = ref(t('Disconnected'));
const error = ref('');

const recognitionResults = ref<Array<{ text: string; timestamp: number }>>([]);

// 语言配置
const languageConfig = ref<LanguageConfig>(LanguageConfigService.getConfig());
const originalConfig = ref<LanguageConfig>({ ...LanguageConfigService.getConfig() });

// WebSocket相关
let ws: WebSocket | null = null;
let audioContext: any = null;
let processor: any = null;
let stream: any = null;

// 计算属性
const hasValidConfig = computed(() => {
  const hasKeys = !!appKey && !!appSecret;
  console.log('API配置检查:', { appKey: !!appKey, appSecret: !!appSecret, hasKeys });
  return hasKeys;
});



// 添加一个响应式的连接状态
const webSocketConnected = ref(false);

// 更新连接状态的函数
const updateConnectionStatus = () => {
  webSocketConnected.value = translationWebSocketService.isWebSocketConnected();
};

// 使用响应式状态的计算属性
const canStartReactive = computed(() => {
  return hasValidConfig.value && webSocketConnected.value;
});



// 方法
const getLanguageName = (code: string): string => {
  return LanguageConfigService.getLanguageName(code);
};

const toggleRecording = async () => {
  if (isRecording.value) {
    stopYoudaoTranslation();
  } else {
    await startYoudaoTranslation();
  }
};



const clearHistory = () => {
  subtitleStore.clearSubtitles();
};



// 语言配置相关方法
const updateLanguageConfig = () => {
  // 确保源语言和目标语言不同
  if (languageConfig.value.sourceLanguage === languageConfig.value.targetLanguage) {
    if (languageConfig.value.sourceLanguage === 'zh-CHS') {
      languageConfig.value.targetLanguage = 'ja';
    } else {
      languageConfig.value.targetLanguage = 'zh-CHS';
    }
  }
};

const saveLanguageConfig = () => {
  // 保存到localStorage
  LanguageConfigService.saveConfig(languageConfig.value);
  
  // 更新原始配置
  originalConfig.value = { ...languageConfig.value };
  
  console.log('语言配置已保存:', languageConfig.value);
  
  // 如果正在录音，重新启动翻译
  if (isRecording.value) {
    stopYoudaoTranslation();
    setTimeout(() => {
      startYoudaoTranslation();
    }, 1000);
  }
};

const resetLanguageConfig = () => {
  languageConfig.value = { ...originalConfig.value };
};

// 有道翻译相关方法
const startYoudaoTranslation = async () => {
  if (!hasValidConfig.value) {
    error.value = t('Please configure Youdao API key');
    return;
  }
  
  try {
    error.value = '';
    connectionStatus.value = t('Recording...');

    // 获取麦克风音频流
    stream = await getMicrophoneStream();
    console.log('音频流:', stream);

    // 创建音频上下文
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
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);

        // 转换音频数据为16位PCM格式
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          audioData[i] = Math.round(sample * 32767);
        }

        // 检查音频数据是否有效（有声音）
        const hasAudio = audioData.some(sample => Math.abs(sample) > 100);
        if (hasAudio) {
          console.log('发送音频数据，长度:', audioData.length);
          ws.send(audioData.buffer);
        }
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    await connectWebSocket();

    isRecording.value = true;
    connectionStatus.value = t('Streaming translation...');
  } catch (err) {
    error.value = `${t('Recording failed')}: ${err instanceof Error ? err.message : String(err)}`;
    connectionStatus.value = t('Connection failed');
    console.error('录音失败:', err);
  }
};

// 连接有道WebSocket
const connectWebSocket = async (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    const salt = generateUUID();
    const curtime = Math.floor(Date.now() / 1000).toString();
    const sign = await generateSign(appKey, salt, curtime, appSecret);

    const params = new URLSearchParams({
      appKey: appKey,
      salt,
      curtime,
      sign,
      signType: 'v4',
      from: languageConfig.value.sourceLanguage,
      to: languageConfig.value.targetLanguage,
      format: 'wav',
      channel: '1',
      version: 'v1',
      rate: '16000',
      streamEpType: 'short',
      transPattern: 'stream',
      noitn: '0',
    });

    const wsUrl = `wss://openapi.youdao.com/stream_speech_trans?${params.toString()}`;

    console.log('有道翻译WebSocket连接URL:', wsUrl);
    console.log('使用的语言设置:', { 
      from: languageConfig.value.sourceLanguage, 
      to: languageConfig.value.targetLanguage 
    });
    console.log('翻译模式: 流式翻译 (stream) - 支持实时语音识别和翻译');

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connectionStatus.value = t('Connected') + ' (流式模式)';
      console.log('有道翻译WebSocket连接成功 - 流式模式');
      resolve();
    };

    ws.onmessage = (event) => {
      console.log('WebSocket onmessage触发，数据类型:', typeof event.data);
      if (typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data);
          console.log('收到WebSocket消息:', data);
          console.log('🚨 测试消息 - 如果看到这个，说明代码已更新 🚨');
          console.log('data.action:', data.action, '类型:', typeof data.action);
          console.log('data.action === "recognition":', data.action === 'recognition');
          
          if (data.action === 'started' && data.errorCode === '0') {
            connectionStatus.value = '开始流式识别...';
            console.log('开始流式识别成功');
          } else if (data.action === 'recognition') {
            console.log('=== 收到recognition消息 ===');
            console.log('完整数据:', data);
            if (data.result) {
              const result = data.result;
              console.log('result对象:', result);
              console.log('result.context:', result.context);
              console.log('result.tranContent:', result.tranContent);
              console.log('result.partial:', result.partial);
              
              // 处理流式识别结果
              if (result.context) {
                console.log('流式识别结果:', result.context, 'partial:', result.partial);
              }
              
              // 处理流式翻译结果
              console.log('检查tranContent:', result.tranContent, '类型:', typeof result.tranContent);
              console.log('result的所有字段:', Object.keys(result));
              console.log('result的完整内容:', JSON.stringify(result, null, 2));
              
              if (result.tranContent) {
                console.log('流式翻译结果:', result.tranContent, 'partial:', result.partial);
                
                // 处理流式字幕显示
                if (result.partial) {
                  console.log('处理部分字幕结果:', result.context, result.tranContent);
                  // 部分结果：更新当前正在识别的字幕
                  if (subtitleStore.subtitleResults.length === 0) {
                    // 如果是第一个部分结果，创建新的字幕条目
                    subtitleStore.addSubtitle(
                      result.context || '',
                      result.tranContent,
                      '我',
                      true // 标记为部分结果
                    );
                    console.log('创建新的部分字幕，当前字幕数量:', subtitleStore.subtitleResults.length);
                  } else {
                    // 更新最后一个字幕条目
                    subtitleStore.updateLastSubtitle(
                      result.context || '',
                      result.tranContent
                    );
                    console.log('更新部分字幕，当前字幕数量:', subtitleStore.subtitleResults.length);
                  }
                } else {
                  console.log('处理完整字幕结果:', result.context, result.tranContent);
                  // 完整结果：完成当前字幕并发送广播
                  if (subtitleStore.subtitleResults.length > 0) {
                    // 完成最后一个部分字幕
                    subtitleStore.completeLastSubtitle();
                  }
                  
                  // 发送到WebSocket广播给其他用户
                  translationWebSocketService.sendTranslationMessage(
                    result.context || '',
                    result.tranContent
                  );
                  
                  // 如果还没有字幕条目，创建一个完整的字幕
                  if (subtitleStore.subtitleResults.length === 0) {
                    subtitleStore.addSubtitle(
                      result.context || '',
                      result.tranContent,
                      '我',
                      false // 标记为完整结果
                    );
                  }
                  console.log('完成字幕处理，当前字幕数量:', subtitleStore.subtitleResults.length);
                }
              }
              
              // 处理流式模式特有的字段
              if (result.segId) {
                console.log('分段ID:', result.segId, '时间范围:', result.bg, '-', result.ed);
              }
            }
          } else if (data.action === 'error') {
            const errorMsg = getErrorMessage(data.errorCode);
            error.value = `流式识别错误: ${data.errorCode} - ${errorMsg}`;
            connectionStatus.value = '连接错误';
            console.error('流式识别错误:', data);
          }
        } catch (err) {
          console.error('解析消息失败:', err);
        }
      }
    };

    ws.onerror = (event) => {
      error.value = t('Connection error');
      connectionStatus.value = t('Connection error');
      console.error('有道翻译WebSocket错误:', event);
      reject(new Error('有道翻译WebSocket连接失败'));
    };

    ws.onclose = () => {
      connectionStatus.value = t('Connection closed');
      console.log('有道翻译WebSocket连接已关闭');
      ws = null;
    };
  });
};

const stopYoudaoTranslation = () => {
  // 关闭有道翻译的WebSocket连接
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ end: 'true' }));
    ws.close();
    ws = null;
  }

  if (processor) {
    processor.disconnect();
    processor = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  // 停止音频流
  if (stream) {
    stream.getTracks().forEach((track: any) => {
      track.stop();
    });
    stream = null;
  }

  isRecording.value = false;
  connectionStatus.value = t('Connection closed');
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

// SHA256
const sha256 = async (str: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

// 生成签名
const generateSign = async (
  appKey: string,
  salt: string,
  curtime: string,
  appSecret: string,
): Promise<string> => {
  const signStr = appKey + salt + curtime + appSecret;
  return await sha256(signStr);
};

// 生成UUID
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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

// WebSocket事件处理
const handleConnected = () => {
  console.log('WebSocket连接成功');
  connectionStatus.value = t('Connected');
  // 更新响应式连接状态
  updateConnectionStatus();
};

const handleDisconnected = () => {
  console.log('WebSocket连接断开');
  connectionStatus.value = t('Disconnected');
  updateConnectionStatus();
};

const handleReconnecting = () => {
  console.log('WebSocket重新连接中...');
  connectionStatus.value = t('Reconnecting...');
};

const handleReconnected = () => {
  console.log('WebSocket重新连接成功');
  connectionStatus.value = t('Connected');
  updateConnectionStatus();
};

const handleWebSocketError = (data: any) => {
  console.error('WebSocket错误:', data);
  error.value = data.message || t('WebSocket error');
  connectionStatus.value = t('Connection error');
};

const handleTranslationBroadcast = (data: any) => {
  console.log('收到翻译广播:', data);
  
  // 添加到全局字幕状态 - 传递双语数据
  subtitleStore.addSubtitle(
    data.zhText,        // 原文（中文）
    data.jaText,        // 翻译（日文）
    `用户${data.userId}` // 用户名
  );
};

const handleUserJoin = (data: any) => {
  console.log('用户加入:', data);
};

const handleUserLeave = (data: any) => {
  console.log('用户离开:', data);
};

// 获取用户信息
const getUserInfo = () => {
  try {
    const userInfoStr = sessionStorage.getItem('tuiRoom-userInfo');
    console.log('sessionStorage中的用户信息:', userInfoStr);
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      console.log('解析后的用户信息:', userInfo);
      return userInfo;
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
  console.warn('未找到用户信息');
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

// 初始化WebSocket连接
const initWebSocket = async () => {
  try {
    // 获取用户和房间信息
    const userInfo = getUserInfo();
    const roomInfo = getRoomInfo();
    
    // 如果没有用户信息，使用默认值
    const userId = userInfo?.userId || 'default-user-' + Date.now();
    const userName = userInfo?.userName || '默认用户';
    const roomId = roomInfo?.roomId || '000000'; // 默认房间ID
    
    console.log('使用连接信息:', { userId, userName, roomId });
    
    // 注册事件监听器
    translationWebSocketService.on('connected', handleConnected);
    translationWebSocketService.on('disconnected', handleDisconnected);
    translationWebSocketService.on('reconnecting', handleReconnecting);
    translationWebSocketService.on('reconnected', handleReconnected);
    translationWebSocketService.on('error', handleWebSocketError);
    translationWebSocketService.on('translation_broadcast', handleTranslationBroadcast);
    translationWebSocketService.on('user_join', handleUserJoin);
    translationWebSocketService.on('user_leave', handleUserLeave);
    
    await translationWebSocketService.connect(userId, userName, roomId);
    
  } catch (error) {
    console.error('WebSocket连接失败:', error);
    connectionStatus.value = t('Connection Failed');
    error.value = t('Failed to connect to translation service');
  }
};

// 组件挂载时初始化
onMounted(async () => {
  await initWebSocket();
  // 初始化连接状态
  updateConnectionStatus();
});

// 组件卸载时清理
onUnmounted(() => {
  if (isRecording.value) {
    stopYoudaoTranslation();
  }
  
  // 移除事件监听器
  translationWebSocketService.off('connected', handleConnected);
  translationWebSocketService.off('disconnected', handleDisconnected);
  translationWebSocketService.off('reconnecting', handleReconnecting);
  translationWebSocketService.off('reconnected', handleReconnected);
  translationWebSocketService.off('error', handleWebSocketError);
  translationWebSocketService.off('translation_broadcast', handleTranslationBroadcast);
  translationWebSocketService.off('user_join', handleUserJoin);
  translationWebSocketService.off('user_leave', handleUserLeave);
  
  // 断开WebSocket连接
  translationWebSocketService.disconnect();
});
</script>

<style scoped>
.realtime-translator {
  padding: 24px;
  background: white;
  border-radius: 0;
  width: 100%;
  height: 100%;
}

.connection-status {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.streaming-mode-info {
  display: flex;
  align-items: center;
}

.mode-badge {
  background: #007acc;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.status-indicator {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: #ff4444;
  color: white;
}

.status-indicator.connected {
  background: #44ff44;
  color: black;
}

.error-message {
  color: #ff4444;
  margin-bottom: 15px;
  padding: 10px;
  background: #ffe6e6;
  border-radius: 4px;
}

.language-config-panel {
  margin-bottom: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.config-header h4 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 18px;
  color: #343a40;
}

.language-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.language-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}

.language-group label {
  font-size: 14px;
  color: #495057;
}

.language-group select {
  padding: 10px 12px;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  font-size: 14px;
  color: #333;
  background-color: #fff;
  cursor: pointer;
  transition: border-color 0.3s;
  min-width: 100px;
}

.language-group select:focus {
  outline: none;
  border-color: #007bff;
}

.arrow {
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
  margin: 0 10px;
}

.config-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.save-btn, .reset-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.save-btn {
  background: #28a745;
  color: white;
}

.save-btn:hover {
  background: #218838;
}

.reset-btn {
  background: #6c757d;
  color: white;
}

.reset-btn:hover {
  background: #5a6268;
}

@media (max-width: 480px) {
  .language-selector {
    flex-direction: column;
    gap: 15px;
  }
  
  .arrow {
    transform: rotate(90deg);
    margin: 5px 0;
  }
  
  .config-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .language-group {
    min-width: auto;
    width: 100%;
  }
  
  .language-group select {
    width: 100%;
    min-width: auto;
  }
}

.translation-controls {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.record-btn {
  padding: 12px 30px;
  border: none;
  border-radius: 8px;
  background: #007bff;
  color: white;
  cursor: pointer;
  transition: background 0.3s;
  font-size: 16px;
  font-weight: 500;
}

.record-btn:hover:not(:disabled) {
  background: #0056b3;
}

.record-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.record-btn.recording {
  background: #dc3545;
}

.record-btn.recording:hover {
  background: #c82333;
}


</style> 
