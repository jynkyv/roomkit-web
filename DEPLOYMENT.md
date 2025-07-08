# WebSocket服务部署指南

## 方案1：Railway（推荐）

### 优点：
- 免费额度充足（每月500小时）
- 部署简单，支持GitHub集成
- 自动HTTPS和域名
- 支持WebSocket

### 部署步骤：

1. **注册Railway账户**
   - 访问 https://railway.app
   - 使用GitHub账户登录

2. **创建新项目**
   - 点击"New Project"
   - 选择"Deploy from GitHub repo"
   - 选择你的GitHub仓库

3. **配置部署**
   - Railway会自动检测到Node.js项目
   - 设置环境变量（如果需要）
   - 部署命令会自动使用 `npm run server`

4. **获取部署URL**
   - 部署完成后，Railway会提供一个域名
   - 格式类似：`https://your-app-name.railway.app`

5. **更新前端配置**
   - 编辑 `src/config/websocket.ts`
   - 将生产环境URL更新为Railway提供的域名：
   ```typescript
   production: {
     url: 'wss://your-app-name.railway.app/translation'
   }
   ```

6. **重新部署前端**
   - 推送代码到GitHub
   - Vercel会自动重新部署

## 方案2：Render

### 优点：
- 免费额度（每月750小时）
- 简单易用
- 支持WebSocket

### 部署步骤：

1. **注册Render账户**
   - 访问 https://render.com
   - 使用GitHub账户登录

2. **创建Web Service**
   - 点击"New +" → "Web Service"
   - 连接你的GitHub仓库

3. **配置服务**
   - **Name**: translation-websocket
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run server`
   - **Plan**: Free

4. **部署和获取URL**
   - 点击"Create Web Service"
   - 等待部署完成
   - 获取提供的域名

5. **更新前端配置**
   - 编辑 `src/config/websocket.ts`
   - 更新生产环境URL

## 方案3：Heroku

### 优点：
- 稳定可靠
- 支持WebSocket
- 有免费计划

### 部署步骤：

1. **安装Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **创建Heroku应用**
   ```bash
   heroku create your-app-name
   ```

3. **部署**
   ```bash
   git push heroku main
   ```

4. **获取URL并更新配置**

## 方案4：DigitalOcean App Platform

### 优点：
- 性能好
- 价格合理
- 支持WebSocket

### 部署步骤：

1. **注册DigitalOcean账户**
2. **创建App**
3. **连接GitHub仓库**
4. **配置环境变量**
5. **部署并获取URL**

## 测试部署

部署完成后，可以通过以下方式测试：

1. **健康检查**
   ```
   https://your-app-domain.com/health
   ```

2. **WebSocket连接测试**
   - 打开浏览器开发者工具
   - 在控制台测试连接：
   ```javascript
   const ws = new WebSocket('wss://your-app-domain.com/translation');
   ws.onopen = () => console.log('连接成功');
   ws.onmessage = (event) => console.log('收到消息:', event.data);
   ```

## 注意事项

1. **环境变量**：如果有敏感配置，使用环境变量
2. **CORS**：确保服务器配置了正确的CORS头
3. **HTTPS**：生产环境必须使用WSS（WebSocket Secure）
4. **监控**：建议设置日志监控和错误告警
5. **备份**：定期备份重要数据

## 故障排除

### 常见问题：

1. **WebSocket连接失败**
   - 检查URL是否正确
   - 确认服务器正在运行
   - 检查防火墙设置

2. **CORS错误**
   - 确认服务器配置了正确的CORS头
   - 检查域名是否在白名单中

3. **部署失败**
   - 检查package.json中的脚本
   - 确认所有依赖都已安装
   - 查看部署日志

### 调试技巧：

1. **查看服务器日志**
   - Railway: 在Dashboard中查看日志
   - Render: 在Service页面查看日志

2. **本地测试**
   ```bash
   npm run server
   ```

3. **网络测试**
   ```bash
   curl https://your-app-domain.com/health
   ``` 
