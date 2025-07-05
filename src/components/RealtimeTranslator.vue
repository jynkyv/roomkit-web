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
      <!-- 音频源选择 -->
      <div class="audio-source-controls">
        <label class="source-label">音频源:</label>
        <select v-model="selectedAudioSource" :disabled="isRecording" class="source-select">
          <option value="microphone">麦克风</option>
          <option value="page-audio">页面音频</option>
        </select>
      </div>

      <!-- 页面音频选择器 -->
      <div v-if="selectedAudioSource === 'page-audio'" class="page-audio-controls">
        <label class="source-label">选择音频元素:</label>
        <select v-model="selectedAudioElement" :disabled="isRecording" class="source-select">
          <option value="">自动检测所有音频</option>
          <option v-for="element in audioElements" :key="element.id" :value="element.id">
            {{ element.name }}
          </option>
        </select>
        <button @click="refreshAudioElements" :disabled="isRecording" class="btn btn-refresh">
          刷新
        </button>
      </div>

      <div class="language-controls">
        <select v-model="fromLang" :disabled="isRecording" class="lang-select">
          <option value="zh-CHS">中文</option>
          <option value="en">英语</option>
          <option value="ja">日语</option>
          <option value="ko">韩语</option>
        </select>
        <span class="arrow">→</span>
        <select v-model="toLang" :disabled="isRecording" class="lang-select">
          <option value="en">英语</option>
          <option value="zh-CHS">中文</option>
          <option value="ja">日语</option>
          <option value="ko">韩语</option>
        </select>
      </div>

      <div class="action-buttons">
        <button
          @click="startRecording"
          :disabled="isRecording || !canStart"
          class="btn btn-record"
          :class="{ recording: isRecording }"
        >
          {{ isRecording ? '录音中' : '开始翻译' }}
        </button>
        <button @click="stopRecording" :disabled="!isRecording" class="btn btn-stop">
          停止
        </button>
        <button @click="clearResults" :disabled="isRecording" class="btn btn-clear">
          清空
        </button>
      </div>

      <div class="status-indicator" :class="{ active: isRecording }">
        {{ connectionStatus }}
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>

  <!-- 双语字幕显示 -->
  <div class="subtitle-container" v-if="showTranslator && (recognitionResults.length > 0 || translationResults.length > 0)">
    <div class="subtitle-content">
      <transition-group name="subtitle-fade" tag="div">
        <div 
          v-for="(result, index) in subtitleResults" 
          :key="result.id" 
          class="subtitle-item"
          :class="{ 'fade-out': !visibleSubtitles.has(result.id) }"
          v-show="visibleSubtitles.has(result.id)"
        >
          <div class="subtitle-original">{{ result.original }}</div>
          <div class="subtitle-translation">{{ result.translation }}</div>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onUnmounted, watch, onMounted } from 'vue'

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
const selectedAudioSource = ref('microphone'); // 默认选择麦克风
const selectedAudioElement = ref('');
const audioElements = ref<Array<{ id: string; name: string; element: HTMLMediaElement }>>([]);
const isRecording = ref(false);
const connectionStatus = ref('未连接');
const error = ref('');

const recognitionResults = ref<Array<{ text: string; timestamp: number }>>([]);
const translationResults = ref<Array<{ text: string; timestamp: number }>>([]);

// WebSocket相关
let ws: WebSocket | null = null;
let audioContext: any = null;
let processor: any = null;
let stream: any = null;
let audioDestination: any = null;

// 计算属性
const hasValidConfig = computed(() => {
  return !!appKey && !!appSecret;
});

