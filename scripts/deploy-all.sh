#!/bin/bash

# RoomKit 一键部署脚本（前端 + 后端）
# 在本地构建前端和后端，然后部署到 ECS
# 使用方法: ./scripts/deploy-all.sh <ECS_IP_ADDRESS>
# 示例: ./scripts/deploy-all.sh 47.111.225.130

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查参数
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ 错误: 缺少 ECS IP 地址参数${NC}"
    echo -e "${YELLOW}使用方法: $0 <ECS_IP_ADDRESS> [SSH_PORT]${NC}"
    echo -e "${YELLOW}示例: $0 47.111.225.130${NC}"
    echo -e "${YELLOW}示例: $0 47.111.225.130 2222${NC}"
    exit 1
fi

ECS_IP=$1
SSH_PORT=${2:-22}  # 默认使用 22 端口，可以自定义

echo -e "${BLUE}🚀 开始一键部署 RoomKit 到 ECS: ${ECS_IP}${NC}"
echo ""

# 步骤 1: 构建前端
echo -e "${YELLOW}📋 步骤 1/6: 构建前端...${NC}"
cd packages/frontend

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}安装前端依赖...${NC}"
    pnpm install
fi

echo -e "${YELLOW}构建前端...${NC}"
pnpm build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ 前端构建失败：未找到 dist 目录${NC}"
    exit 1
fi

FRONTEND_SIZE=$(du -sh dist | cut -f1)
echo -e "${GREEN}✅ 前端构建成功: ${FRONTEND_SIZE}${NC}"
echo ""

# 步骤 2: 构建后端
echo -e "${YELLOW}📋 步骤 2/6: 构建后端...${NC}"
cd ../websocket-server

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}安装后端依赖...${NC}"
    pnpm install
fi

echo -e "${YELLOW}构建后端...${NC}"
pnpm build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ 后端构建失败：未找到 dist 目录${NC}"
    exit 1
fi

BACKEND_SIZE=$(du -sh dist | cut -f1)
echo -e "${GREEN}✅ 后端构建成功: ${BACKEND_SIZE}${NC}"
echo ""

# 步骤 3: 打包部署文件
echo -e "${YELLOW}📋 步骤 3/6: 打包部署文件...${NC}"
cd ../..

TEMP_DIR=$(mktemp -d)
DEPLOY_PACKAGE="${TEMP_DIR}/roomkit-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"

# 打包前端 dist
echo "打包前端文件..."
tar -czf ${TEMP_DIR}/frontend.tar.gz -C packages/frontend dist/

# 打包后端 dist 和必要文件
echo "打包后端文件..."
tar -czf ${TEMP_DIR}/backend.tar.gz -C packages/websocket-server \
    dist/ \
    package.json \
    pnpm-lock.yaml \
    node_modules/ 2>/dev/null || echo "注意: node_modules 已排除（将在服务器上安装）"

PACKAGE_SIZE=$(du -sh ${TEMP_DIR} | cut -f1)
echo -e "${GREEN}✅ 打包完成: ${PACKAGE_SIZE}${NC}"
echo ""

# 步骤 4: 检测 SSH 密钥
echo -e "${YELLOW}📋 步骤 4/6: 准备上传...${NC}"
SSH_KEY=""
if [ -f ~/.ssh/id_ed25519 ]; then
    SSH_KEY="-i ~/.ssh/id_ed25519"
elif [ -f ~/.ssh/id_rsa ]; then
    SSH_KEY="-i ~/.ssh/id_rsa"
fi

# 步骤 5: 上传到 ECS
echo -e "${YELLOW}📋 步骤 5/6: 上传文件到 ECS...${NC}"

# 先测试连接
echo -e "${BLUE}🔍 测试 SSH 连接（端口 ${SSH_PORT}）...${NC}"
if nc -zv -w 5 ${ECS_IP} ${SSH_PORT} &>/dev/null; then
    echo -e "${GREEN}✅ 端口 ${SSH_PORT} 可连接${NC}"
else
    echo -e "${RED}❌ 端口 ${SSH_PORT} 无法连接${NC}"
    echo -e "${YELLOW}⚠️  请检查：${NC}"
    echo -e "   1. ECS 安全组是否开放端口 ${SSH_PORT}"
    echo -e "   2. 服务器防火墙是否允许端口 ${SSH_PORT}"
    echo -e "   3. SSH 服务是否运行：ssh root@${ECS_IP} 'systemctl status sshd'"
    echo -e "   4. 尝试其他端口：$0 ${ECS_IP} <其他端口号>"
    exit 1
fi

SCP_OPTIONS="-o StrictHostKeyChecking=no -o ConnectTimeout=30 -P ${SSH_PORT}"
SSH_OPTIONS="-o StrictHostKeyChecking=no -o ConnectTimeout=30 -p ${SSH_PORT}"

if [ -n "$SSH_KEY" ]; then
    echo "上传前端文件..."
    scp $SSH_KEY $SCP_OPTIONS ${TEMP_DIR}/frontend.tar.gz root@${ECS_IP}:/tmp/
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}⚠️  SSH密钥认证失败，尝试使用密码认证（请手动输入密码：130DF54）${NC}"
        scp $SCP_OPTIONS ${TEMP_DIR}/frontend.tar.gz root@${ECS_IP}:/tmp/
    fi
    echo "上传后端文件..."
    scp $SSH_KEY $SCP_OPTIONS ${TEMP_DIR}/backend.tar.gz root@${ECS_IP}:/tmp/
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}⚠️  SSH密钥认证失败，尝试使用密码认证（请手动输入密码：130DF54）${NC}"
        scp $SCP_OPTIONS ${TEMP_DIR}/backend.tar.gz root@${ECS_IP}:/tmp/
    fi
