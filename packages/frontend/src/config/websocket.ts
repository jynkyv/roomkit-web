// WebSocket配置
export const WEBSOCKET_CONFIG = {
  // 开发环境 - NestJS服务器
  development: {
    url: 'http://127.0.0.1:8080'
  },
  // 生产环境 - Railway部署的WebSocket服务器
  production: {
    url: 'wss://roomkit-web-production-5fc3.up.railway.app'
  }
};

// 获取当前环境的WebSocket URL
export function getWebSocketUrl(): string {
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const config = isDevelopment ? WEBSOCKET_CONFIG.development : WEBSOCKET_CONFIG.production;
  
  console.log('WebSocket配置调试信息:');
  console.log('当前hostname:', window.location.hostname);
  console.log('是否开发环境:', isDevelopment);
  console.log('选择的配置:', config);
  console.log('WebSocket URL:', config.url);
  
  return config.url;
} 
