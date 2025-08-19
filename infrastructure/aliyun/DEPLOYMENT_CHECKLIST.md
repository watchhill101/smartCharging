# 阿里云基础设施部署清单

## 📋 部署前准备

### 1. 阿里云账号准备
- [ ] 阿里云账号已实名认证
- [ ] 账户余额充足（建议至少1000元）
- [ ] 已创建AccessKey（具有足够权限）
- [ ] 已开通以下服务：
  - [ ] ECS (云服务器)
  - [ ] VPC (专有网络)
  - [ ] SLB (负载均衡)
  - [ ] MongoDB (云数据库)
  - [ ] Redis (云缓存)
  - [ ] OSS (对象存储)
  - [ ] CDN (内容分发网络)
  - [ ] DNS (域名解析)
  - [ ] SSL证书服务

### 2. 域名准备
- [ ] 域名已购买
- [ ] 域名已完成ICP备案（中国大陆）
- [ ] SSL证书已申请或准备自签名证书

### 3. 工具安装
- [ ] Terraform >= 1.0
- [ ] 阿里云CLI (可选)
- [ ] Git
- [ ] 文本编辑器

### 4. 本地环境准备
- [ ] 克隆项目代码
- [ ] 配置SSH密钥对
- [ ] 准备SSL证书文件

## 🚀 部署步骤

### 第一阶段：配置准备

#### 1. 配置Terraform变量
```bash
cd infrastructure/aliyun/terraform
cp terraform.tfvars.example terraform.tfvars
```

编辑 `terraform.tfvars` 文件，填入以下信息：
- [ ] access_key (阿里云Access Key ID)
- [ ] secret_key (阿里云Access Key Secret)
- [ ] region (部署地域)
- [ ] domain_name (主域名)
- [ ] mongodb_password (MongoDB密码)
- [ ] redis_password (Redis密码)
- [ ] 其他配置参数

#### 2. 准备SSL证书
```bash
mkdir -p certs
# 将证书文件复制到certs目录
cp /path/to/your/domain.crt certs/
cp /path/to/your/domain.key certs/
```

- [ ] domain.crt (SSL证书文件)
- [ ] domain.key (SSL私钥文件)

### 第二阶段：基础设施部署

#### 3. 初始化Terraform
```bash
# Linux/macOS
./scripts/deploy.sh init

# Windows
.\scripts\deploy.ps1 init
```

- [ ] Terraform初始化成功
- [ ] Provider插件下载完成
- [ ] 配置文件验证通过

#### 4. 生成部署计划
```bash
# Linux/macOS
./scripts/deploy.sh plan

# Windows
.\scripts\deploy.ps1 plan
```

- [ ] 部署计划生成成功
- [ ] 检查将要创建的资源
- [ ] 确认资源配置正确

#### 5. 执行部署
```bash
# Linux/macOS
./scripts/deploy.sh apply

# Windows
.\scripts\deploy.ps1 apply
```

- [ ] 基础设施部署成功
- [ ] 所有资源创建完成
- [ ] 获取部署输出信息

### 第三阶段：部署验证

#### 6. 验证部署结果
```bash
# Linux/macOS
./scripts/validate-deployment.sh

# Windows (手动验证)
terraform output
```

验证项目：
- [ ] VPC和子网创建成功
- [ ] ECS实例运行正常
- [ ] 负载均衡器配置正确
- [ ] 数据库实例可访问
- [ ] OSS存储桶创建成功
- [ ] CDN配置正确
- [ ] 域名解析生效
- [ ] SSL证书安装成功

#### 7. 网络连通性测试
- [ ] 负载均衡器HTTP访问正常
- [ ] 负载均衡器HTTPS访问正常
- [ ] ECS实例SSH连接正常
- [ ] 数据库网络连通性正常

### 第四阶段：服务器配置

#### 8. 服务器初始化
登录到ECS实例并运行初始化脚本：

```bash
# 登录到Web服务器
ssh ubuntu@<web-server-ip>

# 下载并运行初始化脚本
wget https://raw.githubusercontent.com/your-repo/smartCharging/main/infrastructure/aliyun/scripts/setup-servers.sh
sudo bash setup-servers.sh
```

- [ ] 系统更新完成
- [ ] Docker安装成功
- [ ] Node.js安装成功
- [ ] Python安装成功
- [ ] Nginx安装成功
- [ ] 防火墙配置完成
- [ ] 应用目录创建完成

