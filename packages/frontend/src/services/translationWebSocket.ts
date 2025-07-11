import { getWebSocketUrl } from '../config/websocket';

// 翻译WebSocket服务
export interface TranslationUser {
  id: string;
  name: string;
  isOnline: boolean;
  roomId?: string; // 新增房间ID
}

export interface TranslationCommand {
  type: 'start_translation' | 'stop_translation' | 'translation_result';
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
  private currentRoomId: string = ''; // 新增当前房间ID
  private users: Map<string, TranslationUser> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 3000;
  private eventListeners: Map<string, Function[]> = new Map();

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
          
          // 发送用户上线消息，包含房间ID
          this.sendMessage({
            type: 'user_online',
            userId: userId,
            userName: userName,
            roomId: roomId
          });
          
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
      default:
        console.log('未知消息类型:', data.type);
    }
  }

  // 发送消息
  sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('用户间通信WebSocket未连接，无法发送消息');
    }
  }

  // 开始翻译
  startTranslation(targetUserId: string, fromLang: string, toLang: string): void {
    console.log('translationWebSocketService startTranslation 参数:', {
      targetUserId,
      fromLang,
      toLang
    });
    this.sendMessage({
      type: 'start_translation',
      fromUserId: this.currentUserId,
      toUserId: targetUserId,
      fromLang,
      toLang
    });
    console.log('发送 start_translation 消息:', {
      type: 'start_translation',
      fromUserId: this.currentUserId,
      toUserId: targetUserId,
      fromLang,
      toLang
    });
  }

  // 停止翻译
  stopTranslation(targetUserId: string): void {
    this.sendMessage({
      type: 'stop_translation',
      fromUserId: this.currentUserId,
      toUserId: targetUserId
    });
  }

  // 发送翻译结果
  sendTranslationResult(targetUserId: string, result: TranslationResult): void {
    this.sendMessage({
      type: 'translation_result',
      fromUserId: this.currentUserId,
      toUserId: targetUserId,
      data: result
    });
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
    this.eventListeners.clear();
  }
}

// 导出单例实例
export const translationWebSocketService = new TranslationWebSocketService(); 
