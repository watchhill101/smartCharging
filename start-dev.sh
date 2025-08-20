#!/bin/bash

# 智能充电项目开发环境启动脚本

echo "🚀 启动智能充电项目开发环境..."

# 检查端口是否被占用
check_port() {
    local port=$1
    if netstat -tuln | grep ":$port " > /dev/null; then
        echo "⚠️  端口 $port 已被占用"
        return 1
    fi
    return 0
}

# 启动后端服务
start_backend() {
    echo "📡 启动后端服务 (端口 8080)..."
    cd backEnd
    
    # 检查环境变量文件
    if [ ! -f ".env" ]; then
        echo "⚠️  未找到.env文件，正在创建开发环境配置..."
        cat > .env << 'EOF'
NODE_ENV=development
PORT=8080
JWT_SECRET=dev-jwt-secret-key-for-development-only-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-key-for-development-only-change-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
MONGODB_URI=mongodb://localhost:27017/smartcharging
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_CREDENTIALS=true
LOG_LEVEL=info
EOF
        echo "✅ 开发环境配置已创建"
    fi
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        echo "📦 安装后端依赖..."
        npm install
    fi
    
    # 启动后端
    npm run dev &
    BACKEND_PID=$!
    echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
    cd ..
}

# 启动充电服务
start_charging_service() {
    echo "⚡ 启动充电服务 (端口 8001)..."
    cd chargingService
    
    # 检查Python虚拟环境
    if [ ! -d "venv" ]; then
        echo "🐍 创建Python虚拟环境..."
        python -m venv venv
    fi
    
    # 激活虚拟环境
    source venv/bin/activate
    
    # 安装依赖
    pip install -r requirements.txt
    
    # 启动服务
    python main.py &
    CHARGING_PID=$!
    echo "✅ 充电服务已启动 (PID: $CHARGING_PID)"
    cd ..
}

# 启动前端
start_frontend() {
    echo "🎨 启动前端服务 (端口 8000)..."
    cd frontEnd
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        echo "📦 安装前端依赖..."
        npm install
    fi
    
    # 启动前端
    npm run dev:h5 &
    FRONTEND_PID=$!
    echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"
    cd ..
}

# 主函数
main() {
    # 检查必要端口
    check_port 8080 || exit 1
    check_port 8001 || exit 1
    check_port 8000 || exit 1
    
    # 启动所有服务
    start_backend
    sleep 3
    start_charging_service
    sleep 3
    start_frontend
    
    echo ""
    echo "🎉 所有服务已启动完成！"
    echo "📱 前端访问地址: http://localhost:8000"
    echo "🔌 后端API地址: http://localhost:8080/api"
    echo "⚡ 充电服务地址: http://localhost:8001"
    echo ""
    echo "按 Ctrl+C 停止所有服务"
    
    # 等待用户停止
    trap 'echo "🛑 正在停止所有服务..."; kill $BACKEND_PID $CHARGING_PID $FRONTEND_PID 2>/dev/null; exit 0' INT
    wait
}

main "$@"
