#!/bin/bash

# RoomKit HTTPS 配置脚本
# 使用 Let's Encrypt 免费 SSL 证书
# 使用方法: ./scripts/setup-https.sh <ECS_IP> <DOMAIN>
# 示例: ./scripts/setup-https.sh 47.111.225.130 example.com

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查参数
if [ $# -lt 2 ]; then
    echo -e "${RED}❌ 错误: 缺少参数${NC}"
    echo -e "${YELLOW}使用方法: $0 <ECS_IP> <DOMAIN> [SSH_PORT]${NC}"
    echo -e "${YELLOW}示例: $0 47.111.225.130 example.com${NC}"
    echo -e "${YELLOW}示例: $0 47.111.225.130 example.com 22${NC}"
    echo ""
    echo -e "${BLUE}📋 前提条件：${NC}"
    echo -e "  1. 域名已解析到服务器 IP（A 记录）"
    echo -e "  2. 服务器已开放 80 和 443 端口"
    echo -e "  3. Nginx 已安装并运行"
    exit 1
fi

ECS_IP=$1
DOMAIN=$2
SSH_PORT=${3:-22}
SSH_OPTIONS="-o StrictHostKeyChecking=no -o ConnectTimeout=30 -p ${SSH_PORT}"

echo -e "${BLUE}🔒 开始配置 HTTPS for ${DOMAIN}${NC}"
echo ""

# 检测 SSH 密钥
SSH_KEY=""
if [ -f ~/.ssh/id_ed25519 ]; then
    SSH_KEY="-i ~/.ssh/id_ed25519"
elif [ -f ~/.ssh/id_rsa ]; then
    SSH_KEY="-i ~/.ssh/id_rsa"
fi

if [ -n "$SSH_KEY" ]; then
    SSH_CMD="ssh $SSH_KEY $SSH_OPTIONS"
else
    SSH_CMD="ssh $SSH_OPTIONS"
fi

echo -e "${YELLOW}📋 步骤 1/4: 验证域名解析...${NC}"
if ping -c 1 ${DOMAIN} &>/dev/null; then
    RESOLVED_IP=$(dig +short ${DOMAIN} | tail -n1)
    if [ "$RESOLVED_IP" = "$ECS_IP" ]; then
        echo -e "${GREEN}✅ 域名 ${DOMAIN} 已正确解析到 ${ECS_IP}${NC}"
    else
        echo -e "${RED}❌ 域名 ${DOMAIN} 解析到 ${RESOLVED_IP}，不是 ${ECS_IP}${NC}"
        echo -e "${YELLOW}⚠️  请确保域名 A 记录指向 ${ECS_IP}${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  无法 ping 域名，但继续执行...${NC}"
fi
echo ""

echo -e "${YELLOW}📋 步骤 2/4: 在服务器上安装 Certbot...${NC}"
$SSH_CMD root@${ECS_IP} << EOF
set -e

# 更新系统包
apt-get update

# 安装 Certbot
if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot python3-certbot-nginx
    echo "✅ Certbot 已安装"
else
    echo "✅ Certbot 已存在"
fi

# 确保防火墙开放 80 和 443 端口
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true
ufw reload 2>/dev/null || true

EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Certbot 安装完成${NC}"
else
    echo -e "${RED}❌ Certbot 安装失败${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}📋 步骤 3/4: 获取 SSL 证书...${NC}"
$SSH_CMD root@${ECS_IP} << EOF
set -e

# 检查端口 80 是否被占用
if lsof -i :80 &>/dev/null || netstat -tuln | grep :80 &>/dev/null; then
    echo "⚠️  端口 80 已被占用，使用临时停止 Nginx 的方式获取证书..."
    
    # 临时停止 Nginx
    systemctl stop nginx 2>/dev/null || true
    sleep 2
    
    # 使用 standalone 模式获取证书
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email admin@${DOMAIN} \
        -d ${DOMAIN} \
        -d www.${DOMAIN} 2>/dev/null || \
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --register-unsafely-without-email \
        -d ${DOMAIN} \
        -d www.${DOMAIN} 2>/dev/null || \
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --register-unsafely-without-email \
        -d ${DOMAIN}
    
    # 重新启动 Nginx
    systemctl start nginx 2>/dev/null || true
else
    # 端口 80 未被占用，直接使用 standalone 模式
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email admin@${DOMAIN} \
        -d ${DOMAIN} \
        -d www.${DOMAIN} 2>/dev/null || \
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --register-unsafely-without-email \
        -d ${DOMAIN} \
        -d www.${DOMAIN} 2>/dev/null || \
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --register-unsafely-without-email \
        -d ${DOMAIN}
fi

if [ \$? -eq 0 ] && [ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]; then
    echo "✅ SSL 证书已获取"
    ls -la /etc/letsencrypt/live/${DOMAIN}/ || echo "证书目录不存在"
else
    echo "❌ SSL 证书获取失败"
    echo "请检查："
    echo "  1. 域名是否解析到服务器 IP"
    echo "  2. 80 端口是否可以访问"
    echo "  3. 查看详细日志: cat /var/log/letsencrypt/letsencrypt.log"
    exit 1
fi

EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ SSL 证书获取完成${NC}"
else
    echo -e "${RED}❌ SSL 证书获取失败${NC}"
    echo -e "${YELLOW}⚠️  可能的原因：${NC}"
    echo -e "  1. 域名未解析到服务器 IP"
    echo -e "  2. 80 端口未开放或无法访问"
    echo -e "  3. Let's Encrypt 服务器无法访问您的服务器"
    exit 1
fi
echo ""

echo -e "${YELLOW}📋 步骤 4/4: 配置 Nginx HTTPS...${NC}"
$SSH_CMD root@${ECS_IP} << EOF
set -e

# 配置 Nginx HTTPS
cat > /etc/nginx/sites-available/roomkit-web << 'NGINXEOF'
# RoomKit WebSocket 应用 Nginx 配置（HTTPS）
upstream websocket_backend {
    server 127.0.0.1:3002;
}

# HTTP 服务器（重定向到 HTTPS）
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    # Let's Encrypt 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # 重定向所有其他请求到 HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS 服务器
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};
    
    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    
    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # 前端根目录
    root /usr/share/nginx/html;
    index index.html;
    
    # Vue Router 配置
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # WebSocket 代理（WSS）
    location /translation {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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

# 测试 Nginx 配置
nginx -t

# 重载 Nginx
systemctl reload nginx

# 配置自动续期
if ! grep -q "certbot renew" /etc/crontab; then
    echo "0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'" >> /etc/crontab
    echo "✅ 已配置证书自动续期（每天凌晨 3 点）"
fi

echo "✅ Nginx HTTPS 配置完成"

EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ HTTPS 配置完成${NC}"
    echo ""
    echo -e "${GREEN}🎉 配置成功！${NC}"
    echo ""
    echo -e "${BLUE}📋 访问地址：${NC}"
    echo -e "  🌐 HTTPS: ${GREEN}https://${DOMAIN}${NC}"
    echo -e "  🌐 HTTP (自动重定向): ${YELLOW}http://${DOMAIN}${NC}"
    echo ""
    echo -e "${YELLOW}📝 注意事项：${NC}"
    echo -e "  1. 证书有效期 90 天，已配置自动续期"
    echo -e "  2. 查看证书状态: ${BLUE}ssh root@${ECS_IP} 'certbot certificates'${NC}"
    echo -e "  3. 手动续期: ${BLUE}ssh root@${ECS_IP} 'certbot renew'${NC}"
    echo -e "  4. 更新 WebSocket 配置: 前端需要将 WebSocket URL 改为 wss://${DOMAIN}/translation${NC}"
else
    echo -e "${RED}❌ HTTPS 配置失败${NC}"
    exit 1
fi

