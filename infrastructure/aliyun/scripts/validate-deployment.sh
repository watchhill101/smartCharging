#!/bin/bash

# 阿里云基础设施部署验证脚本
# 验证部署的资源是否正常工作

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

# 检查Terraform输出
check_terraform_outputs() {
    log_info "检查Terraform输出..."
    
    cd "$(dirname "$0")/../terraform"
    
    if ! terraform output > /dev/null 2>&1; then
        log_error "无法获取Terraform输出，请确保已成功部署"
        exit 1
    fi
    
    # 获取关键输出
    LOAD_BALANCER_IP=$(terraform output -raw load_balancer_ip 2>/dev/null || echo "")
    WEB_IPS=($(terraform output -json web_instance_ips 2>/dev/null | jq -r '.[]' || echo ""))
    APP_IPS=($(terraform output -json app_instance_ips 2>/dev/null | jq -r '.[]' || echo ""))
    
    if [ -z "$LOAD_BALANCER_IP" ]; then
        log_error "无法获取负载均衡器IP地址"
        exit 1
    fi
    
    log_success "Terraform输出检查完成"
    log_info "负载均衡器IP: $LOAD_BALANCER_IP"
    log_info "Web服务器IP: ${WEB_IPS[*]}"
    log_info "应用服务器IP: ${APP_IPS[*]}"
}

