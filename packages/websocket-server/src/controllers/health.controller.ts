import { Controller, Get, Logger } from '@nestjs/common';
import { RoomService } from '../services/room.service';
import { UserService } from '../services/user.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly roomService: RoomService,
    private readonly userService: UserService,
  ) {}

  @Get()
  getHealth() {
    const rooms = this.roomService.getAllRooms();
    const users = this.userService.getAllUsers();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      stats: {
        activeRooms: rooms.size,
        activeUsers: users.size,
        totalConnections: Array.from(rooms.values()).reduce(
          (total, room) => total + room.users.size,
          0
        ),
      },
    };
  }
}
