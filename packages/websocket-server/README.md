# RoomKit WebSocket 翻译服务器

基于NestJS的实时翻译WebSocket服务器，支持多房间翻译消息广播。

## 功能特性

- 🚀 基于NestJS框架，类型安全
- 🌐 支持多房间并发翻译
- 📝 实时翻译消息广播
- ❤️ 心跳机制保持连接
- 🔄 自动房间清理
- 📊 健康检查接口
- 🛠️ 错误处理和日志记录

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发环境

```bash
pnpm run start:dev
```

### 生产环境

```bash
pnpm run build
pnpm run start:prod
```

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 8080 | 服务器端口 |
| NODE_ENV | development | 环境模式 |
| CORS_ORIGIN | * | CORS来源 |
| HEARTBEAT_INTERVAL | 30000 | 心跳间隔(ms) |
| HEARTBEAT_TIMEOUT | 60000 | 心跳超时(ms) |
| ROOM_TIMEOUT | 1800000 | 房间超时(ms) |

## WebSocket消息格式

### 客户端发送

#### 用户上线
```json
{
  "type": "user_online",
  "userId": "user123",
  "userName": "张三",
  "roomId": "123456"
}
```

#### 翻译消息
```json
{
  "type": "translation_message",
  "zhText": "你好",
  "jaText": "こんにちは",
  "userId": "user123",
  "timestamp": 1640995200000
}
```

#### 心跳
```json
{
  "type": "heartbeat"
}
```

### 服务器广播

#### 用户加入
```json
{
  "type": "user_join",
  "userId": "user123",
  "userName": "张三",
  "roomId": "123456",
  "timestamp": 1640995200000
}
```

#### 翻译广播
```json
{
  "type": "translation_broadcast",
  "zhText": "你好",
  "jaText": "こんにちは",
  "userId": "user123",
  "timestamp": 1640995200000
}
```

## 部署

### Railway部署

1. 连接Railway项目
2. 设置环境变量
3. 部署自动完成

### Docker部署

```bash
docker build -t websocket-server .
docker run -p 8080:8080 websocket-server
```

## API接口

### 健康检查

```
GET /health
```

响应:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 123456,
    "heapTotal": 98765,
    "heapUsed": 54321
  },
  "stats": {
    "activeRooms": 5,
    "activeUsers": 10,
    "totalConnections": 20
  }
}
```
