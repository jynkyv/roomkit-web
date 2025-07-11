# 房间隔离功能说明

## 概述

现在WebSocket服务器支持基于房间的用户隔离，确保不同房间的用户无法相互看到或交互。

## 功能特性

### 1. 房间隔离
- 每个用户连接时必须指定房间ID
- 用户只能看到同房间的其他用户
- 翻译请求只能在同房间内进行
- 用户列表按房间过滤显示

### 2. 安全性
- 服务器端验证用户是否在同一房间
- 拒绝跨房间的翻译请求
- 拒绝跨房间的消息传递

### 3. 自动房间管理
- 房间为空时自动删除
- 用户断开连接时自动从房间移除
- 心跳检测确保连接状态准确

## 技术实现

### 服务器端 (translationServer.js)

```javascript
// 数据结构
const clients = new Map(); // userId -> { ws, roomId, userName }
const rooms = new Map(); // roomId -> Set<userId>
const users = new Map(); // userId -> { id, name, isOnline, roomId }

// 房间内广播
function broadcastUserListToRoom(roomId) {
  const roomUsers = getUsersInRoom(roomId);
  // 只向房间内用户发送消息
}
```

### 客户端 (translationWebSocket.ts)

```typescript
// 连接时传递房间ID
await translationWebSocketService.connect(userId, userName, roomId);

// 获取用户列表时过滤同房间用户
getUsers(): TranslationUser[] {
  return Array.from(this.users.values())
    .filter(user => user.id !== this.currentUserId && user.roomId === this.currentRoomId);
}
```

## 使用场景

### 场景1：多个会议同时进行
- 房间A：用户1、用户2
- 房间B：用户3、用户4
- 用户1只能看到用户2，无法看到用户3、4
- 用户1只能向用户2发起翻译请求

### 场景2：大型会议中的分组
- 主会议室：所有参与者
- 分组房间：特定小组的成员
- 每个分组独立进行翻译

## 测试方法

1. **启动服务器**
   ```bash
   cd packages/websocket-server
   node translationServer.js
   ```

2. **打开多个浏览器窗口**
   - 窗口1：创建房间A，用户1
   - 窗口2：加入房间A，用户2
   - 窗口3：创建房间B，用户3
   - 窗口4：加入房间B，用户4

3. **验证隔离效果**
   - 用户1只能看到用户2
   - 用户3只能看到用户4
   - 跨房间的翻译请求会被拒绝

## 日志示例

```
用户上线: 张三 (user123) 房间: room456
用户上线: 李四 (user456) 房间: room456
用户上线: 王五 (user789) 房间: room789
已发送房间 room456 用户列表给用户 user123，共 2 个用户
用户不在同一房间，翻译请求被拒绝
房间 room456 已清空，删除房间
```

## 配置说明

### 环境变量
- `PORT`: WebSocket服务器端口（默认8080）

### 客户端配置
- 开发环境：`ws://localhost:8080/translation`
- 生产环境：`wss://roomkit-web-production.up.railway.app/translation`

## 注意事项

1. **房间ID获取**：前端从sessionStorage中获取房间信息
2. **重连机制**：断开重连时会保持房间ID
3. **错误处理**：房间信息缺失时会拒绝连接
4. **性能考虑**：房间数量过多时可能需要分片处理

## 未来扩展

1. **房间权限管理**：不同角色的用户权限
2. **房间配置**：每个房间的翻译设置
3. **房间统计**：在线用户数、翻译次数等
4. **房间持久化**：保存房间历史记录 
