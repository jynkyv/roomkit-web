// WebSocket配置
export const WEBSOCKET_CONFIG = {
  // 开发环境 - NestJS服务器（使用3002端口，避免与其他服务端口冲突）
  development: {
    url: 'http://127.0.0.1:3002'
  },
  // 生产环境 - Railway部署的WebSocket服务器
  production: {
    url: 'wss://roomkit-web-production-5fc3.up.railway.app'
  }
};

// 获取当前环境的WebSocket URL
export function getWebSocketUrl(): string {
  const hostname = window.location.hostname;
  const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  const config = isDevelopment ? WEBSOCKET_CONFIG.development : WEBSOCKET_CONFIG.production;
  
  console.log('=== WebSocket配置调试信息 ===');
  console.log('当前hostname:', hostname);
  console.log('当前URL:', window.location.href);
  console.log('是否开发环境:', isDevelopment);
  console.log('选择的配置:', config);
  console.log('WebSocket URL:', config.url);
  console.log('完整WebSocket地址:', `${config.url}/translation`);
  
  // 开发环境额外提示
  if (isDevelopment) {
    console.warn('⚠️ 开发环境检测：确保WebSocket服务器正在运行');
    console.warn('   运行命令: pnpm dev:server');
    console.warn('   或: cd packages/websocket-server && pnpm run start:dev');
    console.warn('   服务器应该在: http://127.0.0.1:3002');
    console.warn('   健康检查: http://127.0.0.1:3002/health');
  }
  
  console.log('=== 调试信息结束 ===');
  
  return config.url;
} 