#### 9. 应用部署配置
```bash
# 复制配置文件
cp configs/.env.production.example /opt/smart-charging/.env.production
vim /opt/smart-charging/.env.production

# 复制Docker Compose文件
cp configs/docker-compose.production.yml /opt/smart-charging/
cp configs/nginx-production.conf /opt/smart-charging/nginx/
```

- [ ] 环境变量配置完成
- [ ] Docker Compose配置完成
- [ ] Nginx配置完成

## 📊 资源清单确认

### 计算资源
- [ ] ECS实例 (Web层): 2台 ecs.c6.large
- [ ] ECS实例 (应用层): 2台 ecs.c6.xlarge
- [ ] SLB负载均衡器: 1台 slb.s2.small

### 网络资源
- [ ] VPC: 1个 (10.0.0.0/8)
- [ ] 交换机: 3个 (Web/App/DB层)
- [ ] 安全组: 3个 (对应各层)
- [ ] 弹性公网IP: 2个

### 数据库资源
- [ ] MongoDB实例: 1台 dds.mongo.mid
- [ ] Redis实例: 1台 redis.master.small.default

### 存储资源
- [ ] OSS存储桶: 3个 (静态/上传/备份)
- [ ] CDN加速域名: 1个

### 域名和证书
- [ ] 主域名解析: A记录
- [ ] WWW子域名解析: A记录
- [ ] API子域名解析: CNAME记录
- [ ] 静态资源子域名解析: CNAME记录
- [ ] SSL证书: 已安装

## 🔍 监控和告警

### 监控配置
- [ ] ECS实例监控: CPU/内存/磁盘
- [ ] 负载均衡器监控: 健康检查
- [ ] 数据库监控: 连接数/性能
- [ ] 应用监控: 响应时间/错误率

### 告警配置
- [ ] 报警联系人组已创建
- [ ] CPU使用率告警 (>80%)
- [ ] 内存使用率告警 (>85%)
- [ ] 磁盘使用率告警 (>85%)
- [ ] 数据库连接数告警
- [ ] 应用错误率告警 (>5%)

## 💰 成本预估

### 月度成本 (北京地域)
- ECS实例: ¥800-1200/月
- SLB负载均衡器: ¥50-100/月
- MongoDB数据库: ¥300-500/月
- Redis缓存: ¥100-200/月
- OSS存储: ¥10-50/月
- CDN流量: ¥50-200/月
- 域名解析: ¥10/月
- SSL证书: ¥0-500/月

**总计**: ¥1320-2560/月

## 🔒 安全检查

### 网络安全
- [ ] VPC网络隔离配置正确
- [ ] 安全组规则最小权限
- [ ] 防火墙配置正确
- [ ] SSH密钥认证配置

### 数据安全
- [ ] 数据库密码强度足够
- [ ] 传输加密配置 (HTTPS/TLS)
- [ ] 存储加密配置
- [ ] 访问控制配置正确

### 应用安全
- [ ] API限流配置
- [ ] 输入验证配置
- [ ] 错误处理配置
- [ ] 日志记录配置

## 📝 部署后任务

### 立即任务
- [ ] 验证所有服务正常运行
- [ ] 配置监控和告警
- [ ] 备份重要配置文件
- [ ] 文档更新

### 后续任务
- [ ] 性能测试
- [ ] 安全扫描
- [ ] 备份策略测试
- [ ] 灾难恢复计划
- [ ] 成本优化分析

## 🆘 故障排查

### 常见问题
1. **Terraform部署失败**
   - 检查AccessKey权限
   - 检查配置文件语法
   - 检查资源配额限制

2. **ECS实例无法访问**
   - 检查安全组规则
   - 检查网络配置
   - 检查SSH密钥

3. **数据库连接失败**
   - 检查网络连通性
   - 检查认证信息
   - 检查安全组规则

4. **域名解析问题**
   - 检查DNS记录配置
   - 等待DNS传播
   - 检查域名备案状态

### 联系支持
- 技术支持邮箱: support@smartcharging.com
- 阿里云工单系统
- 项目文档: https://docs.smartcharging.com

## ✅ 部署完成确认

- [ ] 所有基础设施资源部署成功
- [ ] 网络连通性测试通过
- [ ] 数据库连接测试通过
- [ ] 域名解析正常
- [ ] SSL证书配置正确
- [ ] 监控告警配置完成
- [ ] 安全配置检查通过
- [ ] 文档更新完成

**部署负责人签名**: _________________ **日期**: _________________

**技术审核签名**: _________________ **日期**: _________________