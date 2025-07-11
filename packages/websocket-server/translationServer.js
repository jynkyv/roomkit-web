const WebSocket = require('ws');
const http = require('http');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 添加CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 健康检查端点
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ 
  server,
  path: '/translation'
});

// 存储连接的客户端和房间信息
const clients = new Map(); // userId -> { ws, roomId, userName }
const rooms = new Map(); // roomId -> Set<userId>
const users = new Map(); // userId -> { id, name, isOnline, roomId }

// 心跳相关配置
const HEARTBEAT_INTERVAL = 10000; // 10秒
const HEARTBEAT_TIMEOUT = 20000; // 20秒

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  console.log('新的WebSocket连接');
  
  let currentUserId = null;
  let currentUserName = null;
  let currentRoomId = null;
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
          currentRoomId = data.roomId; // 新增房间ID
          
          // 存储客户端连接
          clients.set(currentUserId, {
            ws: ws,
            roomId: currentRoomId,
            userName: currentUserName
          });
          
          // 添加到房间
          if (!rooms.has(currentRoomId)) {
            rooms.set(currentRoomId, new Set());
          }
          rooms.get(currentRoomId).add(currentUserId);
          
          // 存储用户信息
          users.set(currentUserId, {
            id: currentUserId,
            name: currentUserName,
            isOnline: true,
            roomId: currentRoomId
          });
          
          console.log(`用户上线: ${currentUserName} (${currentUserId}) 房间: ${currentRoomId}`);
          
          // 广播房间内用户列表更新
          broadcastUserListToRoom(currentRoomId);
          break;
          
        case 'start_translation':
          // 开始翻译
          console.log(`用户 ${data.fromUserId} 开始翻译用户 ${data.toUserId}`);
          
          // 验证两个用户是否在同一房间
          const fromUser = users.get(data.fromUserId);
          const toUser = users.get(data.toUserId);
          
          if (!fromUser || !toUser) {
            console.log('用户不存在，翻译请求被拒绝');
            return;
          }
          
          if (fromUser.roomId !== toUser.roomId) {
            console.log('用户不在同一房间，翻译请求被拒绝');
            return;
          }
          
          // 转发给目标用户
          const targetClient = clients.get(data.toUserId);
          if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
            targetClient.ws.send(JSON.stringify({
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
          
          // 验证两个用户是否在同一房间
          const fromUser2 = users.get(data.fromUserId);
          const toUser2 = users.get(data.toUserId);
          
          if (!fromUser2 || !toUser2) {
            console.log('用户不存在，停止翻译请求被拒绝');
            return;
          }
          
          if (fromUser2.roomId !== toUser2.roomId) {
            console.log('用户不在同一房间，停止翻译请求被拒绝');
            return;
          }
          
          // 转发给目标用户
          const targetClient2 = clients.get(data.toUserId);
          if (targetClient2 && targetClient2.ws.readyState === WebSocket.OPEN) {
            targetClient2.ws.send(JSON.stringify({
              type: 'stop_translation',
              fromUserId: data.fromUserId,
              toUserId: data.toUserId
            }));
          }
          break;
          
        case 'translation_result':
          // 翻译结果
          console.log(`用户 ${data.fromUserId} 发送翻译结果给用户 ${data.toUserId}`);
          
          // 验证两个用户是否在同一房间
          const fromUser3 = users.get(data.fromUserId);
          const toUser3 = users.get(data.toUserId);
          
          if (!fromUser3 || !toUser3) {
            console.log('用户不存在，翻译结果被拒绝');
            return;
          }
          
          if (fromUser3.roomId !== toUser3.roomId) {
            console.log('用户不在同一房间，翻译结果被拒绝');
            return;
          }
          
          // 转发给目标用户
          const targetClient3 = clients.get(data.toUserId);
          if (targetClient3 && targetClient3.ws.readyState === WebSocket.OPEN) {
            targetClient3.ws.send(JSON.stringify({
              type: 'translation_result',
              fromUserId: data.fromUserId,
              toUserId: data.toUserId,
              data: data.data
            }));
          }
          break;
          
        case 'request_user_list':
          // 请求用户列表
          console.log(`用户 ${currentUserId} 请求用户列表`);
          
          // 只返回同房间的用户列表
          const roomUsers = getUsersInRoom(currentRoomId);
          const responseMessage = JSON.stringify({
            type: 'user_list',
            users: roomUsers
          });
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(responseMessage);
            console.log(`已发送房间 ${currentRoomId} 用户列表给用户 ${currentUserId}，共 ${roomUsers.length} 个用户`);
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
    console.log(`用户断开连接: ${currentUserName} (${currentUserId}) 房间: ${currentRoomId}`);
    
    if (currentUserId) {
      // 从房间中移除用户
      if (currentRoomId && rooms.has(currentRoomId)) {
        rooms.get(currentRoomId).delete(currentUserId);
        
        // 如果房间为空，删除房间
        if (rooms.get(currentRoomId).size === 0) {
          rooms.delete(currentRoomId);
          console.log(`房间 ${currentRoomId} 已清空，删除房间`);
        }
      }
      
      // 移除用户
      clients.delete(currentUserId);
      users.delete(currentUserId);
      
      // 广播房间内用户列表更新
      if (currentRoomId) {
        broadcastUserListToRoom(currentRoomId);
      }
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
      let roomIdToUpdate = null;
      for (const [userId, clientInfo] of clients.entries()) {
        if (clientInfo.ws === ws) {
          userIdToRemove = userId;
          roomIdToUpdate = clientInfo.roomId;
          break;
        }
      }
      if (userIdToRemove) {
        // 从房间中移除用户
        if (roomIdToUpdate && rooms.has(roomIdToUpdate)) {
          rooms.get(roomIdToUpdate).delete(userIdToRemove);
          
          // 如果房间为空，删除房间
          if (rooms.get(roomIdToUpdate).size === 0) {
            rooms.delete(roomIdToUpdate);
            console.log(`房间 ${roomIdToUpdate} 已清空，删除房间`);
          }
        }
        
        clients.delete(userIdToRemove);
        users.delete(userIdToRemove);
        
        // 广播房间内用户列表更新
        if (roomIdToUpdate) {
          broadcastUserListToRoom(roomIdToUpdate);
        }
        
        console.log(`心跳超时，移除用户: ${userIdToRemove}`);
      }
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// 获取房间内的用户列表
function getUsersInRoom(roomId) {
  if (!rooms.has(roomId)) {
    return [];
  }
  
  const roomUserIds = rooms.get(roomId);
  const roomUsers = [];
  
  for (const userId of roomUserIds) {
    const user = users.get(userId);
    if (user) {
      roomUsers.push(user);
    }
  }
  
  return roomUsers;
}

// 广播房间内用户列表
function broadcastUserListToRoom(roomId) {
  const roomUsers = getUsersInRoom(roomId);
  const message = JSON.stringify({
    type: 'user_list',
    users: roomUsers
  });
  
  if (rooms.has(roomId)) {
    const roomUserIds = rooms.get(roomId);
    roomUserIds.forEach(userId => {
      const clientInfo = clients.get(userId);
      if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
        clientInfo.ws.send(message);
      }
    });
  }
}

// 启动服务器
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`翻译WebSocket服务器运行在端口 ${PORT}`);
  console.log(`WebSocket地址: ws://localhost:${PORT}/translation`);
  console.log('支持基于房间的用户隔离');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
}); 
