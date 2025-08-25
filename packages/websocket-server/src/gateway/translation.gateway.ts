import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters, UseInterceptors, UsePipes } from '@nestjs/common';
import { RoomService } from '../services/room.service';
import { UserService } from '../services/user.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { TranslationMessage, UserInfo, WebSocketMessage } from '../interfaces/translation.interface';
import { TranslationMessageDto, UserJoinDto } from '../dto/translation.dto';
import { WebSocketExceptionFilter } from '../filters/websocket-exception.filter';
import { ValidationPipe } from '../pipes/validation.pipe';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  path: '/translation',
})
@UseFilters(WebSocketExceptionFilter)
@UseInterceptors(LoggingInterceptor)
export class TranslationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TranslationGateway.name);
  private clientToUser = new Map<string, { userId: string; roomId: string }>();

  constructor(
    private readonly roomService: RoomService,
    private readonly userService: UserService,
    private readonly heartbeatService: HeartbeatService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway 初始化完成');
    this.heartbeatService.startHeartbeatMonitoring();
  }

  handleConnection(client: Socket) {
    this.logger.log(`客户端连接: ${client.id}`);
    
    // 发送连接确认
    client.emit('connected', {
      clientId: client.id,
      timestamp: Date.now(),
    });
  }

  handleDisconnect(client: Socket) {
    const userInfo = this.clientToUser.get(client.id);
    if (userInfo) {
      this.handleUserLeave(client, userInfo.userId, userInfo.roomId);
    }
    this.heartbeatService.removeClient(client.id);
    this.clientToUser.delete(client.id);
    this.logger.log(`客户端断开连接: ${client.id}`);
  }

  @SubscribeMessage('user_online')
  handleUserOnline(client: Socket, data: any) {
    try {
      const { userId, userName, roomId } = data;
      
      // 验证房间ID格式（6位数字）
      if (!/^\d{6}$/.test(roomId)) {
        throw new Error('房间ID必须是6位数字');
      }
      
      // 检查用户是否已经在其他房间
      const existingUser = this.userService.getUser(userId);
      if (existingUser && existingUser.roomId !== roomId) {
        // 用户切换房间，先离开原房间
        this.handleUserLeave(client, userId, existingUser.roomId);
      }
      
      // 添加用户到服务
      this.userService.addUser(userId, userName, roomId);
      this.roomService.addUserToRoom(roomId, userId);
      
      // 记录客户端到用户的映射
      this.clientToUser.set(client.id, { userId, roomId });
      this.heartbeatService.addClient(client.id, client);
      
      // 加入Socket.IO房间
      client.join(roomId);
      
      // 广播用户加入消息给房间内其他用户
      client.to(roomId).emit('user_join', {
        userId,
        userName,
        roomId,
        timestamp: Date.now(),
      });
      
      // 发送房间用户列表给新用户
      const roomUsers = this.userService.getUsersInRoom(roomId);
      client.emit('user_list', {
        users: roomUsers,
        timestamp: Date.now(),
      });
      
      this.logger.log(`用户 ${userName} (${userId}) 加入房间 ${roomId}`);
    } catch (error) {
      this.logger.error('处理用户上线失败:', error);
      client.emit('error', {
        message: error.message,
        timestamp: Date.now(),
      });
    }
  }

  @SubscribeMessage('translation_message')
  handleTranslationMessage(client: Socket, data: any) {
    try {
      const { original, translation, userId, timestamp } = data;
      const userInfo = this.clientToUser.get(client.id);
      
      this.logger.log(`收到翻译消息: 客户端 ${client.id}, 用户 ${userId}`);
      this.logger.log(`用户信息:`, userInfo);
      
      if (!userInfo) {
        throw new Error('用户未登录');
      }
      
      const { roomId } = userInfo;
      this.logger.log(`房间ID: ${roomId}`);
      
      // 验证用户身份
      const user = this.userService.getUser(userId);
      this.logger.log(`用户验证结果:`, user);
      
      if (!user || user.roomId !== roomId) {
        throw new Error('用户信息不匹配');
      }
      
      // 更新房间活动时间
      this.roomService.updateRoomActivity(roomId);
      
      // 获取房间内的用户列表
      const roomUsers = this.roomService.getRoomUsers(roomId);
      this.logger.log(`房间 ${roomId} 用户列表:`, roomUsers);
      
      // 直接转发有道翻译的原始数据结构，只添加用户名
      const broadcastData = {
        ...data, // 保持有道翻译的原始数据结构
        userName: user.name, // 只添加用户名
      };
      
      this.logger.log(`准备广播消息:`, broadcastData);
      this.logger.log(`广播目标房间: ${roomId}, 发送者客户端: ${client.id}`);
      
      // 广播给房间内其他用户（排除发送者）
      client.to(roomId).emit('translation_broadcast', broadcastData);
      
      this.logger.log(`广播翻译消息: 用户 ${user.name} (${userId}) 在房间 ${roomId}`);
    } catch (error) {
      this.logger.error('处理翻译消息失败:', error);
      client.emit('error', {
        message: error.message,
        timestamp: Date.now(),
      });
    }
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(client: Socket) {
    this.heartbeatService.updateHeartbeat(client.id);
    client.emit('heartbeat_ack', { timestamp: Date.now() });
  }

  @SubscribeMessage('request_user_list')
  handleRequestUserList(client: Socket) {
    try {
      const userInfo = this.clientToUser.get(client.id);
      if (!userInfo) {
        throw new Error('用户未登录');
      }
      
      const { roomId } = userInfo;
      const roomUsers = this.userService.getUsersInRoom(roomId);
      
      client.emit('user_list', {
        users: roomUsers,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error('处理用户列表请求失败:', error);
      client.emit('error', {
        message: error.message,
        timestamp: Date.now(),
      });
    }
  }

  private handleUserLeave(client: Socket, userId: string, roomId: string) {
    try {
      const user = this.userService.getUser(userId);
      if (user) {
        // 从服务中移除用户
        this.userService.removeUser(userId);
        this.roomService.removeUserFromRoom(roomId, userId);
        
        // 离开Socket.IO房间 
        client.leave(roomId);
        
        // 广播用户离开消息
        client.to(roomId).emit('user_leave', {
          userId,
          userName: user.name,
          roomId,
          timestamp: Date.now(),
        });
        
        this.logger.log(`用户 ${user.name} (${userId}) 离开房间 ${roomId}`);
      }
    } catch (error) {
      this.logger.error('处理用户离开失败:', error);
    }
  }
}