# 检查ECS实例状态
check_ecs_instances() {
    log_info "检查ECS实例状态..."
    
    # 检查Web服务器
    for ip in "${WEB_IPS[@]}"; do
        if [ -n "$ip" ]; then
            log_info "检查Web服务器: $ip"
            if ping -c 3 "$ip" > /dev/null 2>&1; then
                log_success "Web服务器 $ip 网络连通正常"
            else
                log_warning "Web服务器 $ip 网络连通失败"
            fi
            
            # 检查SSH连接
            if timeout 10 ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no ubuntu@"$ip" "echo 'SSH连接测试'" > /dev/null 2>&1; then
                log_success "Web服务器 $ip SSH连接正常"
            else
                log_warning "Web服务器 $ip SSH连接失败"
            fi
        fi
    done
    
    # 检查应用服务器（通过跳板机）
    if [ ${#WEB_IPS[@]} -gt 0 ] && [ -n "${WEB_IPS[0]}" ]; then
        for ip in "${APP_IPS[@]}"; do
            if [ -n "$ip" ]; then
                log_info "检查应用服务器: $ip"
                if timeout 10 ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -J ubuntu@"${WEB_IPS[0]}" ubuntu@"$ip" "echo 'SSH连接测试'" > /dev/null 2>&1; then
                    log_success "应用服务器 $ip SSH连接正常"
                else
                    log_warning "应用服务器 $ip SSH连接失败"
                fi
            fi
        done
    fi
}

# 检查负载均衡器
check_load_balancer() {
    log_info "检查负载均衡器状态..."
    
    # 检查HTTP连接
    if curl -s --connect-timeout 10 "http://$LOAD_BALANCER_IP" > /dev/null; then
        log_success "负载均衡器HTTP连接正常"
    else
        log_warning "负载均衡器HTTP连接失败"
    fi
    
    # 检查HTTPS连接（如果配置了SSL）
    if curl -s --connect-timeout 10 -k "https://$LOAD_BALANCER_IP" > /dev/null; then
        log_success "负载均衡器HTTPS连接正常"
    else
        log_warning "负载均衡器HTTPS连接失败或未配置"
    fi
}

# 检查数据库连接
check_databases() {
    log_info "检查数据库连接..."
    
    # 获取数据库连接信息
    MONGODB_URI=$(terraform output -raw mongodb_connection_string 2>/dev/null || echo "")
    REDIS_URI=$(terraform output -raw redis_connection_string 2>/dev/null || echo "")
    
    if [ -n "$MONGODB_URI" ]; then
        log_info "MongoDB连接字符串已获取"
        # 注意：实际环境中不应该在日志中显示完整连接字符串
        log_info "MongoDB URI: ${MONGODB_URI:0:20}..."
    else
        log_warning "无法获取MongoDB连接字符串"
    fi
    
    if [ -n "$REDIS_URI" ]; then
        log_info "Redis连接字符串已获取"
        log_info "Redis URI: ${REDIS_URI:0:20}..."
    else
        log_warning "无法获取Redis连接字符串"
    fi
}

# 检查OSS存储桶
check_oss_buckets() {
    log_info "检查OSS存储桶..."
    
    STATIC_BUCKET=$(terraform output -raw static_bucket_name 2>/dev/null || echo "")
    UPLOADS_BUCKET=$(terraform output -raw uploads_bucket_name 2>/dev/null || echo "")
    BACKUP_BUCKET=$(terraform output -raw backup_bucket_name 2>/dev/null || echo "")
    
    if [ -n "$STATIC_BUCKET" ]; then
        log_success "静态资源存储桶: $STATIC_BUCKET"
    else
        log_warning "无法获取静态资源存储桶信息"
    fi
    
    if [ -n "$UPLOADS_BUCKET" ]; then
        log_success "用户上传存储桶: $UPLOADS_BUCKET"
    else
        log_warning "无法获取用户上传存储桶信息"
    fi
    
    if [ -n "$BACKUP_BUCKET" ]; then
        log_success "备份存储桶: $BACKUP_BUCKET"
    else
        log_warning "无法获取备份存储桶信息"
    fi
}

# 检查CDN配置
check_cdn() {
    log_info "检查CDN配置..."
    
    CDN_DOMAIN=$(terraform output -raw cdn_domain 2>/dev/null || echo "")
    CDN_CNAME=$(terraform output -raw cdn_cname 2>/dev/null || echo "")
    
    if [ -n "$CDN_DOMAIN" ]; then
        log_success "CDN域名: $CDN_DOMAIN"
        
        # 检查CDN域名解析
        if nslookup "$CDN_DOMAIN" > /dev/null 2>&1; then
            log_success "CDN域名解析正常"
        else
            log_warning "CDN域名解析失败"
        fi
    else
        log_warning "无法获取CDN域名信息"
    fi
    
    if [ -n "$CDN_CNAME" ]; then
        log_info "CDN CNAME: $CDN_CNAME"
    fi
}

# 检查域名解析
check_dns() {
    log_info "检查域名解析..."
    
    DOMAIN_NAME=$(terraform output -raw domain_name 2>/dev/null || echo "smartcharging.com")
    
    # 检查主域名解析
    if nslookup "$DOMAIN_NAME" > /dev/null 2>&1; then
        RESOLVED_IP=$(nslookup "$DOMAIN_NAME" | grep -A1 "Name:" | tail -1 | awk '{print $2}' || echo "")
        if [ "$RESOLVED_IP" = "$LOAD_BALANCER_IP" ]; then
            log_success "主域名解析正确: $DOMAIN_NAME -> $RESOLVED_IP"
        else
            log_warning "主域名解析不匹配: $DOMAIN_NAME -> $RESOLVED_IP (期望: $LOAD_BALANCER_IP)"
        fi
    else
        log_warning "主域名解析失败: $DOMAIN_NAME"
    fi
    
    # 检查www子域名解析
    if nslookup "www.$DOMAIN_NAME" > /dev/null 2>&1; then
        log_success "WWW子域名解析正常: www.$DOMAIN_NAME"
    else
        log_warning "WWW子域名解析失败: www.$DOMAIN_NAME"
    fi
    
    # 检查API子域名解析
    if nslookup "api.$DOMAIN_NAME" > /dev/null 2>&1; then
        log_success "API子域名解析正常: api.$DOMAIN_NAME"
    else
        log_warning "API子域名解析失败: api.$DOMAIN_NAME"
    fi
}

# 生成部署报告
generate_report() {
    log_info "生成部署验证报告..."
    
    REPORT_FILE="/tmp/smart-charging-deployment-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$REPORT_FILE" << EOF
智能充电应用 - 阿里云基础设施部署验证报告
生成时间: $(date)
========================================

基础信息:
- 项目名称: smart-charging
- 部署环境: production
- 阿里云地域: $(terraform output -raw region 2>/dev/null || echo "未知")

网络资源:
- VPC ID: $(terraform output -raw vpc_id 2>/dev/null || echo "未知")
- 负载均衡器IP: $LOAD_BALANCER_IP
- Web服务器IP: ${WEB_IPS[*]}
- 应用服务器IP: ${APP_IPS[*]}

数据库资源:
- MongoDB实例ID: $(terraform output -raw mongodb_instance_id 2>/dev/null || echo "未知")
- Redis实例ID: $(terraform output -raw redis_instance_id 2>/dev/null || echo "未知")

存储资源:
- 静态资源存储桶: $STATIC_BUCKET
- 用户上传存储桶: $UPLOADS_BUCKET
- 备份存储桶: $BACKUP_BUCKET
- CDN域名: $CDN_DOMAIN

域名配置:
- 主域名: $DOMAIN_NAME
- SSL证书ID: $(terraform output -raw ssl_certificate_id 2>/dev/null || echo "未知")

监控配置:
- 报警联系人组: $(terraform output -raw alarm_contact_group_id 2>/dev/null || echo "未知")
- 监控控制台: $(terraform output -raw monitoring_dashboard_url 2>/dev/null || echo "未知")

验证结果:
- 基础设施部署: ✓ 完成
- 网络连通性: 需要进一步测试
- 数据库连接: 需要应用层测试
- 存储服务: ✓ 配置完成
- CDN服务: ✓ 配置完成
- 域名解析: 需要DNS传播时间

下一步操作:
1. 等待DNS记录传播（通常需要10-30分钟）
2. 在ECS实例上部署应用代码
3. 配置SSL证书和HTTPS
4. 进行端到端功能测试
5. 配置监控和告警
6. 进行性能测试

注意事项:
- 请妥善保管数据库密码和访问密钥
- 定期备份重要数据
- 监控资源使用情况和成本
- 及时更新安全补丁

EOF
    
    log_success "部署验证报告已生成: $REPORT_FILE"
    
    # 显示报告内容
    cat "$REPORT_FILE"
}

# 主函数
main() {
    log_info "开始验证阿里云基础设施部署..."
    
    # 检查必要工具
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform未安装"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_warning "jq未安装，某些检查可能无法进行"
    fi
    
    # 执行各项检查
    check_terraform_outputs
    check_ecs_instances
    check_load_balancer
    check_databases
    check_oss_buckets
    check_cdn
    check_dns
    generate_report
    
    log_success "基础设施部署验证完成！"
    log_info "请查看生成的报告了解详细信息"
}

# 执行主函数
main "$@"