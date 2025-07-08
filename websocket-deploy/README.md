# WebSocket Translation Server

实时翻译WebSocket服务器

## 功能

- 实时WebSocket连接管理
- 用户在线状态管理
- 翻译指令转发
- 翻译结果转发
- 心跳检测

## 部署

这个目录专门用于部署WebSocket服务器到Railway。

### 部署步骤

1. 在Railway中创建新项目
2. 选择 "Deploy from GitHub repo"
3. 选择这个分支：`websocket-server`
4. 设置根目录为：`websocket-deploy`
5. 部署完成后获取URL

### 环境变量

无需特殊环境变量

### 健康检查

```
GET /health
```

### WebSocket端点

```
WS /translation
```

## 本地测试

```bash
cd websocket-deploy
npm install
npm start
```

## API

### WebSocket消息类型

- `user_online`: 用户上线
- `start_translation`: 开始翻译
- `stop_translation`: 停止翻译
- `translation_result`: 翻译结果
- `user_list`: 用户列表更新 
