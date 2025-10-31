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
  
  const port = parseInt(process.env.PORT || '3002', 10);
  
  // 检查端口是否可用
  try {
    await app.listen(port);
    logger.log(`✅ 翻译WebSocket服务器运行在端口 ${port}`);
    logger.log(`✅ WebSocket地址: ws://localhost:${port}/translation`);
    logger.log('✅ 支持基于房间的翻译消息广播');
    logger.log(`✅ 健康检查: http://localhost:${port}/health`);
  } catch (error) {
    logger.error(`❌ 端口 ${port} 被占用，尝试使用备用端口...`);
    const fallbackPort = 3003;
    await app.listen(fallbackPort);
    logger.log(`⚠️ 翻译WebSocket服务器运行在端口 ${fallbackPort} (备用端口)`);
    logger.log(`⚠️ 注意：前端需要配置为端口 ${fallbackPort}`);
    logger.log(`✅ WebSocket地址: ws://localhost:${fallbackPort}/translation`);
    logger.log('✅ 支持基于房间的翻译消息广播');
  }
}

bootstrap();
