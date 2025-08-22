import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToWs();
    const client = ctx.getClient();
    const data = ctx.getData();
    const event = context.getHandler().name;

    const now = Date.now();

    this.logger.log(
      `收到WebSocket消息: ${event}`,
      {
        clientId: client.id,
        event,
        data,
      }
    );

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `处理WebSocket消息完成: ${event} (${Date.now() - now}ms)`,
          {
            clientId: client.id,
            event,
          }
        );
      })
    );
  }
}
