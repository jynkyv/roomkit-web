import { getWebSocketUrl } from '../config/websocket';

// 翻译WebSocket服务
export interface TranslationUser {
  id: string;
  name: string;
  isOnline: boolean;
  roomId?: string;
  translationStatus?: TranslationStatus; // 新增翻译状态
}

export interface TranslationStatus {
  sessionId: string;
  initiatorUserId: string;
  fromLang: string;
  toLang: string;
  isActive: boolean;
  viewers?: string[]; // 新增查看者列表
}

export interface TranslationSession {
  sessionId: string;
  targetUserId: string;
  initiatorUserId: string;
  viewers: string[];
  fromLang: string;
  toLang: string;
  isActive: boolean;
}

export interface TranslationCommand {
  type: 'start_translation_session' | 'stop_translation_session' | 'join_translation_view' | 'leave_translation_view' | 'translation_result';
  fromUserId: string;
  toUserId: string;
  data?: any;
}

export interface TranslationResult {
  original: string;
  translation: string;
  timestamp: number;
  fromUserId: string;
  toUserId: string;
}

class TranslationWebSocketService {
  private ws: WebSocket | null = null;
  private currentUserId: string = '';
  private currentRoomId: string = '';
  private users: Map<string, TranslationUser> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 3000;
  private eventListeners: Map<string, Function[]> = new Map();
  
  // 翻译会话管理
  private translationSessions: Map<string, TranslationSession> = new Map();
  private userTranslationStatus: Map<string, TranslationStatus> = new Map();

  // 初始化WebSocket连接
  async connect(userId: string, userName: string, roomId: string): Promise<void> {
    this.currentUserId = userId;
    this.currentRoomId = roomId;
    
    // 添加当前用户到用户列表
    this.users.set(userId, {
      id: userId,
      name: userName,
      isOnline: true,
      roomId: roomId
    });

    return new Promise((resolve, reject) => {
      try {
        // 使用配置文件获取WebSocket地址
        const wsUrl = getWebSocketUrl();
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('用户间通信WebSocket连接成功');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // 延迟发送用户上线消息，确保连接状态已更新
          setTimeout(() => {
            this.sendMessage({
              type: 'user_online',
              userId: userId,
              userName: userName,
              roomId: roomId
            });
          }, 100);
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('解析WebSocket消息失败:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('用户间通信WebSocket连接错误:', error);
          this.isConnected = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('用户间通信WebSocket连接已关闭');
          this.isConnected = false;
          this.handleReconnect();
        };

      } catch (error) {
        console.error('创建用户间通信WebSocket连接失败:', error);
        reject(error);
      }
    });
  }

  // 处理接收到的消息
  private handleMessage(data: any) {
    console.log('收到WebSocket消息:', data);

    switch (data.type) {
      case 'user_list':
        this.updateUserList(data.users);
        break;
      case 'user_online':
        this.addUser(data.user);
        break;
      case 'user_offline':
        this.removeUser(data.userId);
        break;
      case 'start_translation':
        this.emit('start_translation', data);
        break;
      case 'stop_translation':
        this.emit('stop_translation', data);
        break;
      case 'translation_result':
        this.emit('translation_result', data);
        break;
      case 'translation_broadcast':
        this.emit('translation_broadcast', data);
        break;
      case 'translation_status_update':
        this.updateTranslationStatus(data.statusMap);
        break;
      case 'room_translation_status':
        this.updateTranslationStatus(data.statusMap);
        break;
      default:
        console.log('未知消息类型:', data.type);
    }
  }

