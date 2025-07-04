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
import { ref, computed, onUnmounted, watch } from 'vue'

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

const recognitionResults = ref<Array<{ text: string; timestamp: number }>>([]);
const translationResults = ref<Array<{ text: string; timestamp: number }>>([]);

// WebSocket相关
let ws: WebSocket | null = null;
let audioContext: any = null;
let processor: any = null;

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

// 开始录音
const startRecording = async () => {
  if (!hasValidConfig.value) {
    error.value = '请配置有道智云API密钥'
    return
  }
  try {
    error.value = ''
    connectionStatus.value = '连接中...'

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    })
    const source = audioContext.createMediaStreamSource(stream)

    processor = audioContext.createScriptProcessor(4096, 1, 1)

    processor.onaudioprocess = (e: any) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0)
        const audioData = new Int16Array(inputData.length)

        for (let i = 0; i < inputData.length; i++) {
          audioData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
        }

        ws.send(audioData.buffer)
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

    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      connectionStatus.value = '已连接'
      resolve()
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data)
          if (data.action === 'started' && data.errorCode === '0') {
            connectionStatus.value = '开始识别...'
          } else if (data.action === 'recognition') {
            if (data.result) {
              const result = data.result
              if (result.context) {
                recognitionResults.value.push({
                  text: result.context,
                  timestamp: Date.now(),
                })
              }
              if (result.tranContent) {
                translationResults.value.push({
                  text: result.tranContent,
                  timestamp: Date.now(),
                })
              }
            }
          } else if (data.action === 'error') {
            error.value = `识别错误: ${data.errorCode}`
            connectionStatus.value = '连接错误'
          }
        } catch (err) {
          console.error('解析消息失败:', err)
        }
      }
    }

    ws.onerror = (event) => {
      error.value = 'WebSocket连接错误'
      connectionStatus.value = '连接错误'
      reject(new Error('WebSocket连接失败'))
    }

    ws.onclose = () => {
      connectionStatus.value = '连接已关闭'
    }
  })
}

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

.results-container {
  display: flex;
  gap: 12px;
}

.result-section {
  flex: 1;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 10px;
}

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px;
}

.result-content {
  min-height: 60px;
  max-height: 120px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  color: #adb5bd;
  font-size: 13px;
  padding: 20px 0;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-item {
  background: #fff;
  border-radius: 6px;
  padding: 8px;
  font-size: 13px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 8px;
}

.result-text {
  flex: 1;
  word-break: break-all;
  line-height: 1.4;
}

.result-time {
  font-size: 11px;
  color: #adb5bd;
  white-space: nowrap;
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
