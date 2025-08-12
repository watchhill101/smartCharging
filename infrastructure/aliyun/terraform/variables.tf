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
  default     = "cn-hangzhou"
}

# 环境配置
variable "environment" {
  description = "部署环境"
  type        = string
  default     = "production"
}

# ECS实例配置
variable "instance_type" {
  description = "ECS实例规格"
  type        = string
  default     = "ecs.c6.large"
}

variable "instance_count" {
  description = "ECS实例数量"
  type        = number
  default     = 2
}

variable "key_pair_name" {
  description = "SSH密钥对名称"
  type        = string
}

# OSS配置
variable "oss_bucket_name" {
  description = "OSS存储桶名称"
  type        = string
  default     = "smart-charging-assets"
}