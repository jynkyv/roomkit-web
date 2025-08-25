import { io, Socket } from 'socket.io-client';
import { getWebSocketUrl } from '../config/websocket';

// 简化的翻译用户接口
export interface TranslationUser {
  id: string;
  name: string;
  roomId: string;
  isOnline: boolean;
  lastSeen: number;
}

// 简化的翻译消息接口
export interface TranslationMessage {
  zhText: string;
  jaText: string;
  userId: string;
  timestamp: number;
}

// 系统消息接口
export interface SystemMessage {
  type: 'user_join' | 'user_leave' | 'heartbeat' | 'room_status';
  roomId: string;
  data: any;
}

class TranslationWebSocketService {
  private socket: Socket | null = null;
  private currentUserId: string = '';
  private currentRoomId: string = '';
  private users: Map<string, TranslationUser> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 3000;
  private heartbeatInterval: number = 30000;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  // 初始化WebSocket连接
  async connect(userId: string, userName: string, roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('开始连接翻译WebSocket服务...');
        console.log('WebSocket URL:', getWebSocketUrl());
        console.log('Socket.IO配置:', {
          path: '/translation',
          transports: ['websocket', 'polling'],
          timeout: 10000,
          forceNew: true,
        });
        
        this.currentUserId = userId;
        this.currentRoomId = roomId;
        
        // 创建Socket.IO连接
        this.socket = io(getWebSocketUrl(), {
          path: '/translation',
          transports: ['websocket', 'polling'],
          timeout: 10000,
          forceNew: true,
        });

        this.socket.on('connect', () => {
          console.log('翻译WebSocket连接成功');
          this.isConnected = true;
          this.emit('connected', { clientId: this.socket?.id });
          
          // 连接成功后立即发送用户上线消息
          this.sendUserOnline(userId, userName, roomId);
          
          // 启动心跳
          this.startHeartbeat();
          
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('翻译WebSocket连接断开:', reason);
          this.isConnected = false;
          this.emit('disconnected', { reason });
          
          if (reason === 'io server disconnect') {
            // 服务器主动断开，尝试重连
            console.log('服务器主动断开，尝试重连...');
            setTimeout(() => {
              this.socket?.connect();
            }, 1000);
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('翻译WebSocket连接错误:', error);
          this.isConnected = false;
          this.emit('error', { message: error.message || '连接错误' });
          reject(error);
        });

        // 监听消息
        this.setupMessageHandlers();
        
      } catch (error) {
        console.error('创建翻译WebSocket连接失败:', error);
        reject(error);
      }
    });
  }

  private setupMessageHandlers() {
    if (!this.socket) return;

    this.socket.on('connected', (data) => {
      console.log('WebSocket连接确认:', data);
      this.emit('connected', data);
    });

    this.socket.on('user_join', (data) => {
      console.log('用户加入:', data);
      this.addUser({
        id: data.userId,
        name: data.userName,
        roomId: data.roomId,
        isOnline: true,
        lastSeen: data.timestamp,
      });
      this.emit('user_join', data);
    });

    this.socket.on('user_leave', (data) => {
      console.log('用户离开:', data);
      this.removeUser(data.userId);
      this.emit('user_leave', data);
    });

    this.socket.on('user_list', (data) => {
      console.log('收到用户列表:', data);
      this.updateUserList(data.users);
      this.emit('user_list_updated', data.users);
    });

    this.socket.on('translation_broadcast', (data: TranslationMessage) => {
      console.log('收到翻译广播:', data);
      this.emit('translation_broadcast', data);
    });

    this.socket.on('room_status', (data) => {
      console.log('收到房间状态:', data);
      this.emit('room_status', data);
    });

    this.socket.on('heartbeat_ack', (data) => {
      console.log('心跳确认:', data);
    });

    this.socket.on('error', (data) => {
      console.error('WebSocket错误:', data);
      this.emit('error', data);
    });
  }

  private sendUserOnline(userId: string, userName: string, roomId: string): void {
    this.sendMessage('user_online', {
      userId,
      userName,
      roomId,
    });
  }

  // 发送翻译消息
  sendTranslationMessage(zhText: string, jaText: string): void {
    console.log('发送翻译消息:', { zhText, jaText, userId: this.currentUserId, roomId: this.currentRoomId });
    this.sendMessage('translation_message', {
      original: zhText,        // 有道翻译的原始字段名
      translation: jaText,     // 有道翻译的原始字段名
      userId: this.currentUserId,
      timestamp: Date.now(),
    });
  }

  // 发送心跳
  private sendHeartbeat(): void {
    this.sendMessage('heartbeat', {});
  }

  // 请求用户列表
  requestUserList(): void {
    this.sendMessage('request_user_list', {});
  }

  // 通用消息发送方法
  private sendMessage(type: string, data: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(type, data);
      console.log('发送消息:', type, data);
    } else {
      console.error('WebSocket未连接，无法发送消息');
    }
  }

  // 启动心跳
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  // 停止心跳
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 更新用户列表
  private updateUserList(users: TranslationUser[]): void {
    this.users.clear();
    users.forEach(user => {
      this.users.set(user.id, user);
    });
  }

  // 添加用户
  private addUser(user: TranslationUser): void {
    this.users.set(user.id, user);
  }

  // 移除用户
  private removeUser(userId: string): void {
    this.users.delete(userId);
  }

  // 获取用户列表（排除当前用户）
  getUsers(): TranslationUser[] {
    return Array.from(this.users.values())
      .filter(user => user.id !== this.currentUserId);
  }

  // 获取当前用户ID
  getCurrentUserId(): string {
    return this.currentUserId;
  }

  // 获取当前房间ID
  getCurrentRoomId(): string {
    return this.currentRoomId;
  }

  // 检查连接状态
  isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  // 事件监听器管理
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // 触发事件
  emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件监听器执行错误 (${event}):`, error);
        }
      });
    }
  }

  // 断开连接
  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.users.clear();
    this.eventListeners.clear();
  }
}

// 导出单例实例
export const translationWebSocketService = new TranslationWebSocketService(); 
