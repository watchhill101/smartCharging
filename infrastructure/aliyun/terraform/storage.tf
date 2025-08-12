# 阿里云对象存储服务配置

# 创建OSS存储桶 - 静态资源
resource "alicloud_oss_bucket" "static" {
  bucket = "${var.project_name}-static-${random_string.bucket_suffix.result}"
  acl    = "public-read"
  
  cors_rule {
    allowed_origins = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
  
  lifecycle_rule {
    id      = "delete_old_versions"
    enabled = true
    
    expiration {
      days = 365
    }
    
    noncurrent_version_expiration {
      days = 30
    }
  }
  
  tags = {
    Name        = "${var.project_name}-static"
    Environment = var.environment
    Purpose     = "static-assets"
  }
}

# 创建OSS存储桶 - 用户上传文件
resource "alicloud_oss_bucket" "uploads" {
  bucket = "${var.project_name}-uploads-${random_string.bucket_suffix.result}"
  acl    = "private"
  
  cors_rule {
    allowed_origins = ["https://${var.domain_name}", "https://www.${var.domain_name}"]
    allowed_methods = ["GET", "POST", "PUT", "DELETE", "HEAD"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
  
  lifecycle_rule {
    id      = "cleanup_multipart_uploads"
    enabled = true
    
    abort_multipart_upload {
      days = 7
    }
  }
  
  server_side_encryption_rule {
    sse_algorithm = "AES256"
  }
  
  tags = {
    Name        = "${var.project_name}-uploads"
    Environment = var.environment
    Purpose     = "user-uploads"
  }
}

# 创建OSS存储桶 - 备份
resource "alicloud_oss_bucket" "backup" {
  bucket = "${var.project_name}-backup-${random_string.bucket_suffix.result}"
  acl    = "private"
  
  lifecycle_rule {
    id      = "backup_retention"
    enabled = true
    
    expiration {
      days = 90
    }
    
    transition {
      days          = 30
      storage_class = "IA"
    }
    
    transition {
      days          = 60
      storage_class = "Archive"
    }
  }
  
  versioning {
    status = "Enabled"
  }
  
  server_side_encryption_rule {
    sse_algorithm = "AES256"
  }
  
  tags = {
    Name        = "${var.project_name}-backup"
    Environment = var.environment
    Purpose     = "backup"
  }
}

# CDN配置 - 静态资源加速
resource "alicloud_cdn_domain_new" "static" {
  domain_name = "static.${var.domain_name}"
  cdn_type    = "web"
  scope       = "domestic"
  
  sources {
    content  = alicloud_oss_bucket.static.extranet_endpoint
    type     = "oss"
    priority = 20
    port     = 80
    weight   = 10
  }
  
  tags = {
    Name        = "${var.project_name}-static-cdn"
    Environment = var.environment
  }
}

# CDN缓存配置
resource "alicloud_cdn_domain_config" "static_cache" {
  domain_name   = alicloud_cdn_domain_new.static.domain_name
  function_name = "cache_expired"
  config_args {
    arg_name  = "cache_content"
    arg_value = "jpg,jpeg,png,gif,webp,css,js,ico,svg,woff,woff2,ttf,eot"
  }
  config_args {
    arg_name  = "ttl"
    arg_value = "31536000"
  }
  config_args {
    arg_name  = "weight"
    arg_value = "1"
  }
}

# CDN HTTPS配置
resource "alicloud_cdn_domain_config" "static_https" {
  domain_name   = alicloud_cdn_domain_new.static.domain_name
  function_name = "https_force"
  config_args {
    arg_name  = "enable"
    arg_value = "on"
  }
}

# 随机字符串用于存储桶名称
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# 变量定义
variable "domain_name" {
  description = "域名"
  type        = string
  default     = "smartcharging.com"
}

# 输出
output "static_bucket_name" {
  description = "静态资源存储桶名称"
  value       = alicloud_oss_bucket.static.bucket
}

output "uploads_bucket_name" {
  description = "用户上传存储桶名称"
  value       = alicloud_oss_bucket.uploads.bucket
}

output "backup_bucket_name" {
  description = "备份存储桶名称"
  value       = alicloud_oss_bucket.backup.bucket
}

output "static_bucket_endpoint" {
  description = "静态资源存储桶访问端点"
  value       = alicloud_oss_bucket.static.extranet_endpoint
}

output "uploads_bucket_endpoint" {
  description = "用户上传存储桶访问端点"
  value       = alicloud_oss_bucket.uploads.extranet_endpoint
}

output "cdn_domain" {
  description = "CDN加速域名"
  value       = alicloud_cdn_domain_new.static.domain_name
}

output "cdn_cname" {
  description = "CDN CNAME"
  value       = alicloud_cdn_domain_new.static.cname
}