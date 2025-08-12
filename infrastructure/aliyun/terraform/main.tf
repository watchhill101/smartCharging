# 阿里云基础设施配置 - Terraform
terraform {
  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.200.0"
    }
  }
  required_version = ">= 1.0"
}

# 配置阿里云Provider
provider "alicloud" {
  access_key = var.access_key
  secret_key = var.secret_key
  region     = var.region
}

# 变量定义
variable "access_key" {
  description = "阿里云Access Key"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "阿里云Secret Key"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "阿里云地域"
  type        = string
  default     = "cn-beijing"
}

variable "project_name" {
  description = "项目名称"
  type        = string
  default     = "smart-charging"
}

variable "environment" {
  description = "环境名称"
  type        = string
  default     = "production"
}

# 数据源 - 获取可用区
data "alicloud_zones" "default" {
  available_disk_category     = "cloud_efficiency"
  available_resource_creation = "VSwitch"
}

# 创建VPC
resource "alicloud_vpc" "main" {
  vpc_name   = "${var.project_name}-vpc"
  cidr_block = "10.0.0.0/8"
  
  tags = {
    Name        = "${var.project_name}-vpc"
    Environment = var.environment
    Project     = var.project_name
  }
}

# 创建交换机 - Web层
resource "alicloud_vswitch" "web" {
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = "10.1.0.0/24"
  zone_id      = data.alicloud_zones.default.zones[0].id
  vswitch_name = "${var.project_name}-web-subnet"
  
  tags = {
    Name        = "${var.project_name}-web-subnet"
    Environment = var.environment
    Tier        = "web"
  }
}

# 创建交换机 - 应用层
resource "alicloud_vswitch" "app" {
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = "10.2.0.0/24"
  zone_id      = data.alicloud_zones.default.zones[0].id
  vswitch_name = "${var.project_name}-app-subnet"
  
  tags = {
    Name        = "${var.project_name}-app-subnet"
    Environment = var.environment
    Tier        = "application"
  }
}

# 创建交换机 - 数据库层
resource "alicloud_vswitch" "db" {
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = "10.3.0.0/24"
  zone_id      = data.alicloud_zones.default.zones[1].id
  vswitch_name = "${var.project_name}-db-subnet"
  
  tags = {
    Name        = "${var.project_name}-db-subnet"
    Environment = var.environment
    Tier        = "database"
  }
}

# 创建安全组 - Web层
resource "alicloud_security_group" "web" {
  name        = "${var.project_name}-web-sg"
  description = "Web层安全组"
  vpc_id      = alicloud_vpc.main.id
  
  tags = {
    Name        = "${var.project_name}-web-sg"
    Environment = var.environment
    Tier        = "web"
  }
}

# Web层安全组规则
resource "alicloud_security_group_rule" "web_http" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "80/80"
  priority          = 1
  security_group_id = alicloud_security_group.web.id
  cidr_ip           = "0.0.0.0/0"
}

resource "alicloud_security_group_rule" "web_https" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "443/443"
  priority          = 1
  security_group_id = alicloud_security_group.web.id
  cidr_ip           = "0.0.0.0/0"
}

resource "alicloud_security_group_rule" "web_ssh" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "22/22"
  priority          = 1
  security_group_id = alicloud_security_group.web.id
  cidr_ip           = "0.0.0.0/0"
}

# 创建安全组 - 应用层
resource "alicloud_security_group" "app" {
  name        = "${var.project_name}-app-sg"
  description = "应用层安全组"
  vpc_id      = alicloud_vpc.main.id
  
  tags = {
    Name        = "${var.project_name}-app-sg"
    Environment = var.environment
    Tier        = "application"
  }
}

# 应用层安全组规则
resource "alicloud_security_group_rule" "app_from_web" {
  type                     = "ingress"
  ip_protocol              = "tcp"
  nic_type                 = "intranet"
  policy                   = "accept"
  port_range               = "8080/8081"
  priority                 = 1
  security_group_id        = alicloud_security_group.app.id
  source_security_group_id = alicloud_security_group.web.id
}

resource "alicloud_security_group_rule" "app_ssh" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "22/22"
  priority          = 1
  security_group_id = alicloud_security_group.app.id
  cidr_ip           = "10.1.0.0/24"
}

# 创建安全组 - 数据库层
resource "alicloud_security_group" "db" {
  name        = "${var.project_name}-db-sg"
  description = "数据库层安全组"
  vpc_id      = alicloud_vpc.main.id
  
  tags = {
    Name        = "${var.project_name}-db-sg"
    Environment = var.environment
    Tier        = "database"
  }
}

# 数据库层安全组规则
resource "alicloud_security_group_rule" "db_mongodb" {
  type                     = "ingress"
  ip_protocol              = "tcp"
  nic_type                 = "intranet"
  policy                   = "accept"
  port_range               = "27017/27017"
  priority                 = 1
  security_group_id        = alicloud_security_group.db.id
  source_security_group_id = alicloud_security_group.app.id
}

