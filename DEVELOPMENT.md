# 开发指南

## Monorepo架构

本项目采用Monorepo架构，使用pnpm作为包管理器：

```
roomkit-project/
├── packages/
│   ├── frontend/          # Vue.js前端
│   └── websocket-server/  # WebSocket服务器
├── package.json           # 根配置
└── pnpm-workspace.yaml   # 工作区配置
```

## 开发环境设置

### 1. 安装pnpm

```bash
npm install -g pnpm
```

### 2. 安装依赖

```bash
# 在项目根目录
pnpm install
```

### 3. 启动开发环境

```bash
# 同时启动前端和服务器
pnpm dev

# 仅启动前端
pnpm dev:frontend

# 仅启动服务器
pnpm dev:server
```

## 开发流程

### 日常开发

1. **在main分支进行开发**
   - 所有代码都在main分支
   - 前端和服务器代码都在同一个仓库

2. **本地测试**
   ```bash
   pnpm dev
   ```
   - 前端：http://localhost:5173
   - WebSocket：ws://localhost:8080

3. **代码提交**
   ```bash
   git add .
   git commit -m "feat: 添加新功能"
   git push origin main
   ```

### 部署流程

#### 前端部署（Vercel）

1. 在Vercel创建新项目
2. 连接GitHub仓库
3. 设置：
   - Root Directory: `packages/frontend`
   - Build Command: `pnpm build`
   - Output Directory: `dist`
   - Install Command: `pnpm install`

#### 服务器部署（Railway）

1. 在Railway创建新项目
2. 连接GitHub仓库
3. 设置：
   - Root Directory: `packages/websocket-server`
   - Start Command: `pnpm start`

## 分支策略

### 推荐的分支策略

```
main                    # 主分支，包含所有代码
├── frontend/          # 前端代码
└── websocket-server/  # 服务器代码

websocket-server       # 仅包含服务器代码的分支（用于Railway部署）
└── packages/websocket-server/
```

### 部署分支管理

1. **创建websocket-server分支**：
   ```bash
   git checkout -b websocket-server
   git rm -rf packages/frontend
   git commit -m "chore: 创建服务器部署分支"
   git push origin websocket-server
   ```

2. **更新服务器代码**：
   ```bash
   # 在main分支修改服务器代码
   git add .
   git commit -m "feat: 更新服务器功能"
   git push origin main
   
   # 合并到websocket-server分支
   git checkout websocket-server
   git merge main
   git push origin websocket-server
   ```

## 包管理

### 添加依赖

```bash
# 为前端添加依赖
pnpm --filter frontend add package-name

# 为服务器添加依赖
pnpm --filter websocket-server add package-name

# 添加开发依赖
pnpm --filter frontend add -D package-name
```

### 运行脚本

```bash
# 运行前端脚本
pnpm --filter frontend dev

# 运行服务器脚本
pnpm --filter websocket-server dev

# 并行运行所有包的脚本
pnpm --parallel dev
```

## 调试技巧

### 前端调试

1. **Vue DevTools**：安装Vue DevTools浏览器扩展
2. **控制台日志**：查看WebSocket连接状态
3. **网络面板**：监控WebSocket消息

### 服务器调试

1. **nodemon**：自动重启服务器
2. **控制台日志**：查看连接和消息
3. **健康检查**：访问 http://localhost:8080/health

### WebSocket调试

1. **浏览器控制台**：
   ```javascript
   // 检查WebSocket连接
   console.log('WebSocket状态:', ws.readyState);
   ```

2. **消息监控**：
   ```javascript
   // 在浏览器控制台监控消息
   ws.addEventListener('message', (event) => {
     console.log('收到消息:', JSON.parse(event.data));
   });
   ```

## 常见问题

### Q: 如何修改服务器代码？

A: 
1. 在main分支修改 `packages/websocket-server/translationServer.js`
2. 本地测试：`pnpm dev:server`
3. 提交到main分支
4. 合并到websocket-server分支并部署

### Q: 如何添加新的依赖？

A:
```bash
# 前端依赖
pnpm --filter frontend add package-name

# 服务器依赖
pnpm --filter websocket-server add package-name
```

### Q: 如何调试WebSocket连接问题？

A:
1. 检查浏览器控制台的WebSocket日志
2. 确认服务器是否正常运行：`pnpm dev:server`
3. 检查端口8080是否被占用
4. 访问健康检查端点：http://localhost:8080/health

### Q: 如何测试生产环境？

A:
1. 确保websocket-server分支已部署到Railway
2. 在浏览器中访问生产环境URL
3. 前端会自动连接到生产WebSocket服务器

## 环境配置

### 开发环境
- 前端：http://localhost:5173
- WebSocket：ws://localhost:8080
- 自动重连和调试日志

### 生产环境
- 前端：Vercel部署
- WebSocket：Railway部署
- 优化的性能和错误处理

## 代码规范

### 文件结构
```
packages/frontend/src/
├── components/     # Vue组件
├── services/      # 服务层
├── stores/        # 状态管理
├── utils/         # 工具函数
└── config/        # 配置文件
```

### 命名规范
- 组件：PascalCase (UserSelector.vue)
- 文件：kebab-case (translation-websocket.ts)
- 变量：camelCase (userName)
- 常量：UPPER_SNAKE_CASE (API_URL)

### Git提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建过程或辅助工具的变动
``` 
