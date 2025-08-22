import { Injectable, Logger } from '@nestjs/common';
import { RoomInfo } from '../interfaces/translation.interface';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);
  private rooms = new Map<string, RoomInfo>();
  private readonly ROOM_TIMEOUT = 30 * 60 * 1000; // 30分钟

  constructor() {
    // 启动房间清理定时器
    this.startRoomCleanupTimer();
  }

  createRoom(roomId: string): RoomInfo {
    const room: RoomInfo = {
      id: roomId,
      users: new Set(),
      lastActivity: Date.now(),
      createdAt: Date.now(),
    };
    
    this.rooms.set(roomId, room);
    this.logger.log(`创建房间: ${roomId}`);
    return room;
  }

  getRoom(roomId: string): RoomInfo | undefined {
    return this.rooms.get(roomId);
  }

  addUserToRoom(roomId: string, userId: string): boolean {
    let room = this.rooms.get(roomId);
    
    if (!room) {
      room = this.createRoom(roomId);
    }
    
    room.users.add(userId);
    room.lastActivity = Date.now();
    
    this.logger.log(`用户 ${userId} 加入房间 ${roomId}`);
    
    return true;
  }

  removeUserFromRoom(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return false;
    }
    
    room.users.delete(userId);
    room.lastActivity = Date.now();
    
    this.logger.log(`用户 ${userId} 离开房间 ${roomId}`);
    
    // 如果房间为空，删除房间
    if (room.users.size === 0) {
      this.rooms.delete(roomId);
      this.logger.log(`房间 ${roomId} 已清空，删除房间`);
    }
    
    return true;
  }

  getRoomUsers(roomId: string): string[] {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.users) : [];
  }

  updateRoomActivity(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.lastActivity = Date.now();
    }
  }

  private startRoomCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      const roomsToDelete: string[] = [];
      
      for (const [roomId, room] of this.rooms.entries()) {
        if (now - room.lastActivity > this.ROOM_TIMEOUT) {
          roomsToDelete.push(roomId);
        }
      }
      
      roomsToDelete.forEach(roomId => {
        this.rooms.delete(roomId);
        this.logger.log(`房间 ${roomId} 超时，已删除`);
      });
    }, 5 * 60 * 1000); // 每5分钟检查一次
  }

  getAllRooms(): Map<string, RoomInfo> {
    return this.rooms;
  }
}
