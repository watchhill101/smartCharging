#!/bin/bash

# 阿里云基础设施部署脚本
# 使用方法: ./deploy.sh [init|plan|apply|destroy]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
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

# 检查必要工具
check_prerequisites() {
    log_info "检查必要工具..."
    
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform 未安装，请先安装 Terraform"
        exit 1
    fi
    
    if ! command -v aliyun &> /dev/null; then
        log_warning "阿里云CLI未安装，建议安装以便管理资源"
    fi
    
    log_success "工具检查完成"
}

# 检查配置文件
check_config() {
    log_info "检查配置文件..."
    
    if [ ! -f "terraform.tfvars" ]; then
        log_error "terraform.tfvars 文件不存在"
        log_info "请复制 terraform.tfvars.example 为 terraform.tfvars 并填入实际值"
        exit 1
    fi
    
    if [ ! -d "certs" ]; then
        log_warning "certs 目录不存在，将创建示例证书目录"
        mkdir -p certs
        log_info "请将SSL证书文件放入 certs/ 目录："
        log_info "  - domain.crt (证书文件)"
        log_info "  - domain.key (私钥文件)"
    fi
    
    log_success "配置检查完成"
}

# 初始化Terraform
terraform_init() {
    log_info "初始化 Terraform..."
    terraform init
    log_success "Terraform 初始化完成"
}

# 验证配置
terraform_validate() {
    log_info "验证 Terraform 配置..."
    terraform validate
    log_success "配置验证通过"
}

# 规划部署
terraform_plan() {
    log_info "生成部署计划..."
    terraform plan -out=tfplan
    log_success "部署计划生成完成"
}

# 执行部署
terraform_apply() {
    log_info "开始部署基础设施..."
    log_warning "这将创建阿里云资源并产生费用，确认继续？(y/N)"
    read -r response
    
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        if [ -f "tfplan" ]; then
            terraform apply tfplan
        else
            terraform apply
        fi
        log_success "基础设施部署完成"
        
        # 显示重要输出
        log_info "重要信息："
        terraform output
    else
        log_info "部署已取消"
        exit 0
    fi
}

# 销毁资源
terraform_destroy() {
    log_warning "这将销毁所有阿里云资源，确认继续？(y/N)"
    read -r response
    
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log_info "开始销毁基础设施..."
        terraform destroy
        log_success "基础设施销毁完成"
    else
        log_info "销毁已取消"
        exit 0
    fi
}

# 显示帮助信息
show_help() {
    echo "阿里云基础设施部署脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 [命令]"
    echo ""
    echo "命令:"
    echo "  init     初始化 Terraform"
    echo "  validate 验证配置文件"
    echo "  plan     生成部署计划"
    echo "  apply    执行部署"
    echo "  destroy  销毁资源"
    echo "  output   显示输出信息"
    echo "  help     显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 init"
    echo "  $0 plan"
    echo "  $0 apply"
}

# 主函数
main() {
    cd "$(dirname "$0")/../terraform"
    
    case "${1:-help}" in
        init)
            check_prerequisites
            check_config
            terraform_init
            ;;
        validate)
            terraform_validate
            ;;
        plan)
            check_prerequisites
            check_config
            terraform_validate
            terraform_plan
            ;;
        apply)
            check_prerequisites
            check_config
            terraform_validate
            terraform_apply
            ;;
        destroy)
            terraform_destroy
            ;;
        output)
            terraform output
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"