const canStart = computed(() => {
  return hasValidConfig.value;
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

// 方法
const toggleTranslator = () => {
  emit('update:showTranslator', !props.showTranslator);
};

// 查找页面中的音频元素
const findAudioElements = () => {
  const elements: Array<{ id: string; name: string; element: HTMLMediaElement }> = [];
  
  // 查找所有 audio 和 video 元素
  const mediaElements = document.querySelectorAll('audio, video');
  
  mediaElements.forEach((element, index) => {
    const mediaElement = element as HTMLMediaElement;
    const id = element.id || `media-${index}`;
    const name = element.getAttribute('title') || 
                 element.getAttribute('alt') || 
                 element.src || 
                 `音频/视频 ${index + 1}`;
    
    elements.push({
      id,
      name,
      element: mediaElement
    });
  });
  
  return elements;
};

// 刷新音频元素列表
const refreshAudioElements = () => {
  audioElements.value = findAudioElements();
  console.log('找到的音频元素:', audioElements.value);
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

// 获取页面音频流
const getPageAudioStream = async () => {
  try {
    // 创建音频上下文
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
    
    // 创建音频目标节点
    audioDestination = audioContext.createMediaStreamDestination();
    
    if (selectedAudioElement.value) {
      // 如果选择了特定元素
      const selectedElement = audioElements.value.find(el => el.id === selectedAudioElement.value);
      if (selectedElement) {
        const source = audioContext.createMediaElementSource(selectedElement.element);
        source.connect(audioDestination);
        source.connect(audioContext.destination); // 保持原有播放
        console.log('连接到特定音频元素:', selectedElement.name);
      }
    } else {
      // 自动检测所有音频元素
      const mediaElements = document.querySelectorAll('audio, video');
      let connectedCount = 0;
      
      mediaElements.forEach((element) => {
        const mediaElement = element as HTMLMediaElement;
        try {
          const source = audioContext.createMediaElementSource(mediaElement);
          source.connect(audioDestination);
          source.connect(audioContext.destination); // 保持原有播放
          connectedCount++;
          console.log('连接到音频元素:', element.tagName, element.src || element.currentSrc);
        } catch (error) {
          console.warn('无法连接到音频元素:', element, error);
        }
      });
      
      if (connectedCount === 0) {
        throw new Error('未找到可用的音频元素，请确保页面中有正在播放的音频或视频');
      }
      
      console.log(`成功连接到 ${connectedCount} 个音频元素`);
    }
    
    return audioDestination.stream;
  } catch (error) {
    console.error('获取页面音频流失败:', error);
    throw error;
  }
};

// 获取音频流
const getAudioStream = async () => {
  try {
    console.log('尝试获取音频流，音频源:', selectedAudioSource.value);
    
    switch (selectedAudioSource.value) {
      case 'microphone':
        // 麦克风输入
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
      
      case 'page-audio':
        // 页面音频
        console.log('获取页面音频流...');
        const pageStream = await getPageAudioStream();
        console.log('页面音频流获取成功');
        return pageStream;
      
      default:
        throw new Error('不支持的音频源');
    }
  } catch (error) {
    console.error('获取音频流失败:', error);
    
    // 提供更友好的错误信息
    if (error instanceof Error) {
      if (error.name === 'NotSupportedError') {
        throw new Error('浏览器不支持此音频源，请尝试使用麦克风');
      } else if (error.name === 'NotAllowedError') {
        throw new Error('用户拒绝了音频权限，请允许浏览器访问音频设备');
      } else if (error.name === 'NotFoundError') {
        throw new Error('未找到音频设备，请检查设备连接');
      } else {
        throw new Error(`获取音频流失败: ${error.message}`);
      }
    } else {
      throw new Error('获取音频流时发生未知错误');
    }
  }
};

// 开始录音
const startRecording = async () => {
  if (!hasValidConfig.value) {
    error.value = '请配置有道智云API密钥'
    return
  }
  
  try {
    error.value = ''
    connectionStatus.value = '连接中...'

    // 获取音频流
    stream = await getAudioStream();
    console.log('音频源:', selectedAudioSource.value, '音频流:', stream);

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

// 监听音频源变化
watch(selectedAudioSource, (newSource) => {
  if (newSource === 'page-audio') {
    refreshAudioElements();
  }
});

// 组件挂载时初始化
onMounted(() => {
  refreshAudioElements();
});

// 组件卸载时清理资源
onUnmounted(() => {
  stopRecording();
});
</script>

<style scoped>
.translator-widget {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 320px;
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

/* 音频源选择样式 */
.audio-source-controls {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-audio-controls {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-label {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

.source-select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  color: #333;
}

.source-select:disabled {
  background: #f5f5f5;
  color: #999;
}

.btn-refresh {
  padding: 6px 8px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-refresh:hover:not(:disabled) {
  background: #545b62;
}

.language-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
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

.btn-record {
  background: #28a745;
  color: #fff;
}

.btn-record.recording {
  background: #dc3545;
}

.btn-stop {
  background: #6c757d;
  color: #fff;
}

.btn-clear {
  background: #f8f9fa;
  color: #6c757d;
  border: 1px solid #dee2e6;
}

.status-indicator {
  text-align: center;
  padding: 6px;
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
