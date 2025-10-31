// WebSocket配置
export const WEBSOCKET_CONFIG = {
  // 开发环境 - NestJS服务器（使用3002端口，避免与其他服务端口冲突）
  development: {
    url: 'http://127.0.0.1:3002'
  },
  // Railway生产环境（如果使用Railway部署）
  railway: {
    url: 'wss://roomkit-web-production-5fc3.up.railway.app'
  }
};

// 获取当前环境的WebSocket URL
export function getWebSocketUrl(): string {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // 开发环境
  const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  
  if (isDevelopment) {
    return WEBSOCKET_CONFIG.development.url;
  }
  
  // 生产环境：自动使用当前域名（适用于ECS部署）
  // Socket.IO会通过path选项自动添加 /translation 路径
  const wsUrl = `${protocol}//${hostname}`;
  
  console.log('=== WebSocket配置调试信息 ===');
  console.log('当前hostname:', hostname);
  console.log('当前URL:', window.location.href);
  console.log('是否开发环境:', isDevelopment);
  console.log('WebSocket基础URL:', wsUrl);
  
  // 开发环境额外提示
  if (isDevelopment) {
    console.warn('⚠️ 开发环境检测：确保WebSocket服务器正在运行');
    console.warn('   运行命令: pnpm dev 或 pnpm dev:server');
    console.warn('   服务器应该在: http://127.0.0.1:3002');
    console.warn('   健康检查: http://127.0.0.1:3002/health');
  } else {
    console.log('🌐 生产环境：WebSocket将通过Nginx代理连接');
    console.log('   确保Nginx已正确配置 /translation 路径代理');
  }
  
  console.log('=== 调试信息结束 ===');
  
  return wsUrl;
} 
