#!/bin/bash
# 这个脚本用于生成服务器端的 skip-docker-deploy.sh
# 在服务器上执行以下命令来创建脚本

cat > /opt/roomkit-web/scripts/skip-docker-deploy.sh << 'SCRIPTEOF'
#!/bin/bash

# 跳过 Docker 安装，直接使用 Node.js 运行服务的部署脚本
# 在服务器上运行此脚本: bash scripts/skip-docker-deploy.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

REMOTE_PATH="${REMOTE_PATH:-/opt/roomkit-web}"

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    print_error "请使用root用户运行此脚本: sudo $0"
    exit 1
fi

print_info "开始跳过 Docker，使用 Node.js 直接运行服务..."

# 1. 中断可能卡住的 apt-get 进程
print_info "检查并清理可能卡住的安装进程..."
if pgrep -f "apt-get|dpkg" > /dev/null; then
    print_warn "发现正在运行的 apt-get/dpkg 进程，尝试清理..."
    pkill -9 -f "apt-get install" 2>/dev/null || true
    sleep 2
    
    # 检查并修复 dpkg 锁
    if [ -f /var/lib/dpkg/lock-frontend ]; then
        print_warn "发现 dpkg 锁，尝试移除..."
        rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock
        dpkg --configure -a 2>/dev/null || true
    fi
fi

# 2. 确保 Node.js 和 pnpm 已安装
if ! command -v node &> /dev/null; then
    print_info "安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get update || true
    apt-get install -y nodejs
else
    print_info "Node.js 已安装: $(node --version)"
fi

if ! command -v pnpm &> /dev/null; then
    print_info "安装 pnpm..."
    npm install -g pnpm
else
    print_info "pnpm 已安装: $(pnpm --version)"
fi

# 3. 安装 Nginx（如果未安装）
if ! command -v nginx &> /dev/null; then
    print_info "安装 Nginx..."
    apt-get update || true
    apt-get install -y nginx
    systemctl start nginx
    systemctl enable nginx
else
    print_info "Nginx 已安装"
fi

# 4. 安装项目依赖
print_info "安装项目依赖..."
cd "${REMOTE_PATH}" || {
    print_error "项目目录不存在: ${REMOTE_PATH}"
    print_error "请先解压项目文件到 ${REMOTE_PATH}"
    exit 1
}

pnpm install --no-frozen-lockfile || pnpm install

# 5. 构建前端
print_info "构建前端..."
cd "${REMOTE_PATH}/packages/frontend"
pnpm build

# 6. 构建后端
print_info "构建后端..."
cd "${REMOTE_PATH}/packages/websocket-server"
pnpm install
pnpm build

# 7. 停止旧服务（如果存在）
print_info "停止旧服务..."
if [ -f /var/run/websocket-server.pid ]; then
    OLD_PID=$(cat /var/run/websocket-server.pid)
    if ps -p $OLD_PID > /dev/null 2>&1; then
        kill $OLD_PID 2>/dev/null || true
        sleep 2
        kill -9 $OLD_PID 2>/dev/null || true
    fi
    rm -f /var/run/websocket-server.pid
fi

# 停止 Docker 容器（如果存在）
docker stop websocket-server 2>/dev/null || true
docker rm websocket-server 2>/dev/null || true

# 8. 启动 WebSocket 服务（使用 Node.js）
print_info "启动 WebSocket 服务（Node.js）..."
cd "${REMOTE_PATH}/packages/websocket-server"

# 设置环境变量
export NODE_ENV=production
export PORT=3002

# 启动服务
nohup pnpm start:prod > /var/log/websocket-server.log 2>&1 &
NEW_PID=$!
echo $NEW_PID > /var/run/websocket-server.pid

print_info "WebSocket 服务已启动（PID: $NEW_PID）"
print_info "日志文件: /var/log/websocket-server.log"

# 等待服务启动
sleep 5

# 9. 检查服务是否运行
if ps -p $NEW_PID > /dev/null 2>&1; then
    print_info "✅ WebSocket 服务运行正常"
else
    print_error "❌ WebSocket 服务启动失败"
    print_error "请查看日志: tail -f /var/log/websocket-server.log"
    exit 1
fi

# 10. 部署前端文件
print_info "部署前端文件..."
mkdir -p /usr/share/nginx/html
cp -r "${REMOTE_PATH}/packages/frontend/dist"/* /usr/share/nginx/html/ || \
rsync -av "${REMOTE_PATH}/packages/frontend/dist/" /usr/share/nginx/html/

# 11. 配置 Nginx
print_info "配置 Nginx..."
cat > /etc/nginx/sites-available/roomkit-web << 'NGINXEOF'
# RoomKit WebSocket 应用 Nginx 配置（Node.js 模式）
upstream websocket_backend {
    server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name _;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Vue Router 配置
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # WebSocket 代理
    location /translation {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_buffering off;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://websocket_backend;
        access_log off;
    }
}
NGINXEOF

# 启用配置
ln -sf /etc/nginx/sites-available/roomkit-web /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx

# 12. 配置防火墙
print_info "配置防火墙..."
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true
ufw allow 3002/tcp 2>/dev/null || true
ufw --force enable 2>/dev/null || true

# 13. 健康检查
print_info "健康检查..."
sleep 3
if curl -f http://localhost:3002/health &> /dev/null; then
    print_info "✅ WebSocket 健康检查通过"
else
    print_warn "⚠️  WebSocket 健康检查失败，但服务可能正在启动中"
    print_warn "请稍后检查: curl http://localhost:3002/health"
fi

# 14. 显示部署信息
echo ""
print_info "✅ 部署完成！"
echo ""
echo "📋 服务状态："
echo "  - WebSocket 服务 (Node.js): PID $(cat /var/run/websocket-server.pid)"
echo "  - Nginx: $(systemctl is-active nginx 2>/dev/null && echo '运行中' || echo '未运行')"
echo ""
echo "📝 常用命令："
echo "  - 查看日志: tail -f /var/log/websocket-server.log"
echo "  - 重启服务: kill \$(cat /var/run/websocket-server.pid) && cd ${REMOTE_PATH}/packages/websocket-server && nohup pnpm start:prod > /var/log/websocket-server.log 2>&1 & echo \$! > /var/run/websocket-server.pid"
echo "  - 检查进程: ps aux | grep node"
echo "  - 健康检查: curl http://localhost:3002/health"
echo ""
SCRIPTEOF

chmod +x /opt/roomkit-web/scripts/skip-docker-deploy.sh
echo "脚本已创建: /opt/roomkit-web/scripts/skip-docker-deploy.sh"


