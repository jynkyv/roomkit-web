#!/bin/bash

# 仅部署前端构建产物到 ECS（在本地或其他服务器上构建完成后使用）
# 使用方法: ./scripts/deploy-only-frontend.sh <ECS_IP_ADDRESS>
# 示例: ./scripts/deploy-only-frontend.sh 47.111.225.130

set -e

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

# 检查前端是否已构建
if [ ! -d "packages/frontend/dist" ]; then
    echo -e "${RED}❌ 错误: 前端未构建${NC}"
    echo -e "${YELLOW}请先构建前端: cd packages/frontend && pnpm build${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 开始部署前端构建产物到 ECS: ${ECS_IP}${NC}"
echo ""

# 检测 SSH 密钥
SSH_KEY=""
if [ -f ~/.ssh/id_ed25519 ]; then
    SSH_KEY="-i ~/.ssh/id_ed25519"
elif [ -f ~/.ssh/id_rsa ]; then
    SSH_KEY="-i ~/.ssh/id_rsa"
fi

# 创建临时压缩包
echo -e "${YELLOW}📦 打包前端构建产物...${NC}"
TEMP_DIR=$(mktemp -d)
cd packages/frontend
tar -czf ${TEMP_DIR}/frontend-dist.tar.gz dist/
FILE_SIZE=$(du -h ${TEMP_DIR}/frontend-dist.tar.gz | cut -f1)
echo -e "${GREEN}✅ 打包完成: ${FILE_SIZE}${NC}"
echo ""

# 上传到 ECS
echo -e "${YELLOW}📤 上传到 ECS...${NC}"
if [ -n "$SSH_KEY" ]; then
    scp $SSH_KEY -o StrictHostKeyChecking=no ${TEMP_DIR}/frontend-dist.tar.gz root@${ECS_IP}:/tmp/
else
    scp -o StrictHostKeyChecking=no ${TEMP_DIR}/frontend-dist.tar.gz root@${ECS_IP}:/tmp/
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 上传成功${NC}"
else
    echo -e "${RED}❌ 上传失败${NC}"
    rm -rf ${TEMP_DIR}
    exit 1
fi
echo ""

# 在 ECS 上部署
echo -e "${YELLOW}📋 在 ECS 上部署前端文件...${NC}"

SSH_CMD="ssh"
if [ -n "$SSH_KEY" ]; then
    SSH_CMD="ssh $SSH_KEY"
fi

$SSH_CMD -o StrictHostKeyChecking=no root@${ECS_IP} << EOF
set -e

echo "📥 解压前端文件..."
mkdir -p /usr/share/nginx/html
cd /usr/share/nginx/html

# 备份旧文件（如果存在）
if [ -d "index.html" ] || [ -f "index.html" ]; then
    mkdir -p /tmp/frontend-backup
    mv * /tmp/frontend-backup/ 2>/dev/null || true
fi

# 解压新文件
tar -xzf /tmp/frontend-dist.tar.gz
mv dist/* . 2>/dev/null || cp -r dist/* . 2>/dev/null || true
rm -rf dist
rm /tmp/frontend-dist.tar.gz

# 设置正确的权限
chown -R www-data:www-data /usr/share/nginx/html 2>/dev/null || chown -R nginx:nginx /usr/share/nginx/html 2>/dev/null || true

echo "✅ 前端文件已部署"

# 重载 Nginx
if systemctl is-active --quiet nginx; then
    systemctl reload nginx
    echo "✅ Nginx 已重载"
else
    systemctl start nginx
    echo "✅ Nginx 已启动"
fi

EOF

# 清理临时文件
rm -rf ${TEMP_DIR}

echo ""
echo -e "${GREEN}🎉 前端部署完成！${NC}"
echo ""
echo -e "${GREEN}📋 部署信息：${NC}"
echo -e "  🌐 前端地址: ${BLUE}http://${ECS_IP}${NC}"
echo ""