  // 发送消息
  sendMessage(message: any): void {
    console.log('尝试发送消息:', message, '连接状态:', this.isConnected, 'WebSocket状态:', this.ws?.readyState);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isConnected) {
      this.ws.send(JSON.stringify(message));
      console.log('消息发送成功');
    } else {
      console.error('用户间通信WebSocket未连接，无法发送消息');
      console.error('WebSocket状态:', this.ws?.readyState, '连接状态:', this.isConnected);
      
      // 如果连接未建立，尝试重新连接
      if (this.currentUserId && this.currentRoomId) {
        console.log('尝试重新连接WebSocket...');
        this.connect(this.currentUserId, this.users.get(this.currentUserId)?.name || 'Unknown', this.currentRoomId);
      }
    }
  }

  // 开始翻译会话
  startTranslationSession(targetUserId: string, fromLang: string, toLang: string): void {
    console.log('开始翻译会话:', { targetUserId, fromLang, toLang });
    this.sendMessage({
      type: 'start_translation_session',
      targetUserId,
      fromLang,
      toLang
    });
  }

  // 停止翻译会话
  stopTranslationSession(sessionId: string): void {
    console.log('停止翻译会话:', sessionId);
    this.sendMessage({
      type: 'stop_translation_session',
      sessionId
    });
  }

  // 加入翻译查看
  joinTranslationView(sessionId: string): void {
    console.log('加入翻译查看:', sessionId);
    this.sendMessage({
      type: 'join_translation_view',
      sessionId
    });
  }

  // 离开翻译查看
  leaveTranslationView(sessionId: string): void {
    console.log('离开翻译查看:', sessionId);
    this.sendMessage({
      type: 'leave_translation_view',
      sessionId
    });
  }

  // 发送翻译结果
  sendTranslationResult(sessionId: string, original: string, translation: string): void {
    this.sendMessage({
      type: 'translation_result',
      sessionId,
      original,
      translation
    });
  }

  // 更新翻译状态
  private updateTranslationStatus(statusMap: Record<string, TranslationStatus>): void {
    this.userTranslationStatus.clear();
    Object.entries(statusMap).forEach(([userId, status]) => {
      this.userTranslationStatus.set(userId, status);
    });
    
    // 更新用户列表中的翻译状态
    this.users.forEach((user, userId) => {
      const status = this.userTranslationStatus.get(userId);
      if (status) {
        user.translationStatus = status;
      } else {
        delete user.translationStatus;
      }
    });
    
    this.emit('translation_status_updated', statusMap);
  }

  // 获取用户翻译状态
  getUserTranslationStatus(userId: string): TranslationStatus | null {
    return this.userTranslationStatus.get(userId) || null;
  }

  // 检查用户是否正在被翻译
  isUserBeingTranslated(userId: string): boolean {
    const status = this.getUserTranslationStatus(userId);
    return status ? status.isActive : false;
  }

  // 检查当前用户是否是翻译发起者
  isCurrentUserInitiator(userId: string): boolean {
    const status = this.getUserTranslationStatus(userId);
    return status ? status.initiatorUserId === this.currentUserId : false;
  }

  // 检查当前用户是否是翻译查看者
  isCurrentUserViewer(sessionId: string): boolean {
    const session = this.translationSessions.get(sessionId);
    return session ? session.viewers.includes(this.currentUserId) : false;
  }

  // 更新用户列表
  private updateUserList(users: TranslationUser[]): void {
    this.users.clear();
    users.forEach(user => {
      this.users.set(user.id, user);
    });
    this.emit('user_list_updated', Array.from(this.users.values()));
  }

  // 添加用户
  private addUser(user: TranslationUser): void {
    this.users.set(user.id, user);
    this.emit('user_added', user);
  }

  // 移除用户
  private removeUser(userId: string): void {
    this.users.delete(userId);
    this.userTranslationStatus.delete(userId);
    this.emit('user_removed', userId);
  }

  // 获取用户列表（只返回同房间的用户）
  getUsers(): TranslationUser[] {
    return Array.from(this.users.values())
      .filter(user => user.id !== this.currentUserId && user.roomId === this.currentRoomId);
  }

  // 刷新用户列表
  refreshUserList(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: 'request_user_list'
      });
      console.log('发送刷新用户列表请求');
    } else {
      console.error('用户间通信WebSocket未连接，无法刷新用户列表');
    }
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

  // 重连处理
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`尝试重连用户间通信WebSocket... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect(this.currentUserId, this.users.get(this.currentUserId)?.name || 'Unknown', this.currentRoomId);
      }, this.reconnectInterval);
    } else {
      console.error('用户间通信WebSocket重连失败，已达到最大重试次数');
    }
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.users.clear();
    this.translationSessions.clear();
    this.userTranslationStatus.clear();
    this.eventListeners.clear();
  }
}

// 导出单例实例
export const translationWebSocketService = new TranslationWebSocketService(); 
