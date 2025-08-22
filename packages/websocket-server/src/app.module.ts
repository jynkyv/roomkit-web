import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { TranslationGateway } from './gateway/translation.gateway';
import { RoomService } from './services/room.service';
import { UserService } from './services/user.service';
import { HeartbeatService } from './services/heartbeat.service';
import { HealthController } from './controllers/health.controller';
import { WebSocketExceptionFilter } from './filters/websocket-exception.filter';
import { ValidationPipe } from './pipes/validation.pipe';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ConnectionMiddleware } from './middleware/connection.middleware';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
  controllers: [HealthController],
  providers: [
    TranslationGateway,
    RoomService,
    UserService,
    HeartbeatService,
    {
      provide: APP_FILTER,
      useClass: WebSocketExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ConnectionMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
