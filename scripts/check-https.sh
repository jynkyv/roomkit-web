#!/bin/bash

# HTTPS 配置诊断脚本
# 使用方法: ./scripts/check-https.sh <ECS_IP> <DOMAIN> [SSH_PORT]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ $# -lt 2 ]; then
    echo -e "${RED}❌ 错误: 缺少参数${NC}"
    echo -e "${YELLOW}使用方法: $0 <ECS_IP> <DOMAIN> [SSH_PORT]${NC}"
    exit 1
fi

ECS_IP=$1
DOMAIN=$2
SSH_PORT=${3:-22}
SSH_OPTIONS="-o StrictHostKeyChecking=no -o ConnectTimeout=30 -p ${SSH_PORT}"

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

echo -e "${BLUE}🔍 检查 HTTPS 配置...${NC}"
echo ""

$SSH_CMD root@${ECS_IP} << EOF
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 检查 Nginx 状态"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
systemctl status nginx --no-pager | head -5 || echo "Nginx 未运行"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. 检查 443 端口是否监听"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
netstat -tlnp | grep :443 || ss -tlnp | grep :443 || echo "❌ 443 端口未监听"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. 检查防火墙规则"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ufw status | grep -E "443|Status" || echo "无法获取防火墙状态"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. 检查 Nginx 配置语法"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
nginx -t
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. 检查 SSL 证书"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]; then
    echo "✅ 证书文件存在"
    ls -lh /etc/letsencrypt/live/${DOMAIN}/
    echo ""
    echo "证书信息:"
    openssl x509 -in /etc/letsencrypt/live/${DOMAIN}/fullchain.pem -noout -dates 2>/dev/null || echo "无法读取证书"
else
    echo "❌ 证书文件不存在"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. 检查 Nginx 配置中的 server_name"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep -A 5 "server_name" /etc/nginx/sites-available/roomkit-web | head -10 || echo "无法读取配置"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. 测试本地 HTTPS 连接"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -k -I https://localhost 2>&1 | head -5 || echo "无法连接本地 HTTPS"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8. 查看最近的 Nginx 错误日志"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -n 20 /var/log/nginx/error.log 2>/dev/null || echo "无法读取错误日志"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "9. 检查 Nginx 进程"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ps aux | grep nginx | grep -v grep || echo "Nginx 进程未运行"
echo ""

EOF

echo -e "${GREEN}✅ 诊断完成${NC}"
echo ""
echo -e "${YELLOW}如果发现问题，请根据上述输出进行修复${NC}"


