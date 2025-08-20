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

// 翻译会话管理
const translationSessions = new Map(); // sessionId -> {
//   targetUserId: string,      // 被翻译用户
//   initiatorUserId: string,   // 发起者
//   viewers: Set<string>,      // 查看者集合
//   fromLang: string,
//   toLang: string,
//   isActive: boolean
// }

// 房间翻译状态
const roomTranslationStatus = new Map(); // roomId -> Map<userId, status>

// 心跳相关配置
const HEARTBEAT_INTERVAL = 10000; // 10秒
const HEARTBEAT_TIMEOUT = 20000; // 20秒

// 生成会话ID
function generateSessionId(roomId, initiatorUserId, targetUserId) {
  return `${roomId}_${initiatorUserId}_${targetUserId}`;
}

// 获取用户翻译状态
function getUserTranslationStatus(roomId, userId) {
  if (!roomTranslationStatus.has(roomId)) {
    return null;
  }
  return roomTranslationStatus.get(roomId).get(userId) || null;
}

// 设置用户翻译状态
function setUserTranslationStatus(roomId, userId, status) {
  if (!roomTranslationStatus.has(roomId)) {
    roomTranslationStatus.set(roomId, new Map());
  }
  roomTranslationStatus.get(roomId).set(userId, status);
}

// 清除用户翻译状态
function clearUserTranslationStatus(roomId, userId) {
  if (roomTranslationStatus.has(roomId)) {
    roomTranslationStatus.get(roomId).delete(userId);
  }
}

