#!/bin/bash

# 服务器初始化和应用部署脚本
# 在ECS实例上运行此脚本来安装和配置应用

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用root用户运行此脚本"
        exit 1
    fi
}

# 更新系统
update_system() {
    log_info "更新系统包..."
    apt-get update
    apt-get upgrade -y
    log_success "系统更新完成"
}

# 安装基础软件
install_basic_packages() {
    log_info "安装基础软件包..."
    apt-get install -y \
        curl \
        wget \
        git \
        vim \
        htop \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release
    log_success "基础软件包安装完成"
}

# 安装Docker
install_docker() {
    log_info "安装Docker..."
    
    # 添加Docker官方GPG密钥
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # 添加Docker仓库
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 安装Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io
    
    # 启动Docker服务
    systemctl start docker
    systemctl enable docker
    
    # 添加用户到docker组
    usermod -aG docker ubuntu
    
    log_success "Docker安装完成"
}

# 安装Docker Compose
install_docker_compose() {
    log_info "安装Docker Compose..."
    
    # 下载Docker Compose
    curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # 设置执行权限
    chmod +x /usr/local/bin/docker-compose
    
    # 创建软链接
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    log_success "Docker Compose安装完成"
}

# 安装Node.js
install_nodejs() {
    log_info "安装Node.js..."
    
    # 添加NodeSource仓库
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    
    # 安装Node.js
    apt-get install -y nodejs
    
    # 安装PM2
    npm install -g pm2
    
    log_success "Node.js和PM2安装完成"
}

# 安装Python
install_python() {
    log_info "安装Python..."
    
    # 安装Python 3.9
    apt-get install -y python3.9 python3.9-pip python3.9-venv
    
    # 创建软链接
    ln -sf /usr/bin/python3.9 /usr/bin/python
    ln -sf /usr/bin/pip3 /usr/bin/pip
    
    log_success "Python安装完成"
}

# 安装Nginx
install_nginx() {
    log_info "安装Nginx..."
    
    apt-get install -y nginx
    
    # 启动Nginx服务
    systemctl start nginx
    systemctl enable nginx
    
    # 创建配置目录
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled
    
    log_success "Nginx安装完成"
}

# 配置防火墙
configure_firewall() {
    log_info "配置防火墙..."
    
    # 安装ufw
    apt-get install -y ufw
    
    # 配置防火墙规则
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 'Nginx Full'
    ufw allow 8080
    ufw allow 8081
    
    # 启用防火墙
    ufw --force enable
    
    log_success "防火墙配置完成"
}

# 创建应用目录
create_app_directories() {
    log_info "创建应用目录..."
    
    # 创建应用根目录
    mkdir -p /opt/smart-charging
    mkdir -p /opt/smart-charging/logs
    mkdir -p /opt/smart-charging/data
    mkdir -p /opt/smart-charging/backups
    
    # 设置权限
    chown -R ubuntu:ubuntu /opt/smart-charging
    chmod -R 755 /opt/smart-charging
    
    log_success "应用目录创建完成"
}

# 配置日志轮转
configure_logrotate() {
    log_info "配置日志轮转..."
    
    cat > /etc/logrotate.d/smart-charging << EOF
/opt/smart-charging/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        systemctl reload nginx
        pm2 reload all
    endscript
}
EOF
    
    log_success "日志轮转配置完成"
}

# 配置系统监控
configure_monitoring() {
    log_info "配置系统监控..."
    
    # 安装监控工具
    apt-get install -y htop iotop nethogs
    
    # 配置系统资源监控脚本
    cat > /opt/smart-charging/monitor.sh << 'EOF'
#!/bin/bash
# 系统监控脚本

LOG_FILE="/opt/smart-charging/logs/system-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# 获取系统信息
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.2f", $3/$2 * 100.0)}')
DISK_USAGE=$(df -h / | awk 'NR==2{printf "%s", $5}')
LOAD_AVERAGE=$(uptime | awk -F'load average:' '{print $2}')

# 记录到日志
echo "[$DATE] CPU: ${CPU_USAGE}%, Memory: ${MEMORY_USAGE}%, Disk: ${DISK_USAGE}, Load: ${LOAD_AVERAGE}" >> $LOG_FILE
EOF
    
    chmod +x /opt/smart-charging/monitor.sh
    
    # 添加到crontab
    (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/smart-charging/monitor.sh") | crontab -
    
    log_success "系统监控配置完成"
}

# 主函数
main() {
    log_info "开始服务器初始化..."
    
    check_root
    update_system
    install_basic_packages
    install_docker
    install_docker_compose
    install_nodejs
    install_python
    install_nginx
    configure_firewall
    create_app_directories
    configure_logrotate
    configure_monitoring
    
    log_success "服务器初始化完成！"
    log_info "请重新登录以使用户组更改生效"
    log_info "应用目录: /opt/smart-charging"
    log_info "日志目录: /opt/smart-charging/logs"
}

# 执行主函数
main "$@"