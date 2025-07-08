const WebSocket = require('ws');
const http = require('http');

// 创建HTTP服务器
const server = http.createServer();

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 存储连接的客户端
const clients = new Map();
const users = new Map();

// 心跳相关配置
const HEARTBEAT_INTERVAL = 10000; // 10秒
const HEARTBEAT_TIMEOUT = 20000; // 20秒

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  console.log('新的WebSocket连接');
  
  let currentUserId = null;
  let currentUserName = null;
  ws.isAlive = true;

  // 心跳pong响应
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('收到消息:', data);

      switch (data.type) {
        case 'user_online':
          // 用户上线
          currentUserId = data.userId;
          currentUserName = data.userName;
          
          // 存储客户端连接
          clients.set(currentUserId, ws);
          users.set(currentUserId, {
            id: currentUserId,
            name: currentUserName,
            isOnline: true
          });
          
          console.log(`用户上线: ${currentUserName} (${currentUserId})`);
          
          // 广播用户列表更新
          broadcastUserList();
          break;
          
        case 'start_translation':
          // 开始翻译
          console.log(`用户 ${data.fromUserId} 开始翻译用户 ${data.toUserId}`);
          
          // 转发给目标用户
          const targetWs = clients.get(data.toUserId);
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: 'start_translation',
              fromUserId: data.fromUserId,
              toUserId: data.toUserId,
              fromLang: data.fromLang,
              toLang: data.toLang
            }));
          }
          break;
          
        case 'stop_translation':
          // 停止翻译
          console.log(`用户 ${data.fromUserId} 停止翻译用户 ${data.toUserId}`);
          
          // 转发给目标用户
          const targetWs2 = clients.get(data.toUserId);
          if (targetWs2 && targetWs2.readyState === WebSocket.OPEN) {
            targetWs2.send(JSON.stringify({
              type: 'stop_translation',
              fromUserId: data.fromUserId,
              toUserId: data.toUserId
            }));
          }
          break;
          
        case 'translation_result':
          // 翻译结果
          console.log(`用户 ${data.fromUserId} 发送翻译结果给用户 ${data.toUserId}`);
          
          // 转发给目标用户
          const targetWs3 = clients.get(data.toUserId);
          if (targetWs3 && targetWs3.readyState === WebSocket.OPEN) {
            targetWs3.send(JSON.stringify({
              type: 'translation_result',
              fromUserId: data.fromUserId,
              toUserId: data.toUserId,
              data: data.data
            }));
          }
          break;
          
        default:
          console.log('未知消息类型:', data.type);
      }
    } catch (error) {
      console.error('解析消息失败:', error);
    }
  });

  ws.on('close', () => {
    console.log(`用户断开连接: ${currentUserName} (${currentUserId})`);
    
    if (currentUserId) {
      // 移除用户
      clients.delete(currentUserId);
      users.delete(currentUserId);
      
      // 广播用户列表更新
      broadcastUserList();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

// 心跳检测定时器
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      // 找到该 ws 对应的 userId
      let userIdToRemove = null;
      for (const [userId, clientWs] of clients.entries()) {
        if (clientWs === ws) {
          userIdToRemove = userId;
          break;
        }
      }
      if (userIdToRemove) {
        clients.delete(userIdToRemove);
        users.delete(userIdToRemove);
        broadcastUserList();
        console.log(`心跳超时，移除用户: ${userIdToRemove}`);
      }
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// 广播用户列表
function broadcastUserList() {
  const userList = Array.from(users.values());
  const message = JSON.stringify({
    type: 'user_list',
    users: userList
  });
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 启动服务器
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`翻译WebSocket服务器运行在端口 ${PORT}`);
  console.log(`WebSocket地址: ws://localhost:${PORT}/translation`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
}); 
