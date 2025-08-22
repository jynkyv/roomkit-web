import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60秒
  private clientHeartbeats = new Map<string, { socket: Socket; lastPing: number }>();

  addClient(clientId: string, socket: Socket): void {
    this.clientHeartbeats.set(clientId, {
      socket,
      lastPing: Date.now(),
    });
  }

  removeClient(clientId: string): void {
    this.clientHeartbeats.delete(clientId);
  }

  updateHeartbeat(clientId: string): void {
    const client = this.clientHeartbeats.get(clientId);
    if (client) {
      client.lastPing = Date.now();
    }
  }

  startHeartbeatMonitoring(): void {
    setInterval(() => {
      const now = Date.now();
      const clientsToRemove: string[] = [];

      for (const [clientId, client] of this.clientHeartbeats.entries()) {
        if (now - client.lastPing > this.HEARTBEAT_TIMEOUT) {
          this.logger.warn(`客户端 ${clientId} 心跳超时，断开连接`);
          client.socket.disconnect();
          clientsToRemove.push(clientId);
        }
      }

      clientsToRemove.forEach(clientId => {
        this.clientHeartbeats.delete(clientId);
      });
    }, this.HEARTBEAT_INTERVAL);
  }
}
