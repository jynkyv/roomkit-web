import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  
  // 启用CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });
  
  const port = process.env.PORT || 8080;
  await app.listen(port);
  
  logger.log(`翻译WebSocket服务器运行在端口 ${port}`);
  logger.log(`WebSocket地址: ws://localhost:${port}/translation`);
  logger.log('支持基于房间的翻译消息广播');
}

bootstrap();
