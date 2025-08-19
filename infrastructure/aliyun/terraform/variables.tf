# 阿里云访问凭证
variable "access_key" {
  description = "阿里云Access Key ID"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "阿里云Access Key Secret"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "阿里云地域"
  type        = string
  default     = "cn-beijing"
}

# 项目配置
variable "project_name" {
  description = "项目名称"
  type        = string
  default     = "smart-charging"
}

variable "environment" {
  description = "部署环境"
  type        = string
  default     = "production"
}

# 域名配置
variable "domain_name" {
  description = "主域名"
  type        = string
  default     = "smartcharging.com"
}

# ECS实例配置
variable "web_instance_type" {
  description = "Web服务器实例规格"
  type        = string
  default     = "ecs.c6.large"
}

variable "app_instance_type" {
  description = "应用服务器实例规格"
  type        = string
  default     = "ecs.c6.xlarge"
}

variable "web_instance_count" {
  description = "Web服务器实例数量"
  type        = number
  default     = 2
}

variable "app_instance_count" {
  description = "应用服务器实例数量"
  type        = number
  default     = 2
}

# 数据库配置
variable "mongodb_password" {
  description = "MongoDB数据库密码"
  type        = string
  sensitive   = true
  default     = "SmartCharging2024!"
  
  validation {
    condition     = length(var.mongodb_password) >= 8
    error_message = "MongoDB密码长度至少8位"
  }
}

variable "redis_password" {
  description = "Redis数据库密码"
  type        = string
  sensitive   = true
  default     = "SmartCharging2024!"
  
  validation {
    condition     = length(var.redis_password) >= 8
    error_message = "Redis密码长度至少8位"
  }
}

variable "mongodb_instance_class" {
  description = "MongoDB实例规格"
  type        = string
  default     = "dds.mongo.mid"
}

variable "redis_instance_class" {
  description = "Redis实例规格"
  type        = string
  default     = "redis.master.small.default"
}

# OSS配置
variable "oss_static_acl" {
  description = "静态资源OSS存储桶访问权限"
  type        = string
  default     = "public-read"
}

variable "oss_uploads_acl" {
  description = "用户上传OSS存储桶访问权限"
  type        = string
  default     = "private"
}

variable "oss_backup_acl" {
  description = "备份OSS存储桶访问权限"
  type        = string
  default     = "private"
}

# 负载均衡配置
variable "slb_spec" {
  description = "负载均衡器规格"
  type        = string
  default     = "slb.s2.small"
}

# 标签配置
variable "common_tags" {
  description = "通用标签"
  type        = map(string)
  default = {
    Project     = "smart-charging"
    Environment = "production"
    Owner       = "smart-charging-team"
    ManagedBy   = "terraform"
  }
}