else
    echo "上传前端文件（需要输入密码：130DF54）..."
    scp $SCP_OPTIONS ${TEMP_DIR}/frontend.tar.gz root@${ECS_IP}:/tmp/
    echo "上传后端文件（需要输入密码：130DF54）..."
    scp $SCP_OPTIONS ${TEMP_DIR}/backend.tar.gz root@${ECS_IP}:/tmp/
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 上传成功${NC}"
else
    echo -e "${RED}❌ 上传失败${NC}"
    rm -rf ${TEMP_DIR}
    exit 1
fi
echo ""

# 步骤 6: 在 ECS 上部署
echo -e "${YELLOW}📋 步骤 6/6: 在 ECS 上部署...${NC}"

if [ -n "$SSH_KEY" ]; then
    SSH_CMD="ssh $SSH_KEY $SSH_OPTIONS"
else
    SSH_CMD="ssh $SSH_OPTIONS"
fi

$SSH_CMD root@${ECS_IP} << EOF
set -e

echo "📥 解压前端文件..."
mkdir -p /usr/share/nginx/html
cd /usr/share/nginx/html
rm -rf *
tar -xzf /tmp/frontend.tar.gz
mv dist/* . 2>/dev/null || cp -r dist/* . 2>/dev/null || true
rm -rf dist
chown -R www-data:www-data /usr/share/nginx/html 2>/dev/null || chown -R nginx:nginx /usr/share/nginx/html 2>/dev/null || true
echo "✅ 前端文件已部署"

echo "📥 解压后端文件..."
mkdir -p /opt/roomkit-web/packages/websocket-server
cd /opt/roomkit-web/packages/websocket-server
tar -xzf /tmp/backend.tar.gz
rm /tmp/frontend.tar.gz /tmp/backend.tar.gz
echo "✅ 后端文件已解压"

echo "📦 安装后端依赖..."
if ! command -v node &> /dev/null; then
    echo "安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get update || true
    apt-get install -y nodejs
fi

if ! command -v pnpm &> /dev/null; then
    echo "安装 pnpm..."
    npm install -g pnpm
fi

cd /opt/roomkit-web/packages/websocket-server
CI=true pnpm install --production --no-frozen-lockfile || CI=true pnpm install --production
echo "✅ 后端依赖已安装"

echo "🛑 停止旧服务..."
if [ -f /var/run/websocket-server.pid ]; then
    OLD_PID=\$(cat /var/run/websocket-server.pid)
    if ps -p \$OLD_PID > /dev/null 2>&1; then
        kill \$OLD_PID 2>/dev/null || true
        sleep 2
        kill -9 \$OLD_PID 2>/dev/null || true
    fi
    rm -f /var/run/websocket-server.pid
fi

docker stop websocket-server 2>/dev/null || true
docker rm websocket-server 2>/dev/null || true

echo "🚀 启动 WebSocket 服务..."
cd /opt/roomkit-web/packages/websocket-server
export NODE_ENV=production
export PORT=3002
nohup pnpm start:prod > /var/log/websocket-server.log 2>&1 &
NEW_PID=\$!
echo \$NEW_PID > /var/run/websocket-server.pid
echo "✅ WebSocket 服务已启动 (PID: \$NEW_PID)"

sleep 3

if ps -p \$NEW_PID > /dev/null 2>&1; then
    echo "✅ WebSocket 服务运行正常"
else
    echo "⚠️  WebSocket 服务可能未启动，请查看日志: tail -f /var/log/websocket-server.log"
fi

echo "⚙️ 配置 Nginx..."
cat > /etc/nginx/sites-available/roomkit-web << 'NGINXEOF'
# RoomKit WebSocket 应用 Nginx 配置
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
        try_files \$uri \$uri/ /index.html;
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
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
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

ln -sf /etc/nginx/sites-available/roomkit-web /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx
echo "✅ Nginx 已配置并重载"

echo "🔥 配置防火墙..."
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true
ufw allow 3002/tcp 2>/dev/null || true
ufw --force enable 2>/dev/null || true

echo ""
echo "🏥 健康检查..."
sleep 3
if curl -f http://localhost:3002/health &> /dev/null; then
    echo "✅ WebSocket 健康检查通过"
else
    echo "⚠️  WebSocket 健康检查失败，请检查服务"
fi

EOF

# 清理临时文件
rm -rf ${TEMP_DIR}

echo ""
echo -e "${GREEN}🎉 部署完成！${NC}"
echo ""
echo -e "${GREEN}📋 部署信息：${NC}"
echo -e "  🌐 前端地址: ${BLUE}http://${ECS_IP}${NC}"
echo -e "  🔍 健康检查: ${BLUE}http://${ECS_IP}/health${NC}"
echo ""
echo -e "${YELLOW}📝 后续操作：${NC}"
echo -e "  - 查看 WebSocket 服务日志: ${BLUE}ssh root@${ECS_IP} 'tail -f /var/log/websocket-server.log'${NC}"
echo -e "  - 重启 WebSocket 服务: ${BLUE}ssh root@${ECS_IP} 'kill \$(cat /var/run/websocket-server.pid) && cd /opt/roomkit-web/packages/websocket-server && nohup pnpm start:prod > /var/log/websocket-server.log 2>&1 & echo \$! > /var/run/websocket-server.pid'${NC}"
echo ""

