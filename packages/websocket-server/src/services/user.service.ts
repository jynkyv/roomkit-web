import { Injectable, Logger } from '@nestjs/common';
import { UserInfo } from '../interfaces/translation.interface';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private users = new Map<string, UserInfo>();

  addUser(userId: string, userName: string, roomId: string): UserInfo {
    const user: UserInfo = {
      id: userId,
      name: userName,
      roomId,
      isOnline: true,
      lastSeen: Date.now(),
    };
    
    this.users.set(userId, user);
    this.logger.log(`添加用户: ${userName} (${userId}) 到房间 ${roomId}`);
    return user;
  }

  removeUser(userId: string): boolean {
    const user = this.users.get(userId);
    if (user) {
      this.logger.log(`移除用户: ${user.name} (${userId})`);
      this.users.delete(userId);
      return true;
    }
    return false;
  }

  getUser(userId: string): UserInfo | undefined {
    return this.users.get(userId);
  }

  updateUserLastSeen(userId: string): void {
    const user = this.users.get(userId);
    if (user) {
      user.lastSeen = Date.now();
    }
  }

  getUsersInRoom(roomId: string): UserInfo[] {
    return Array.from(this.users.values())
      .filter(user => user.roomId === roomId && user.isOnline);
  }

  getAllUsers(): Map<string, UserInfo> {
    return this.users;
  }
}
