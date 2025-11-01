#!/bin/bash

# RoomKit WebSocket 应用自动部署脚本（ECS）
# 使用方法: ./deploy-to-ecs.sh <ECS_IP_ADDRESS>
# 示例: ./deploy-to-ecs.sh 47.111.225.130

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查参数
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ 错误: 缺少 ECS IP 地址参数${NC}"
    echo -e "${YELLOW}使用方法: $0 <ECS_IP_ADDRESS>${NC}"
    exit 1
fi

ECS_IP=$1
PROJECT_NAME="roomkit-web"
REMOTE_PATH="/opt/$PROJECT_NAME"

echo -e "${BLUE}🚀 开始部署 RoomKit WebSocket 应用到 ECS: ${ECS_IP}${NC}"
echo ""

# 步骤 1: 检查本地环境
echo -e "${YELLOW}📋 步骤 1/8: 检查本地环境...${NC}"
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录执行此脚本${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 本地环境检查通过${NC}"
echo ""

# 步骤 2: 测试 SSH 连接
echo -e "${YELLOW}📋 步骤 2/8: 测试 SSH 连接...${NC}"
SSH_KEY=""
if [ -f ~/.ssh/id_ed25519 ]; then
    SSH_KEY="-i ~/.ssh/id_ed25519"
elif [ -f ~/.ssh/id_rsa ]; then
    SSH_KEY="-i ~/.ssh/id_rsa"
fi

if [ -n "$SSH_KEY" ]; then
    if ssh $SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@${ECS_IP} "echo 'test'" 2>/dev/null; then
        echo -e "${GREEN}✅ SSH 连接成功${NC}"
    else
        echo -e "${YELLOW}⚠️  SSH 测试失败，但将继续部署${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  未找到SSH密钥，将使用密码认证${NC}"
fi
echo ""

# 步骤 3: 创建部署包
echo -e "${YELLOW}📋 步骤 3/8: 创建部署包...${NC}"
TAR_FILE="${PROJECT_NAME}-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"
rm -f ${PROJECT_NAME}-deploy-*.tar.gz

tar --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='packages/*/node_modules' \
    --exclude='packages/*/dist' \
    --exclude='*.tar.gz' \
    --exclude='.DS_Store' \
    --exclude='logs' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.production' \
    --exclude='.vscode' \
    --exclude='coverage' \
    -czf ${TAR_FILE} . 2>/dev/null

FILE_SIZE=$(du -h ${TAR_FILE} | cut -f1)
echo -e "${GREEN}✅ 部署包创建成功: ${TAR_FILE} (${FILE_SIZE})${NC}"
echo ""

# 步骤 4: 上传到 ECS
echo -e "${YELLOW}📋 步骤 4/8: 上传代码到 ECS...${NC}"
if [ -n "$SSH_KEY" ]; then
    scp $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=30 ${TAR_FILE} root@${ECS_IP}:/tmp/
else
    scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 ${TAR_FILE} root@${ECS_IP}:/tmp/
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 上传成功${NC}"
else
    echo -e "${RED}❌ 上传失败${NC}"
    exit 1
fi
echo ""

# 步骤 5: 在 ECS 上执行部署
echo -e "${YELLOW}📋 步骤 5/8: 在 ECS 上执行部署...${NC}"

SSH_CMD="ssh"
if [ -n "$SSH_KEY" ]; then
    SSH_CMD="ssh $SSH_KEY"
fi

$SSH_CMD -o StrictHostKeyChecking=no root@${ECS_IP} << EOF
set -e

REMOTE_PATH="${REMOTE_PATH}"
TAR_FILE="${TAR_FILE}"

echo "📥 解压项目文件..."
mkdir -p \${REMOTE_PATH}
cd \${REMOTE_PATH}

# 备份旧文件（如果有）
if [ -d "packages/frontend/dist" ]; then
    mkdir -p backup
    mv packages/frontend/dist backup/dist.\$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
fi

tar -xzf /tmp/\${TAR_FILE}
rm /tmp/\${TAR_FILE}

# 检查并安装 Node.js（如果未安装）
if ! command -v node &> /dev/null; then
    echo "📦 安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get update || true
    apt-get install -y nodejs
fi

echo "✅ Node.js 版本: \$(node --version)"

# 检查并安装 pnpm（如果未安装）
if ! command -v pnpm &> /dev/null; then
    echo "📦 安装 pnpm..."
    npm install -g pnpm
fi

echo "✅ pnpm 版本: \$(pnpm --version)"

# 检查并安装 Docker（如果未安装）
if ! command -v docker &> /dev/null; then
    echo "📦 安装 Docker..."
    DOCKER_INSTALLED=false
    
    # 方法1: 尝试使用阿里云镜像源安装（国内更稳定）
    echo "🔄 方法1: 使用阿里云镜像源安装 Docker..."
    timeout 600 bash -c '
        # 配置阿里云 Docker 镜像源
        curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | apt-key add - 2>/dev/null || true
        add-apt-repository "deb [arch=amd64] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable" 2>/dev/null || true
        
        # 更新包列表（带超时）
        timeout 300 apt-get update 2>&1 || echo "⚠️  apt-get update 超时或失败"
        
        # 安装 Docker（带超时）
        timeout 600 apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>&1
    ' && DOCKER_INSTALLED=true || echo "⚠️  方法1 失败或超时"
    
    # 方法2: 如果方法1失败，尝试官方脚本（带超时）
    if [ "\$DOCKER_INSTALLED" = "false" ]; then
        echo "🔄 方法2: 尝试使用官方安装脚本..."
        timeout 600 bash -c 'curl -fsSL https://get.docker.com | bash' && DOCKER_INSTALLED=true || echo "⚠️  方法2 失败或超时"
    fi
    
    # 启动 Docker（如果安装成功）
    if [ "\$DOCKER_INSTALLED" = "true" ]; then
        systemctl start docker 2>/dev/null || service docker start
        systemctl enable docker 2>/dev/null || true
        
        # 验证安装
        if command -v docker &> /dev/null && docker --version &>/dev/null; then
            echo "✅ Docker 安装成功"
            echo "✅ Docker 版本: \$(docker --version)"
        else
            echo "⚠️  Docker 安装验证失败，将使用 Node.js 直接运行"
            DOCKER_INSTALLED=false
        fi
    else
        echo "⚠️  Docker 安装失败（网络问题或超时），将使用 Node.js 直接运行"
        echo "💡 提示: 可以稍后手动安装 Docker: curl -fsSL https://get.docker.com | bash"
    fi
else
    echo "✅ Docker 已安装: \$(docker --version)"
    # 确保 Docker 服务运行
    if ! systemctl is-active --quiet docker 2>/dev/null; then
        systemctl start docker 2>/dev/null || service docker start
    fi
fi

# 检查并安装 Docker Compose
if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "📦 安装 Docker Compose..."
    DOCKER_COMPOSE_VERSION=\$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/\${DOCKER_COMPOSE_VERSION}/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# 检查并安装 Nginx（如果未安装）
if ! command -v nginx &> /dev/null; then
    echo "📦 安装 Nginx..."
    apt-get update || true
    apt-get install -y nginx
    systemctl start nginx
    systemctl enable nginx
fi

# 配置防火墙
echo "🔥 配置防火墙..."
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true
ufw --force enable 2>/dev/null || true

# 创建部署目录
mkdir -p /usr/share/nginx/html
mkdir -p \${REMOTE_PATH}

# 安装项目依赖
echo "📦 安装项目依赖..."
cd \${REMOTE_PATH}
pnpm install --no-frozen-lockfile || pnpm install

# 构建前端
echo "🏗️ 构建前端..."
cd packages/frontend
pnpm build

# 构建后端 Docker 镜像（如果Docker可用）
if command -v docker &> /dev/null && systemctl is-active --quiet docker 2>/dev/null; then
    echo "🐳 构建后端 Docker 镜像..."
    cd \${REMOTE_PATH}/packages/websocket-server
    docker build -t websocket-server:latest . || echo "⚠️  Docker 构建可能需要更多时间或失败"
else
    echo "⚠️  Docker 未安装或未运行，跳过 Docker 镜像构建"
    echo "💡 可以稍后手动构建: cd packages/websocket-server && docker build -t websocket-server:latest ."
fi

# 启动 WebSocket 服务（如果Docker可用）
if command -v docker &> /dev/null && systemctl is-active --quiet docker 2>/dev/null; then
    # 停止旧容器（如果存在）
    echo "🛑 停止旧服务..."
    docker stop websocket-server 2>/dev/null || true
    docker rm websocket-server 2>/dev/null || true
    
    # 启动 WebSocket 服务
    echo "🚀 启动 WebSocket 服务..."
    cd \${REMOTE_PATH}/packages/websocket-server
    
    # 检查镜像是否存在
    if ! docker images | grep -q websocket-server; then
        echo "⚠️  Docker 镜像不存在，尝试构建..."
        docker build -t websocket-server:latest . || {
            echo "❌ Docker 镜像构建失败，使用备用方案..."
            # 备用方案：使用 Node.js 直接运行
            echo "📦 安装依赖并直接运行 NestJS 服务..."
            cd \${REMOTE_PATH}/packages/websocket-server
            pnpm install
            pnpm build
            nohup pnpm start:prod > /var/log/websocket-server.log 2>&1 &
            echo \$! > /var/run/websocket-server.pid
        }
    else
        # 使用 docker-compose 或直接运行
        if docker compose version &> /dev/null 2>&1; then
            docker compose -f docker-compose.prod.yml up -d || \
            docker run -d \
                --name websocket-server \
                --restart unless-stopped \
                -p 8080:8080 \
                -e NODE_ENV=production \
                -e PORT=8080 \
                -e CORS_ORIGIN="*" \
                websocket-server:latest
        else
            docker run -d \
                --name websocket-server \
                --restart unless-stopped \
                -p 8080:8080 \
                -e NODE_ENV=production \
                -e PORT=8080 \
                -e CORS_ORIGIN="*" \
                websocket-server:latest
        fi
    fi
else
    echo "⚠️  Docker 不可用，使用 Node.js 直接运行..."
    cd \${REMOTE_PATH}/packages/websocket-server
    pnpm install
    pnpm build
    
    # 停止旧进程
    if [ -f /var/run/websocket-server.pid ]; then
        kill \$(cat /var/run/websocket-server.pid) 2>/dev/null || true
    fi
    
    # 启动服务
    nohup pnpm start:prod > /var/log/websocket-server.log 2>&1 &
    echo \$! > /var/run/websocket-server.pid
    echo "✅ WebSocket 服务已启动（PID: \$(cat /var/run/websocket-server.pid)）"
fi

# 部署前端文件
echo "📤 部署前端文件..."
cp -r \${REMOTE_PATH}/packages/frontend/dist/* /usr/share/nginx/html/ || \
rsync -av \${REMOTE_PATH}/packages/frontend/dist/ /usr/share/nginx/html/

# 配置 Nginx（如果还没有配置）
if [ ! -f /etc/nginx/sites-available/roomkit-web ]; then
    echo "⚙️ 配置 Nginx..."
    cat > /etc/nginx/sites-available/roomkit-web << 'NGINXEOF'
# RoomKit WebSocket 应用 Nginx 配置
upstream websocket_backend {
    server 127.0.0.1:8080;
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
    
    # 启用配置
    ln -sf /etc/nginx/sites-available/roomkit-web /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # 测试配置
    nginx -t
    
    # 重载 Nginx
    systemctl reload nginx
else
    echo "✅ Nginx 配置已存在，跳过配置"
    systemctl reload nginx
fi

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo "🔍 检查服务状态..."
if command -v docker &> /dev/null && docker ps 2>/dev/null | grep -q websocket-server; then
    echo "✅ WebSocket 服务运行中（Docker）"
elif [ -f /var/run/websocket-server.pid ] && ps -p \$(cat /var/run/websocket-server.pid) > /dev/null 2>&1; then
    echo "✅ WebSocket 服务运行中（Node.js 进程）"
else
    echo "⚠️  WebSocket 服务可能未启动"
    if command -v docker &> /dev/null; then
        echo "   检查 Docker: docker logs websocket-server"
    else
        echo "   检查日志: tail -f /var/log/websocket-server.log"
    fi
fi

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx 服务运行中"
else
    echo "⚠️  Nginx 服务未运行，请检查: systemctl status nginx"
fi

# 健康检查
echo "🏥 健康检查..."
sleep 3
if curl -f http://localhost:8080/health &> /dev/null; then
    echo "✅ WebSocket 健康检查通过"
else
    echo "⚠️  WebSocket 健康检查失败，请检查: curl http://localhost:8080/health"
fi

echo ""
echo "✅ 部署完成！"
echo "📋 服务状态："
if command -v docker &> /dev/null; then
    docker ps | grep websocket-server || echo "⚠️  WebSocket 容器未运行"
else
    if [ -f /var/run/websocket-server.pid ]; then
        echo "✅ WebSocket 进程运行中 (PID: \$(cat /var/run/websocket-server.pid))"
    else
        echo "⚠️  WebSocket 进程未运行"
    fi
fi
systemctl status nginx --no-pager -l | head -5 || true
echo ""
echo "🌐 应用地址: http://${ECS_IP}"
echo "🔍 健康检查: http://${ECS_IP}/health"
echo ""
echo "💡 如果 Docker 安装失败，可以稍后手动安装："
echo "   curl -fsSL https://get.docker.com | bash"
echo "   或使用国内镜像："
echo "   curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | apt-key add -"
echo ""
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ ECS 部署成功${NC}"
else
    echo -e "${RED}❌ ECS 部署失败${NC}"
    exit 1
fi
echo ""

# 步骤 6: 清理本地文件
echo -e "${YELLOW}📋 步骤 6/8: 清理本地临时文件...${NC}"
rm -f ${TAR_FILE}
echo -e "${GREEN}✅ 清理完成${NC}"
echo ""

# 步骤 7: 验证部署
echo -e "${YELLOW}📋 步骤 7/8: 验证部署...${NC}"
sleep 3
if curl -f http://${ECS_IP}/health &> /dev/null; then
    echo -e "${GREEN}✅ 健康检查通过${NC}"
else
    echo -e "${YELLOW}⚠️  健康检查失败，但部署已完成${NC}"
fi
echo ""

# 步骤 8: 显示部署信息
echo -e "${GREEN}🎉 部署完成！${NC}"
echo ""
echo -e "${GREEN}📋 部署信息：${NC}"
echo -e "  🌐 前端地址: ${BLUE}http://${ECS_IP}${NC}"
echo -e "  🔍 健康检查: ${BLUE}http://${ECS_IP}/health${NC}"
echo -e "  🐳 Docker 状态: ${BLUE}docker ps${NC}"
echo -e "  📝 Nginx 状态: ${BLUE}systemctl status nginx${NC}"
echo ""
echo -e "${YELLOW}📝 后续操作：${NC}"
echo -e "  1. 检查服务: ${BLUE}ssh root@${ECS_IP} 'docker ps && systemctl status nginx'${NC}"
echo -e "  2. 查看日志: ${BLUE}ssh root@${ECS_IP} 'docker logs websocket-server'${NC}"
echo -e "  3. 配置 SSL: ${BLUE}ssh root@${ECS_IP} 'certbot --nginx -d your-domain.com'${NC}"
echo ""

