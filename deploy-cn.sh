#!/bin/bash

# 国内部署脚本
# 使用方法: ./deploy-cn.sh [frontend|backend|all]

set -e

FRONTEND_DIR="packages/frontend"
BACKEND_DIR="packages/websocket-server"
DEPLOY_TARGET=${1:-all}

echo "🚀 开始部署..."

# 部署前端
deploy_frontend() {
    echo "📦 构建前端..."
    cd $FRONTEND_DIR
    pnpm install
    pnpm build
    
    echo "✅ 前端构建完成！"
    echo "📁 构建产物在: $FRONTEND_DIR/dist"
    echo "💡 请将 dist 目录上传到以下任一服务："
    echo "   - 阿里云OSS + CDN"
    echo "   - 腾讯云COS + CDN"
    echo "   - 七牛云对象存储"
    echo ""
}

# 部署后端
deploy_backend() {
    echo "📦 构建后端..."
    cd $BACKEND_DIR
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker未安装，请先安装Docker"
        exit 1
    fi
    
    echo "🐳 构建Docker镜像..."
    docker build -t websocket-server:latest .
    
    echo "✅ 后端构建完成！"
    echo "💡 使用以下命令运行容器："
    echo "   docker run -d --name websocket-server -p 8080:8080 \\"
    echo "     -e CORS_ORIGIN=https://your-frontend-domain.com \\"
    echo "     --restart unless-stopped websocket-server:latest"
    echo ""
}

# 主流程
case $DEPLOY_TARGET in
    frontend)
        deploy_frontend
        ;;
    backend)
        deploy_backend
        ;;
    all)
        deploy_frontend
        echo ""
        deploy_backend
        ;;
    *)
        echo "❌ 无效的参数: $DEPLOY_TARGET"
        echo "使用方法: ./deploy-cn.sh [frontend|backend|all]"
        exit 1
        ;;
esac

echo "🎉 部署完成！"
echo ""
echo "📖 详细部署指南请查看: DEPLOYMENT_CN.md"

