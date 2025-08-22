import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(WsException)
export class WebSocketExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WebSocketExceptionFilter.name);

  catch(exception: WsException, host: ArgumentsHost) {
    const ctx = host.switchToWs();
    const client = ctx.getClient<Socket>();
    const data = ctx.getData();

    this.logger.error(
      `WebSocket异常: ${exception.message}`,
      {
        clientId: client.id,
        data,
        stack: exception.stack,
      }
    );

    // 发送错误消息给客户端
    client.emit('error', {
      message: exception.message,
      timestamp: Date.now(),
    });
  }
}
