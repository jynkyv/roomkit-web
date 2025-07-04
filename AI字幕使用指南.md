# AI字幕功能使用指南

## 概述

本项目已集成了腾讯云TRTC的AI字幕功能，可以实时获取会议中的语音转文字数据。AI字幕功能通过以下方式实现：

1. **前端启动**：在会议开始时自动启动AI转写任务
2. **后端服务**：通过Node.js服务器调用腾讯云API
3. **数据获取**：监听TUIRoomKit事件获取字幕数据
4. **界面显示**：通过自定义组件展示字幕内容

## 功能特性

### 1. 自动启动AI字幕
- 进入会议时自动启动AI转写任务
- 支持中英文语音识别
- 实时显示转写状态

### 2. 字幕数据获取
- 实时获取语音转文字数据
- 包含用户ID、置信度、时间戳等信息
- 支持字幕历史记录

### 3. 数据导出功能
- 支持导出JSON格式的字幕数据
- 包含完整的会议记录
- 便于后续分析和处理

## 使用方法

### 1. 启动AI字幕

AI字幕会在进入会议时自动启动，无需手动操作：

```typescript
// 在 room.vue 中自动执行
const handleAITask = (data: { roomId: string }) => {
  const { roomId } = data;
  const botUserInfo = generateBotUserInfo(sdkAppId, secretKey);
  
  startAITranscription({
    RoomId: roomId,
    UserId: botUserInfo.userId,
    UserSig: botUserInfo.userSig,
    SdkAppId: sdkAppId,
    RoomIdType: 1,
  });
};
```

### 2. 获取AI字幕数据

#### 方法一：通过组件引用获取

```vue
<template>
  <div ref="roomRef">
    <conference-main-view display-mode="permanent"></conference-main-view>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const roomRef = ref();

onMounted(() => {
  // 获取AI字幕数据
  const transcriptionData = roomRef.value.getAITranscriptionData();
  console.log('AI字幕数据:', transcriptionData);
  
  // 获取AI字幕状态
  const status = roomRef.value.aiTranscriptionStatus.value;
  console.log('AI字幕状态:', status);
});
</script>
```

#### 方法二：通过事件监听获取

```typescript
// 监听AI字幕数据事件（需要根据实际API调整事件名称）
conference.on('AI_TRANSCRIPTION_DATA', (data) => {
  console.log('收到AI字幕数据:', data);
  // data 包含：
  // - text: 转写的文字内容
  // - userId: 说话用户ID
  // - confidence: 置信度
  // - timestamp: 时间戳
});
```

### 3. 使用AI字幕显示组件

```vue
<template>
  <AITranscriptionDisplay
    :transcription-data="aiTranscriptionData"
    :status="aiTranscriptionStatus"
    @clear-history="clearHistory"
    @export-data="exportData"
  />
</template>

<script setup>
import AITranscriptionDisplay from './components/AITranscriptionDisplay.vue';

const aiTranscriptionData = ref([]);
const aiTranscriptionStatus = ref('idle');

const clearHistory = () => {
  aiTranscriptionData.value = [];
};

const exportData = () => {
  // 导出字幕数据
  const data = {
    timestamp: new Date().toISOString(),
    roomId: roomId,
    transcriptionData: aiTranscriptionData.value,
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { 
    type: 'application/json' 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-transcription-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
</script>
```

## 数据结构

### AI字幕数据格式

```typescript
interface TranscriptionItem {
  id: number;           // 唯一标识
  text: string;         // 转写的文字内容
  timestamp: string;    // 时间戳
  userId: string;       // 说话用户ID
  confidence: number;   // 置信度 (0-1)
}
```

### 状态枚举

```typescript
type TranscriptionStatus = 
  | 'idle'      // 未开始
  | 'starting'  // 启动中
  | 'running'   // 运行中
  | 'stopped'   // 已停止
  | 'error';    // 错误
```

## API接口

### 启动AI转写

```typescript
// POST /start
interface StartParams {
  SdkAppId: number;    // SDK应用ID
  RoomId: string;      // 房间ID
  RoomIdType?: number; // 房间类型
  UserId: string;      // 用户ID
  UserSig: string;     // 用户签名
}
```

### 停止AI转写

```typescript
// POST /stop
interface StopParams {
  TaskId: string;      // 任务ID
}
```

## 配置说明

### 1. 腾讯云配置

在 `src/config/basic-info-config.js` 中配置：

```javascript
export const SDKAPPID = 1600095185;
export const SDKSECRETKEY = 'your-secret-key';
```

### 2. 后端服务配置

在 `server.js` 中配置腾讯云API密钥：

```javascript
const secretId = process.env.TENCENT_SECRET_ID || 'your-secret-id';
const secretKey = process.env.TENCENT_SECRET_KEY || 'your-secret-key';
```

### 3. 环境变量

创建 `.env` 文件：

```env
TENCENT_SECRET_ID=your-secret-id
TENCENT_SECRET_KEY=your-secret-key
TENCENT_REGION=ap-guangzhou
```

## 注意事项

1. **API密钥安全**：生产环境请将密钥配置在后端，避免前端暴露
2. **事件监听**：AI字幕事件名称需要根据实际的TUIRoomKit API进行调整
3. **错误处理**：建议添加完善的错误处理机制
4. **性能优化**：大量字幕数据时注意内存管理
5. **网络要求**：确保网络连接稳定，避免转写中断

## 常见问题

### Q: AI字幕没有启动怎么办？
A: 检查以下几点：
- 确认腾讯云API密钥配置正确
- 检查后端服务是否正常运行
- 查看浏览器控制台是否有错误信息

### Q: 如何获取特定用户的字幕？
A: 可以通过 `userId` 字段过滤：

```typescript
const userTranscriptions = aiTranscriptionData.value.filter(
  item => item.userId === targetUserId
);
```

### Q: 如何提高转写准确率？
A: 建议：
- 确保音频质量良好
- 避免背景噪音
- 使用清晰的语音

### Q: 字幕数据可以保存多久？
A: 字幕数据存储在内存中，页面刷新后会丢失。建议及时导出或保存到本地存储。

## 扩展功能

### 1. 字幕翻译
可以集成翻译API，实现实时字幕翻译：

```typescript
const translateSubtitle = async (text: string, targetLang: string) => {
  // 调用翻译API
  const translated = await translationAPI.translate(text, targetLang);
  return translated;
};
```

### 2. 字幕搜索
实现字幕内容搜索功能：

```typescript
const searchSubtitles = (keyword: string) => {
  return aiTranscriptionData.value.filter(
    item => item.text.toLowerCase().includes(keyword.toLowerCase())
  );
};
```

### 3. 字幕统计
统计会议中的发言情况：

```typescript
const getSpeakingStats = () => {
  const stats = {};
  aiTranscriptionData.value.forEach(item => {
    stats[item.userId] = (stats[item.userId] || 0) + item.text.length;
  });
  return stats;
};
```

## 技术支持

如有问题，请参考：
- [腾讯云TRTC文档](https://cloud.tencent.com/document/product/647)
- [TUIRoomKit API文档](https://cloud.tencent.com/document/product/647/81969)
- [项目GitHub仓库](https://github.com/your-repo) 
