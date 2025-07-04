import axios from 'axios';

const http = axios.create({
  baseURL: 'http://localhost:3000', // 您的 Node.js 服务地址
  timeout: 10000, // 请求超时时间
});

interface TranscriptionParams {
  SdkAppId: number;
  RoomId: string;
  RoomIdType?: number;
  UserId: string;
  UserSig: string;
}

interface StopParams {
  TaskId: string;
}

// 启动 AI 转写任务
export function startAITranscription(params: TranscriptionParams) {
  return http.post('/start', params);
}

// 停止 AI 转写任务
export function stopAITranscription(params: StopParams) {
  return http.post('/stop', params);
} 
