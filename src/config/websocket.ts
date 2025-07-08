// WebSocket配置
export const WEBSOCKET_CONFIG = {
  // 开发环境
  development: {
    url: 'ws://localhost:8080/translation'
  },
  // 生产环境 - 部署后需要更新为实际的Railway URL
  production: {
    url: 'wss://your-railway-app.railway.app/translation'
  }
};

// 获取当前环境的WebSocket URL
export function getWebSocketUrl(): string {
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const config = isDevelopment ? WEBSOCKET_CONFIG.development : WEBSOCKET_CONFIG.production;
  return config.url;
} 
