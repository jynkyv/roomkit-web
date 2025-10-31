#!/bin/bash

# ECS服务器初始化脚本
# 在服务器上运行此脚本来安装必要的工具和环境
#
# 支持的操作系统：
# - Ubuntu 20.04+ / Debian 11+ (推荐)
# - CentOS 7+ / RHEL 7+ / Rocky Linux
# - AlmaLinux / Fedora (部分支持)
#
# 使用方法：
#   sudo ./scripts/server-init.sh

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

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    print_error "请使用root用户运行此脚本: sudo $0"
    exit 1
fi

print_info "开始初始化服务器环境..."

# 更新系统
print_info "更新系统包..."
if command -v apt-get &> /dev/null; then
    apt-get update
    apt-get upgrade -y
elif command -v yum &> /dev/null; then
    yum update -y
else
    print_warn "未检测到支持的包管理器，跳过系统更新"
fi

# 安装必要工具
print_info "安装必要工具..."
if command -v apt-get &> /dev/null; then
    apt-get install -y curl wget git build-essential
elif command -v yum &> /dev/null; then
    yum install -y curl wget git gcc gcc-c++ make
fi

# 安装Node.js和pnpm（如果没有）
if ! command -v node &> /dev/null; then
    print_info "安装Node.js..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - || \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    
    if command -v apt-get &> /dev/null; then
        apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        yum install -y nodejs
    fi
else
    print_info "Node.js已安装: $(node --version)"
fi

if ! command -v pnpm &> /dev/null; then
    print_info "安装pnpm..."
    npm install -g pnpm
else
    print_info "pnpm已安装: $(pnpm --version)"
fi

# 安装Docker
if ! command -v docker &> /dev/null; then
    print_info "安装Docker..."
    curl -fsSL https://get.docker.com | bash
    systemctl start docker
    systemctl enable docker
    print_info "Docker已安装: $(docker --version)"
else
    print_info "Docker已安装: $(docker --version)"
fi

# 安装Docker Compose
if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    print_info "安装Docker Compose..."
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_info "Docker Compose已安装"
else
    print_info "Docker Compose已安装"
fi

# 安装Nginx
if ! command -v nginx &> /dev/null; then
    print_info "安装Nginx..."
    if command -v apt-get &> /dev/null; then
        apt-get install -y nginx
    elif command -v yum &> /dev/null; then
        yum install -y nginx
    fi
    systemctl start nginx
    systemctl enable nginx
    print_info "Nginx已安装"
else
    print_info "Nginx已安装: $(nginx -v 2>&1)"
fi

# 配置防火墙
print_info "配置防火墙..."
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
elif command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 8080/tcp
    ufw --force enable
elif command -v iptables &> /dev/null; then
    iptables -A INPUT -p tcp --dport 80 -j ACCEPT
    iptables -A INPUT -p tcp --dport 443 -j ACCEPT
    iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
fi

# 创建部署目录
print_info "创建部署目录..."
mkdir -p /usr/share/nginx/html
mkdir -p /opt/roomkit-web

print_info "✅ 服务器初始化完成！"
echo ""
echo "📋 已安装的工具："
echo "  - Node.js: $(node --version 2>/dev/null || echo '未安装')"
echo "  - pnpm: $(pnpm --version 2>/dev/null || echo '未安装')"
echo "  - Docker: $(docker --version 2>/dev/null || echo '未安装')"
echo "  - Nginx: $(nginx -v 2>&1 | head -1 2>/dev/null || echo '未安装')"
echo ""
echo "🚀 下一步："
echo "  1. 上传项目代码到服务器"
echo "  2. 运行 ./deploy-ecs.sh build 构建项目"
echo "  3. 运行 ./deploy-ecs.sh deploy 部署服务"

