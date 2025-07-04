# AI转录字幕功能接入指南

本文档介绍如何在腾讯云TRTC会议系统中接入AI转录字幕功能，实现实时语音转文字。

## 功能概述

AI转录功能可以将会议中的语音实时转换为文字，支持：
- 实时字幕显示
- 字幕历史记录
- 多语言识别
- 说话人识别

## 前提条件

### 1. 开通服务
1. 登录 [腾讯云TRTC控制台](https://console.cloud.tencent.com/trtc)
2. 开通TRTC服务并创建应用
3. 在控制台 > 功能配置 > 增值功能 开启AI智能识别功能
4. 购买AI智能识别套餐包或订阅TRTC包月套餐

### 2. 获取API密钥
1. 登录 [腾讯云API密钥管理](https://console.cloud.tencent.com/cam/capi)
2. 创建或获取SecretId和SecretKey
3. 确保密钥有TRTC相关API的调用权限

## 配置步骤

### 1. 修改配置文件

编辑 `src/config/basic-info-config.js`：

```javascript
export const AI_TRANSCRIPTION_CONFIG = {
  // 替换为你的腾讯云API密钥ID
  SECRET_ID: 'your_secret_id_here',
  // 替换为你的腾讯云API密钥Key
  SECRET_KEY: 'your_secret_key_here',
  // 地域，默认为广州
  REGION: 'ap-guangzhou',
  // 是否启用AI转录功能
  ENABLED: true,
  // 转录模式：0-全房间，1-指定用户
  TRANSCRIPTION_MODE: 0,
  // 最大空闲时间（秒）
  MAX_IDLE_TIME: 60,
};
```

### 2. 启动后端代理服务器

```bash
# 安装依赖
npm install express axios crypto

# 启动代理服务器
node server/trtc-proxy.js
```

代理服务器将在端口3001运行，用于安全地调用腾讯云API。

### 3. 配置前端代理

在 `vite.config.ts` 中添加代理配置：

```typescript
export default defineConfig({
  // ... 其他配置
  server: {
    proxy: {
      '/api/trtc': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

## 使用方法

### 1. 启动转录

在会议中，房主可以点击右上角的"开始转录"按钮启动AI转录功能。

### 2. 查看字幕

- 实时字幕会显示在屏幕底部
- 字幕历史记录会显示在字幕下方
- 支持显示说话人和时间信息

### 3. 停止转录

点击"停止转录"按钮可以停止AI转录功能。

### 4. 清空字幕

点击"清空字幕"按钮可以清除所有字幕记录。

## API接口说明

### 启动转录任务

```javascript
// 启动全房间转录
await transcriptionManager.startTranscription(
  roomId,
  userId,
  userSig,
  0 // 转录模式：0-全房间
);

// 启动指定用户转录
await transcriptionManager.startTranscription(
  roomId,
  userId,
  userSig,
  1, // 转录模式：1-指定用户
  targetUserId // 目标用户ID
);
```

### 查询转录任务

```javascript
const taskInfo = await transcriptionManager.queryTranscription(taskId);
```

### 停止转录任务

```javascript
await transcriptionManager.stopTranscription(taskId);
```

## 消息格式

### 实时字幕消息

```json
{
  "type": 10000,
  "sender": "user_a",
  "payload": {
    "text": "今天天气怎么样？",
    "start_time": "00:00:02",
    "end_time": "00:00:05",
    "end": true
  }
}
```

### 字幕分段示例

- "今天"
- "今天天气"
- "今天天气怎么样？" (end: true)

## 注意事项

### 1. 安全考虑
- 不要在前端直接存储API密钥
- 使用后端代理服务器进行API调用
- 定期轮换API密钥

### 2. 费用说明
- AI转录功能按调用量计费
- 建议在测试环境充分验证后再上线
- 注意控制并发任务数量（单个SDKAppId限制100路）

### 3. 性能优化
- 合理设置最大空闲时间
- 及时停止不需要的转录任务
- 监控API调用频率

### 4. 错误处理
- 处理网络异常
- 处理API调用失败
- 提供用户友好的错误提示

## 故障排除

### 1. 转录任务启动失败
- 检查API密钥是否正确
- 确认已开通AI智能识别功能
- 检查账户余额和套餐包状态

### 2. 字幕不显示
- 检查网络连接
- 确认会议中有音频输入
- 查看浏览器控制台错误信息

### 3. 字幕延迟
- 检查网络延迟
- 调整转录参数
- 考虑使用更近的地域节点

## 相关文档

- [腾讯云TRTC AI转录文档](https://cloud.tencent.com/document/product/647/108902)
- [开始AI转录任务API](https://cloud.tencent.com/document/product/647/106492)
- [腾讯云API签名算法](https://cloud.tencent.com/document/api/213/30654)

## 技术支持

如遇到问题，请：
1. 查看浏览器控制台错误信息
2. 检查后端代理服务器日志
3. 参考腾讯云官方文档
4. 联系技术支持团队 
