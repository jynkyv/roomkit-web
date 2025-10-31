#!/bin/bash

# ECS一键部署脚本
# 使用方法：
#   1. 在本地运行：./deploy-ecs.sh build
#   2. 上传文件到服务器
#   3. 在服务器上运行：./deploy-ecs.sh deploy

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/packages/frontend"
BACKEND_DIR="$SCRIPT_DIR/packages/websocket-server"
DEPLOY_ACTION=${1:-build}

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 构建前端
build_frontend() {
    print_info "开始构建前端..."
    cd "$FRONTEND_DIR"
    
    print_info "安装前端依赖..."
    pnpm install --frozen-lockfile
    
    print_info "构建前端..."
    pnpm build
    
    print_info "前端构建完成！构建产物在: $FRONTEND_DIR/dist"
}

# 构建后端Docker镜像
build_backend() {
    print_info "开始构建后端Docker镜像..."
    cd "$BACKEND_DIR"
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    print_info "构建Docker镜像..."
    docker build -t websocket-server:latest .
    
    print_info "保存Docker镜像..."
    docker save websocket-server:latest | gzip > "$SCRIPT_DIR/websocket-server.tar.gz"
    
    print_info "后端构建完成！Docker镜像已保存到: $SCRIPT_DIR/websocket-server.tar.gz"
}

# 部署前端
deploy_frontend() {
    print_info "部署前端..."
    
    FRONTEND_DIST="$FRONTEND_DIR/dist"
    if [ ! -d "$FRONTEND_DIST" ]; then
        print_error "前端构建产物不存在，请先运行: ./deploy-ecs.sh build"
        exit 1
    fi
    
    print_info "前端文件准备完成，请手动执行以下步骤："
    echo ""
    echo "1. 上传前端文件到服务器："
    echo "   scp -r $FRONTEND_DIST/* root@your-server-ip:/usr/share/nginx/html/"
    echo ""
    echo "2. 或者在服务器上克隆代码后构建："
    echo "   git clone your-repo-url"
    echo "   cd roomkit-web"
    echo "   ./deploy-ecs.sh build"
    echo "   ./deploy-ecs.sh deploy"
}

# 部署后端
deploy_backend() {
    print_info "部署后端..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    # 检查Docker Compose
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        print_info "使用Docker Compose部署..."
        cd "$BACKEND_DIR"
        
        # 加载Docker镜像（如果存在）
        if [ -f "$SCRIPT_DIR/websocket-server.tar.gz" ]; then
            print_info "加载Docker镜像..."
            docker load < "$SCRIPT_DIR/websocket-server.tar.gz"
        fi
        
        # 使用docker-compose启动
        if docker compose version &> /dev/null; then
            docker compose -f docker-compose.prod.yml up -d
        else
            docker-compose -f docker-compose.prod.yml up -d
        fi
        
        print_info "后端部署完成！"
    else
        print_warn "Docker Compose未安装，使用Docker直接运行..."
        
        # 停止旧容器
        if [ "$(docker ps -q -f name=websocket-server)" ]; then
            print_info "停止旧容器..."
            docker stop websocket-server || true
            docker rm websocket-server || true
        fi
        
        # 加载Docker镜像（如果存在）
        if [ -f "$SCRIPT_DIR/websocket-server.tar.gz" ]; then
            print_info "加载Docker镜像..."
            docker load < "$SCRIPT_DIR/websocket-server.tar.gz"
        else
            print_info "构建Docker镜像..."
            cd "$BACKEND_DIR"
            docker build -t websocket-server:latest .
        fi
        
        # 运行容器
        print_info "启动容器..."
        docker run -d \
            --name websocket-server \
            --restart unless-stopped \
            -p 8080:8080 \
            -e NODE_ENV=production \
            -e PORT=8080 \
            -e CORS_ORIGIN="*" \
            websocket-server:latest
        
        print_info "后端部署完成！"
    fi
    
    # 检查容器状态
    sleep 2
    if [ "$(docker ps -q -f name=websocket-server)" ]; then
        print_info "容器运行中，检查健康状态..."
        sleep 3
        if curl -f http://localhost:8080/health &> /dev/null; then
            print_info "后端服务健康检查通过！"
        else
            print_warn "后端服务可能还在启动中，请稍后检查: curl http://localhost:8080/health"
        fi
    else
        print_error "容器启动失败，查看日志: docker logs websocket-server"
        exit 1
    fi
}

# 主流程
case $DEPLOY_ACTION in
    build)
        print_info "🚀 开始构建..."
        build_frontend
        echo ""
        build_backend
        echo ""
        print_info "🎉 构建完成！"
        echo ""
        echo "📦 构建产物："
        echo "  - 前端: $FRONTEND_DIR/dist"
        echo "  - 后端: $SCRIPT_DIR/websocket-server.tar.gz"
        echo ""
        echo "📤 下一步：将文件上传到服务器并运行部署"
        ;;
    deploy)
        print_info "🚀 开始部署..."
        deploy_frontend
        echo ""
        deploy_backend
        echo ""
        print_info "🎉 部署完成！"
        echo ""
        echo "📋 后续步骤："
        echo "  1. 配置Nginx（参考 nginx-full.conf.example）"
        echo "  2. 配置SSL证书（可选）"
        echo "  3. 检查服务状态"
        ;;
    build-frontend)
        build_frontend
        ;;
    build-backend)
        build_backend
        ;;
    deploy-frontend)
        deploy_frontend
        ;;
    deploy-backend)
        deploy_backend
        ;;
    *)
        print_error "无效的操作: $DEPLOY_ACTION"
        echo ""
        echo "使用方法:"
        echo "  构建:     ./deploy-ecs.sh build"
        echo "  部署:     ./deploy-ecs.sh deploy"
        echo "  仅前端:   ./deploy-ecs.sh build-frontend"
        echo "  仅后端:   ./deploy-ecs.sh build-backend"
        exit 1
        ;;
esac

