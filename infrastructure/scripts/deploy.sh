#!/bin/bash

# 智能充电应用部署脚本
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必要的环境变量
check_env() {
    log_info "检查环境变量..."
    
    required_vars=(
        "MONGO_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "ALIYUN_ACCESS_KEY_ID"
        "ALIYUN_ACCESS_KEY_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            log_error "环境变量 $var 未设置"
            exit 1
        fi
    done
    
    log_info "环境变量检查完成"
}

# 构建Docker镜像
build_images() {
    log_info "构建Docker镜像..."
    
    # 构建后端镜像
    log_info "构建Node.js后端镜像..."
    docker build -t smart-charging-backend:latest ../backEnd/
    
    # 构建充电服务镜像
    log_info "构建Python充电服务镜像..."
    docker build -t smart-charging-charging-service:latest ../backEnd/charging-service/
    
    log_info "Docker镜像构建完成"
}

# 部署服务
deploy_services() {
    log_info "部署服务..."
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose -f docker-compose.yml down
    
    # 启动新服务
    log_info "启动新服务..."
    docker-compose -f docker-compose.yml up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 检查服务状态
    check_services
    
    log_info "服务部署完成"
}

# 检查服务状态
check_services() {
    log_info "检查服务状态..."
    
    services=("mongodb" "redis" "backend" "charging-service" "nginx")
    
    for service in "${services[@]}"; do
        if docker-compose ps | grep -q "$service.*Up"; then
            log_info "$service 服务运行正常"
        else
            log_error "$service 服务启动失败"
            docker-compose logs "$service"
            exit 1
        fi
    done
    
    # 检查API健康状态
    log_info "检查API健康状态..."
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log_info "API健康检查通过"
    else
        log_error "API健康检查失败"
        exit 1
    fi
}

# 数据库初始化
init_database() {
    log_info "初始化数据库..."
    
    # 等待MongoDB启动
    sleep 10
    
    # 创建数据库索引
    docker exec smart-charging-mongodb mongo smart_charging --eval "
        db.users.createIndex({ phone: 1 }, { unique: true });
        db.charging_stations.createIndex({ location: '2dsphere' });
        db.charging_sessions.createIndex({ userId: 1, createdAt: -1 });
        db.orders.createIndex({ userId: 1, createdAt: -1 });
    "
    
    log_info "数据库初始化完成"
}

# 备份数据
backup_data() {
    log_info "备份数据..."
    
    backup_dir="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # 备份MongoDB
    docker exec smart-charging-mongodb mongodump --out /tmp/backup
    docker cp smart-charging-mongodb:/tmp/backup "$backup_dir/mongodb"
    
    # 备份Redis
    docker exec smart-charging-redis redis-cli BGSAVE
    docker cp smart-charging-redis:/data/dump.rdb "$backup_dir/redis/"
    
    log_info "数据备份完成: $backup_dir"
}

# 主函数
main() {
    log_info "开始部署智能充电应用..."
    
    case "${1:-deploy}" in
        "check")
            check_env
            check_services
            ;;
        "build")
            check_env
            build_images
            ;;
        "deploy")
            check_env
            build_images
            deploy_services
            init_database
            ;;
        "backup")
            backup_data
            ;;
        *)
            log_error "未知命令: $1"
            echo "用法: $0 [check|build|deploy|backup]"
            exit 1
            ;;
    esac
    
    log_info "操作完成!"
}

# 执行主函数
main "$@"