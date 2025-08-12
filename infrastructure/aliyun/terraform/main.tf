# 配置阿里云Provider
terraform {
  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.200"
    }
  }
}

# 配置阿里云访问凭证
provider "alicloud" {
  access_key = var.access_key
  secret_key = var.secret_key
  region     = var.region
}

# 创建VPC
resource "alicloud_vpc" "main" {
  vpc_name   = "smart-charging-vpc"
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name        = "smart-charging-vpc"
    Environment = var.environment
  }
}

# 创建交换机
resource "alicloud_vswitch" "main" {
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = "10.0.1.0/24"
  zone_id      = data.alicloud_zones.available.zones[0].id
  vswitch_name = "smart-charging-vswitch"
  
  tags = {
    Name        = "smart-charging-vswitch"
    Environment = var.environment
  }
}

# 获取可用区信息
data "alicloud_zones" "available" {
  available_disk_category     = "cloud_efficiency"
  available_resource_creation = "VSwitch"
}

# 创建安全组
resource "alicloud_security_group" "main" {
  name        = "smart-charging-sg"
  description = "Security group for smart charging application"
  vpc_id      = alicloud_vpc.main.id
  
  tags = {
    Name        = "smart-charging-sg"
    Environment = var.environment
  }
}

# 安全组规则 - HTTP
resource "alicloud_security_group_rule" "allow_http" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "80/80"
  priority          = 1
  security_group_id = alicloud_security_group.main.id
  cidr_ip           = "0.0.0.0/0"
}

# 安全组规则 - HTTPS
resource "alicloud_security_group_rule" "allow_https" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "443/443"
  priority          = 1
  security_group_id = alicloud_security_group.main.id
  cidr_ip           = "0.0.0.0/0"
}

# 安全组规则 - SSH
resource "alicloud_security_group_rule" "allow_ssh" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "22/22"
  priority          = 1
  security_group_id = alicloud_security_group.main.id
  cidr_ip           = "0.0.0.0/0"
}

# 创建ECS实例
resource "alicloud_instance" "web" {
  count           = var.instance_count
  availability_zone = data.alicloud_zones.available.zones[0].id
  security_groups = [alicloud_security_group.main.id]
  
  instance_type        = var.instance_type
  system_disk_category = "cloud_efficiency"
  system_disk_size     = 40
  image_id            = data.alicloud_images.ubuntu.images[0].id
  instance_name       = "smart-charging-web-${count.index + 1}"
  vswitch_id          = alicloud_vswitch.main.id
  
  key_name = var.key_pair_name
  
  tags = {
    Name        = "smart-charging-web-${count.index + 1}"
    Environment = var.environment
  }
}

# 获取Ubuntu镜像
data "alicloud_images" "ubuntu" {
  most_recent = true
  owners      = "system"
  name_regex  = "^ubuntu_20_04_x64*"
}

# 创建负载均衡器
resource "alicloud_slb_load_balancer" "main" {
  load_balancer_name = "smart-charging-slb"
  load_balancer_spec = "slb.s2.small"
  vswitch_id         = alicloud_vswitch.main.id
  
  tags = {
    Name        = "smart-charging-slb"
    Environment = var.environment
  }
}

# 创建OSS存储桶
resource "alicloud_oss_bucket" "assets" {
  bucket = var.oss_bucket_name
  acl    = "private"
  
  tags = {
    Name        = "smart-charging-assets"
    Environment = var.environment
  }
}

# 输出信息
output "vpc_id" {
  value = alicloud_vpc.main.id
}

output "vswitch_id" {
  value = alicloud_vswitch.main.id
}

output "security_group_id" {
  value = alicloud_security_group.main.id
}

output "instance_ids" {
  value = alicloud_instance.web[*].id
}

output "instance_public_ips" {
  value = alicloud_instance.web[*].public_ip
}

output "load_balancer_id" {
  value = alicloud_slb_load_balancer.main.id
}

output "oss_bucket_name" {
  value = alicloud_oss_bucket.assets.bucket
}