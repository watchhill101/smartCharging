# 阿里云基础设施部署指南

本文档介绍如何在阿里云上部署智能充电应用的基础设施。

## 📋 前置要求

### 1. 工具安装
- [Terraform](https://www.terraform.io/downloads.html) >= 1.0
- [阿里云CLI](https://help.aliyun.com/document_detail/121541.html) (可选)
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### 2. 阿里云账号准备
- 阿里云账号和AccessKey
- 已实名认证
- 账户余额充足
- 开通以下服务：
  - ECS (云服务器)
  - VPC (专有网络)
  - SLB (负载均衡)
  - RDS (云数据库)
  - OSS (对象存储)
  - CDN (内容分发网络)
  - DNS (域名解析)

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd smartCharging/infrastructure/aliyun
```

### 2. 配置Terraform变量
```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
vim terraform/terraform.tfvars
```

填入以下信息：
```hcl
access_key = "your-access-key"
secret_key = "your-secret-key"
region = "cn-beijing"
project_name = "smart-charging"
environment = "production"
domain_name = "smartcharging.com"
mongodb_password = "YourStrongPassword2024!"
redis_password = "YourStrongPassword2024!"
```

### 3. 准备SSL证书
```bash
mkdir -p terraform/certs
# 将SSL证书文件放入certs目录
# - domain.crt (证书文件)
# - domain.key (私钥文件)
```

### 4. 部署基础设施
```bash
# 初始化Terraform
./scripts/deploy.sh init

# 生成部署计划
./scripts/deploy.sh plan

# 执行部署
./scripts/deploy.sh apply
```

### 5. 配置服务器
部署完成后，登录到ECS实例并运行初始化脚本：

```bash
# 登录到Web服务器
ssh ubuntu@<web-server-ip>

# 下载并运行初始化脚本
wget https://raw.githubusercontent.com/your-repo/smartCharging/main/infrastructure/aliyun/scripts/setup-servers.sh
sudo bash setup-servers.sh
```

### 6. 部署应用
```bash
# 复制配置文件
cp configs/.env.production.example /opt/smart-charging/.env.production
vim /opt/smart-charging/.env.production

# 复制Docker Compose文件
cp configs/docker-compose.production.yml /opt/smart-charging/
cp configs/nginx-production.conf /opt/smart-charging/nginx/

# 启动应用
cd /opt/smart-charging
docker-compose -f docker-compose.production.yml up -d
```

## 🏗️ 架构概览

### 网络架构
```
Internet
    |
[阿里云SLB负载均衡器]
    |
[Web层 - Nginx (10.1.0.0/24)]
    |
[应用层 - Node.js/Python (10.2.0.0/24)]
    |
[数据层 - MongoDB/Redis (10.3.0.0/24)]
```

### 服务组件
- **Web层**: Nginx反向代理，SSL终止，静态文件服务
- **应用层**: Node.js主服务 + Python充电服务
- **数据层**: MongoDB数据库 + Redis缓存
- **存储**: OSS对象存储 + CDN加速
- **监控**: Prometheus + Grafana + 日志收集

## 📊 资源清单

### 计算资源
- **ECS实例**: 2台Web服务器 (ecs.c6.large) + 2台应用服务器 (ecs.c6.xlarge)
- **SLB负载均衡器**: 1台 (slb.s2.small)

### 数据库资源
- **MongoDB**: 1台云数据库实例 (dds.mongo.mid)
- **Redis**: 1台云缓存实例 (redis.master.small.default)

### 存储资源
- **OSS存储桶**: 3个 (静态资源、用户上传、备份)
- **CDN**: 1个加速域名

### 网络资源
- **VPC**: 1个专有网络
- **交换机**: 3个 (Web层、应用层、数据层)
- **安全组**: 3个 (对应各层)
- **弹性公网IP**: 2个

## 💰 成本估算

### 月度成本 (北京地域)
- **ECS实例**: ¥800-1200/月
- **SLB负载均衡器**: ¥50-100/月
- **MongoDB数据库**: ¥300-500/月
- **Redis缓存**: ¥100-200/月
- **OSS存储**: ¥10-50/月
- **CDN流量**: ¥50-200/月
- **域名解析**: ¥10/月
- **SSL证书**: ¥0-500/月

**总计**: ¥1320-2560/月

## 🔧 运维管理

### 监控告警
- **系统监控**: CPU、内存、磁盘、网络
- **应用监控**: 响应时间、错误率、吞吐量
- **数据库监控**: 连接数、查询性能、存储使用
- **告警通知**: 短信、邮件、钉钉

### 备份策略
- **数据库备份**: 每日自动备份，保留7天
- **应用备份**: 每周备份到OSS，保留30天
- **配置备份**: Git版本控制

### 扩容策略
- **水平扩容**: 增加ECS实例数量
- **垂直扩容**: 升级实例规格
- **数据库扩容**: 升级数据库规格或分库分表
- **CDN扩容**: 增加CDN节点

## 🔒 安全配置

### 网络安全
- **VPC隔离**: 三层网络架构
- **安全组**: 最小权限原则
- **WAF防护**: Web应用防火墙
- **DDoS防护**: 基础防护 + 高防IP

### 数据安全
- **传输加密**: HTTPS/TLS
- **存储加密**: 数据库加密、OSS加密
- **访问控制**: RAM用户权限管理
- **审计日志**: 操作日志记录

### 应用安全
- **身份认证**: JWT令牌
- **权限控制**: RBAC权限模型
- **输入验证**: 参数校验和过滤
- **限流防护**: API限流和熔断

## 📝 常用命令

### Terraform命令
```bash
# 查看资源状态
terraform show

# 查看输出信息
terraform output

# 更新资源
terraform apply

# 销毁资源
terraform destroy
```

### Docker命令
```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 更新镜像
docker-compose pull && docker-compose up -d
```

### 系统命令
```bash
# 查看系统资源
htop
df -h
free -h

# 查看网络连接
netstat -tlnp
ss -tlnp

# 查看日志
tail -f /var/log/nginx/access.log
journalctl -u docker -f
```

## 🆘 故障排查

### 常见问题

1. **服务无法访问**
   - 检查安全组规则
   - 检查负载均衡器健康检查
   - 检查服务状态

2. **数据库连接失败**
   - 检查数据库实例状态
   - 检查网络连通性
   - 检查认证信息

3. **静态资源加载慢**
   - 检查CDN配置
   - 检查OSS存储桶权限
   - 检查缓存策略

### 日志位置
- **应用日志**: `/opt/smart-charging/logs/`
- **Nginx日志**: `/var/log/nginx/`
- **系统日志**: `/var/log/syslog`
- **Docker日志**: `docker-compose logs`

## 📞 技术支持

如有问题，请联系：
- 技术支持邮箱: support@smartcharging.com
- 技术文档: https://docs.smartcharging.com
- 问题反馈: https://github.com/your-repo/smartCharging/issues