resource "alicloud_security_group_rule" "db_redis" {
  type                     = "ingress"
  ip_protocol              = "tcp"
  nic_type                 = "intranet"
  policy                   = "accept"
  port_range               = "6379/6379"
  priority                 = 1
  security_group_id        = alicloud_security_group.db.id
  source_security_group_id = alicloud_security_group.app.id
}

# 创建ECS实例 - Web服务器
resource "alicloud_instance" "web" {
  count           = 2
  availability_zone = data.alicloud_zones.default.zones[0].id
  security_groups = [alicloud_security_group.web.id]
  
  instance_type        = "ecs.c6.large"
  system_disk_category = "cloud_efficiency"
  system_disk_size     = 40
  image_id            = "ubuntu_20_04_x64_20G_alibase_20210420.vhd"
  instance_name       = "${var.project_name}-web-${count.index + 1}"
  vswitch_id          = alicloud_vswitch.web.id
  internet_max_bandwidth_out = 100
  
  tags = {
    Name        = "${var.project_name}-web-${count.index + 1}"
    Environment = var.environment
    Tier        = "web"
    Role        = "nginx"
  }
}

# 创建ECS实例 - 应用服务器
resource "alicloud_instance" "app" {
  count           = 2
  availability_zone = data.alicloud_zones.default.zones[0].id
  security_groups = [alicloud_security_group.app.id]
  
  instance_type        = "ecs.c6.xlarge"
  system_disk_category = "cloud_efficiency"
  system_disk_size     = 80
  image_id            = "ubuntu_20_04_x64_20G_alibase_20210420.vhd"
  instance_name       = "${var.project_name}-app-${count.index + 1}"
  vswitch_id          = alicloud_vswitch.app.id
  
  tags = {
    Name        = "${var.project_name}-app-${count.index + 1}"
    Environment = var.environment
    Tier        = "application"
    Role        = "nodejs-python"
  }
}

# 创建负载均衡器
resource "alicloud_slb_load_balancer" "web" {
  load_balancer_name = "${var.project_name}-web-lb"
  load_balancer_spec = "slb.s2.small"
  vswitch_id         = alicloud_vswitch.web.id
  
  tags = {
    Name        = "${var.project_name}-web-lb"
    Environment = var.environment
  }
}

# 负载均衡监听器 - HTTP
resource "alicloud_slb_listener" "http" {
  load_balancer_id          = alicloud_slb_load_balancer.web.id
  backend_port              = 80
  frontend_port             = 80
  protocol                  = "http"
  bandwidth                 = -1
  sticky_session            = "on"
  sticky_session_type       = "insert"
  cookie_timeout            = 86400
  health_check              = "on"
  health_check_uri          = "/health"
  health_check_connect_port = 80
  healthy_threshold         = 3
  unhealthy_threshold       = 3
  health_check_timeout      = 5
  health_check_interval     = 2
}

# 负载均衡监听器 - HTTPS
resource "alicloud_slb_listener" "https" {
  load_balancer_id          = alicloud_slb_load_balancer.web.id
  backend_port              = 443
  frontend_port             = 443
  protocol                  = "https"
  bandwidth                 = -1
  ssl_certificate_id        = alicloud_ssl_certificates_service_certificate.main.id
  sticky_session            = "on"
  sticky_session_type       = "insert"
  cookie_timeout            = 86400
  health_check              = "on"
  health_check_uri          = "/health"
  health_check_connect_port = 443
  healthy_threshold         = 3
  unhealthy_threshold       = 3
  health_check_timeout      = 5
  health_check_interval     = 2
}

# 添加后端服务器到负载均衡器
resource "alicloud_slb_backend_server" "web" {
  count            = length(alicloud_instance.web)
  load_balancer_id = alicloud_slb_load_balancer.web.id
  backend_servers {
    server_id = alicloud_instance.web[count.index].id
    weight    = 100
  }
}

# 输出
output "vpc_id" {
  description = "VPC ID"
  value       = alicloud_vpc.main.id
}

output "web_subnet_id" {
  description = "Web子网ID"
  value       = alicloud_vswitch.web.id
}

output "app_subnet_id" {
  description = "应用子网ID"
  value       = alicloud_vswitch.app.id
}

output "db_subnet_id" {
  description = "数据库子网ID"
  value       = alicloud_vswitch.db.id
}

output "load_balancer_ip" {
  description = "负载均衡器IP地址"
  value       = alicloud_slb_load_balancer.web.address
}

output "web_instance_ips" {
  description = "Web服务器IP地址"
  value       = alicloud_instance.web[*].public_ip
}

output "app_instance_ips" {
  description = "应用服务器IP地址"
  value       = alicloud_instance.app[*].private_ip
}