// 广播房间翻译状态更新
function broadcastTranslationStatusToRoom(roomId) {
  if (!rooms.has(roomId)) return;
  
  const statusMap = roomTranslationStatus.get(roomId) || new Map();
  
  // 为每个翻译状态添加查看者信息
  const statusWithViewers = {};
  for (const [userId, status] of statusMap.entries()) {
    const session = translationSessions.get(status.sessionId);
    if (session) {
      statusWithViewers[userId] = {
        ...status,
        viewers: Array.from(session.viewers)
      };
    } else {
      statusWithViewers[userId] = status;
    }
  }
  
  const message = JSON.stringify({
    type: 'translation_status_update',
    roomId: roomId,
    statusMap: statusWithViewers
  });
  
  const roomUserIds = rooms.get(roomId);
  roomUserIds.forEach(userId => {
    const clientInfo = clients.get(userId);
    if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
      clientInfo.ws.send(message);
    }
  });
}

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
          currentRoomId = data.roomId;
          
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
          
          // 发送房间翻译状态给新用户
          const roomStatus = roomTranslationStatus.get(currentRoomId);
          if (roomStatus) {
            ws.send(JSON.stringify({
              type: 'room_translation_status',
              roomId: currentRoomId,
              statusMap: Object.fromEntries(roomStatus)
            }));
          }
          break;
          
        case 'start_translation_session':
          // 开始翻译会话
          const { targetUserId, fromLang, toLang } = data;
          const sessionId = generateSessionId(currentRoomId, currentUserId, targetUserId);
          
          // 检查目标用户是否在同一房间
          const targetUser = users.get(targetUserId);
          if (!targetUser || targetUser.roomId !== currentRoomId) {
            console.log('目标用户不存在或不在同一房间');
            return;
          }
          
          // 创建翻译会话
          translationSessions.set(sessionId, {
            targetUserId,
            initiatorUserId: currentUserId,
            viewers: new Set([currentUserId]), // 发起者默认是查看者
            fromLang,
            toLang,
            isActive: true
          });
          
          // 设置用户翻译状态
          setUserTranslationStatus(currentRoomId, targetUserId, {
            sessionId,
            initiatorUserId: currentUserId,
            fromLang,
            toLang,
            isActive: true
          });
          
          // 通知目标用户开始翻译
          const targetClient = clients.get(targetUserId);
          if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
            targetClient.ws.send(JSON.stringify({
              type: 'start_translation',
              fromUserId: currentUserId,
              toUserId: targetUserId,
              fromLang,
              toLang
            }));
          }
          
          // 广播翻译状态更新
          broadcastTranslationStatusToRoom(currentRoomId);
          
          console.log(`开始翻译会话: ${sessionId}, 目标用户: ${targetUserId}`);
          break;
          
        case 'join_translation_view':
          // 加入翻译查看
          const { sessionId: viewSessionId } = data;
          const session = translationSessions.get(viewSessionId);
          
          if (session && session.isActive) {
            // 检查用户是否已经在查看者列表中
            if (session.viewers.has(currentUserId)) {
              console.log(`用户 ${currentUserId} 已经在查看者列表中`);
              return;
            }
            
            session.viewers.add(currentUserId);
            console.log(`用户 ${currentUserId} 加入翻译查看会话: ${viewSessionId}`);
            
            // 延迟广播翻译状态更新，给前端一些时间完成本地更新
            setTimeout(() => {
              broadcastTranslationStatusToRoom(currentRoomId);
            }, 200);
          }
          break;
          
        case 'leave_translation_view':
          // 离开翻译查看
          const { sessionId: leaveSessionId } = data;
          const leaveSession = translationSessions.get(leaveSessionId);
          
          if (leaveSession) {
            // 检查用户是否不在查看者列表中
            if (!leaveSession.viewers.has(currentUserId)) {
              console.log(`用户 ${currentUserId} 不在查看者列表中`);
              return;
            }
            
            leaveSession.viewers.delete(currentUserId);
            console.log(`用户 ${currentUserId} 离开翻译查看会话: ${leaveSessionId}`);
            
            // 延迟广播翻译状态更新，给前端一些时间完成本地更新
            setTimeout(() => {
              broadcastTranslationStatusToRoom(currentRoomId);
            }, 200);
          }
          break;
          
        case 'stop_translation_session':
          // 停止翻译会话
          const { sessionId: stopSessionId } = data;
          const stopSession = translationSessions.get(stopSessionId);
          
          if (stopSession && stopSession.initiatorUserId === currentUserId) {
            // 只有发起者可以停止翻译
            stopSession.isActive = false;
            translationSessions.delete(stopSessionId);
            
            // 通知目标用户停止翻译
            const stopTargetClient = clients.get(stopSession.targetUserId);
            if (stopTargetClient && stopTargetClient.ws.readyState === WebSocket.OPEN) {
              stopTargetClient.ws.send(JSON.stringify({
                type: 'stop_translation',
                fromUserId: currentUserId,
                toUserId: stopSession.targetUserId
              }));
            }
            
            // 清除翻译状态
            clearUserTranslationStatus(currentRoomId, stopSession.targetUserId);
            
            // 广播翻译状态更新
            broadcastTranslationStatusToRoom(currentRoomId);
            
            console.log(`停止翻译会话: ${stopSessionId}`);
          }
          break;
          
        case 'translation_result':
          // 翻译结果广播
          const { sessionId: resultSessionId, original, translation, fromUserId } = data;
          const resultSession = translationSessions.get(resultSessionId);
          
          if (resultSession && resultSession.isActive) {
            // 向所有查看者广播翻译结果，但排除说话者本人
            resultSession.viewers.forEach(viewerId => {
              // 跳过说话者本人，避免自己看到自己的翻译
              if (viewerId === fromUserId) {
                return;
              }
              
              const viewerClient = clients.get(viewerId);
              if (viewerClient && viewerClient.ws.readyState === WebSocket.OPEN) {
                viewerClient.ws.send(JSON.stringify({
                  type: 'translation_broadcast',
                  sessionId: resultSessionId,
                  original,
                  translation,
                  timestamp: Date.now()
                }));
              }
            });
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
      // 处理设定者断开连接的情况
      const userSessions = Array.from(translationSessions.entries())
        .filter(([sessionId, session]) => session.initiatorUserId === currentUserId && session.isActive);
      
      userSessions.forEach(([sessionId, session]) => {
        // 停止翻译会话
        session.isActive = false;
        translationSessions.delete(sessionId);
        
        // 通知目标用户停止翻译
        const targetClient = clients.get(session.targetUserId);
        if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
          targetClient.ws.send(JSON.stringify({
            type: 'stop_translation',
            fromUserId: currentUserId,
            toUserId: session.targetUserId
          }));
        }
        
        // 清除翻译状态
        clearUserTranslationStatus(currentRoomId, session.targetUserId);
      });

      // 新增：清理所有会话的viewers中该用户
      for (const [sessionId, session] of translationSessions.entries()) {
        if (session.viewers.has(currentUserId)) {
          session.viewers.delete(currentUserId);
        }
      }

      // 从房间中移除用户
      if (currentRoomId && rooms.has(currentRoomId)) {
        rooms.get(currentRoomId).delete(currentUserId);
        
        // 如果房间为空，删除房间
        if (rooms.get(currentRoomId).size === 0) {
          rooms.delete(currentRoomId);
          roomTranslationStatus.delete(currentRoomId);
          console.log(`房间 ${currentRoomId} 已清空，删除房间`);
        }
      }
      
      // 移除用户
      clients.delete(currentUserId);
      users.delete(currentUserId);
      
      // 广播房间内用户列表更新和翻译状态更新
      if (currentRoomId) {
        broadcastUserListToRoom(currentRoomId);
        broadcastTranslationStatusToRoom(currentRoomId);
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
        // 处理设定者断开连接的情况
        const userSessions = Array.from(translationSessions.entries())
          .filter(([sessionId, session]) => session.initiatorUserId === userIdToRemove && session.isActive);
        
        userSessions.forEach(([sessionId, session]) => {
          // 停止翻译会话
          session.isActive = false;
          translationSessions.delete(sessionId);
          
          // 通知目标用户停止翻译
          const targetClient = clients.get(session.targetUserId);
          if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
            targetClient.ws.send(JSON.stringify({
              type: 'stop_translation',
              fromUserId: userIdToRemove,
              toUserId: session.targetUserId
            }));
          }
          
          // 清除翻译状态
          clearUserTranslationStatus(roomIdToUpdate, session.targetUserId);
        });
        
        // 新增：清理所有会话的viewers中该用户
        for (const [sessionId, session] of translationSessions.entries()) {
          if (session.viewers.has(userIdToRemove)) {
            session.viewers.delete(userIdToRemove);
          }
        }

        // 从房间中移除用户
        if (roomIdToUpdate && rooms.has(roomIdToUpdate)) {
          rooms.get(roomIdToUpdate).delete(userIdToRemove);
          
          // 如果房间为空，删除房间
          if (rooms.get(roomIdToUpdate).size === 0) {
            rooms.delete(roomIdToUpdate);
            roomTranslationStatus.delete(roomIdToUpdate);
            console.log(`房间 ${roomIdToUpdate} 已清空，删除房间`);
          }
        }
        
        clients.delete(userIdToRemove);
        users.delete(userIdToRemove);
        
        // 广播房间内用户列表更新和翻译状态更新
        if (roomIdToUpdate) {
          broadcastUserListToRoom(roomIdToUpdate);
          broadcastTranslationStatusToRoom(roomIdToUpdate);
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
      // 添加翻译状态信息
      const translationStatus = getUserTranslationStatus(roomId, userId);
      if (translationStatus) {
        // 添加查看者信息
        const session = translationSessions.get(translationStatus.sessionId);
        if (session) {
          translationStatus.viewers = Array.from(session.viewers);
        }
        user.translationStatus = translationStatus;
      }
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
  console.log('支持基于房间的用户隔离和多人翻译会话管理');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
}); 
