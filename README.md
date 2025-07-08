# RoomKit 实时翻译系统

一个基于Vue.js和WebSocket的实时翻译系统，支持多语言实时翻译。

## 项目结构

```
roomkit-project/
├── packages/
│   ├── frontend/          # Vue.js前端应用
│   │   ├── src/          # 源代码
│   │   ├── public/       # 静态资源
│   │   └── package.json  # 前端依赖
│   └── websocket-server/ # WebSocket服务器
│       ├── translationServer.js  # 服务器主文件
│       └── package.json  # 服务器依赖
├── package.json          # 根package.json
└── pnpm-workspace.yaml  # pnpm工作区配置
```

## 快速开始

### 安装依赖

```bash
# 安装pnpm（如果还没有）
npm install -g pnpm

# 安装所有依赖
pnpm install
```

### 开发模式

```bash
# 同时启动前端和服务器
pnpm dev

# 仅启动前端
pnpm dev:frontend

# 仅启动服务器
pnpm dev:server
```

### 构建

```bash
# 构建所有包
pnpm build

# 构建前端
pnpm build:frontend

# 构建服务器
pnpm build:server
```

## 部署

### 前端部署（Vercel）

1. 在Vercel创建新项目
2. 连接GitHub仓库
3. 设置根目录为 `packages/frontend`
4. 设置构建命令为 `pnpm build`
5. 设置输出目录为 `dist`

### 服务器部署（Railway）

1. 在Railway创建新项目
2. 连接GitHub仓库的 `websocket-server` 分支
3. 设置根目录为 `packages/websocket-server`
4. 设置启动命令为 `pnpm start`

## 开发指南

### 本地开发

1. 启动完整开发环境：
   ```bash
   pnpm dev
   ```

2. 前端访问：http://localhost:5173
3. WebSocket服务器：ws://localhost:8080

### 代码结构

- **前端**：Vue 3 + TypeScript + Vite
- **服务器**：Node.js + WebSocket
- **包管理**：pnpm + Monorepo

### 环境配置

- 开发环境：自动连接到本地WebSocket服务器
- 生产环境：连接到Railway部署的WebSocket服务器

## 功能特性

- 🌐 多语言实时翻译
- 👥 多用户支持
- 🔄 实时WebSocket通信
- 📱 响应式设计
- 🌍 国际化支持

## 技术栈

- **前端**：Vue 3, TypeScript, Vite, Pinia
- **后端**：Node.js, WebSocket
- **部署**：Vercel (前端), Railway (后端)
- **包管理**：pnpm + Monorepo

## 贡献

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License
