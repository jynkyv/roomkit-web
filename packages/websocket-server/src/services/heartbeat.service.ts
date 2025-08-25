import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒检查一次
  private readonly HEARTBEAT_TIMEOUT = 600000; // 10分钟超时 (600秒)
  private clientHeartbeats = new Map<string, { socket: Socket; lastPing: number; userId?: string }>();

  addClient(clientId: string, socket: Socket, userId?: string): void {
    this.clientHeartbeats.set(clientId, {
      socket,
      lastPing: Date.now(),
      userId,
    });
    this.logger.log(`添加客户端心跳监控: ${clientId}${userId ? ` (用户: ${userId})` : ''}`);
  }

  removeClient(clientId: string): void {
    const client = this.clientHeartbeats.get(clientId);
    if (client) {
      this.logger.log(`移除客户端心跳监控: ${clientId}${client.userId ? ` (用户: ${client.userId})` : ''}`);
    }
    this.clientHeartbeats.delete(clientId);
  }

  updateHeartbeat(clientId: string): void {
    const client = this.clientHeartbeats.get(clientId);
    if (client) {
      const oldTime = client.lastPing;
      client.lastPing = Date.now();
      const timeDiff = client.lastPing - oldTime;
      if (timeDiff > 60000) { // 如果间隔超过1分钟，记录日志
        this.logger.log(`客户端 ${clientId}${client.userId ? ` (用户: ${client.userId})` : ''} 心跳更新，间隔: ${Math.round(timeDiff / 1000)}秒`);
      }
    }
  }

  startHeartbeatMonitoring(): void {
    this.logger.log(`启动心跳监控，检查间隔: ${this.HEARTBEAT_INTERVAL / 1000}秒，超时时间: ${this.HEARTBEAT_TIMEOUT / 1000}秒`);
    
    setInterval(() => {
      const now = Date.now();
      const clientsToRemove: string[] = [];

      for (const [clientId, client] of this.clientHeartbeats.entries()) {
        const timeSinceLastPing = now - client.lastPing;
        const minutesSinceLastPing = Math.round(timeSinceLastPing / 60000);
        
        if (timeSinceLastPing > this.HEARTBEAT_TIMEOUT) {
          this.logger.warn(`客户端 ${clientId}${client.userId ? ` (用户: ${client.userId})` : ''} 心跳超时 ${minutesSinceLastPing} 分钟，断开连接`);
          client.socket.disconnect();
          clientsToRemove.push(clientId);
        } else if (timeSinceLastPing > 300000) { // 5分钟无活动时记录警告
          this.logger.warn(`客户端 ${clientId}${client.userId ? ` (用户: ${client.userId})` : ''} 已 ${minutesSinceLastPing} 分钟无心跳活动`);
        }
      }

      clientsToRemove.forEach(clientId => {
        this.clientHeartbeats.delete(clientId);
      });
    }, this.HEARTBEAT_INTERVAL);
  }
}
