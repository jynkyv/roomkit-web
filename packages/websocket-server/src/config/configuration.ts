export default () => ({
  port: parseInt(process.env.PORT, 10) || 8080,
  environment: process.env.NODE_ENV || 'development',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  heartbeat: {
    interval: parseInt(process.env.HEARTBEAT_INTERVAL, 10) || 30000,
    timeout: parseInt(process.env.HEARTBEAT_TIMEOUT, 10) || 60000,
  },
  room: {
    timeout: parseInt(process.env.ROOM_TIMEOUT, 10) || 1800000, // 30分钟
  },
});
