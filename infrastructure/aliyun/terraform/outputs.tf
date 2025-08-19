# Terraform输出配置

# 网络资源输出
output "vpc_id" {
  description = "VPC ID"
  value       = alicloud_vpc.main.id
}

output "web_subnet_id" {
  description = "Web层子网ID"
  value       = alicloud_vswitch.web.id
}

output "app_subnet_id" {
  description = "应用层子网ID"
  value       = alicloud_vswitch.app.id
}

output "db_subnet_id" {
  description = "数据库层子网ID"
  value       = alicloud_vswitch.db.id
}

# 计算资源输出
output "load_balancer_ip" {
  description = "负载均衡器公网IP地址"
  value       = alicloud_slb_load_balancer.web.address
}

output "web_instance_ips" {
  description = "Web服务器公网IP地址"
  value       = alicloud_instance.web[*].public_ip
}

output "app_instance_ips" {
  description = "应用服务器内网IP地址"
  value       = alicloud_instance.app[*].private_ip
}

output "web_instance_ids" {
  description = "Web服务器实例ID"
  value       = alicloud_instance.web[*].id
}

output "app_instance_ids" {
  description = "应用服务器实例ID"
  value       = alicloud_instance.app[*].id
}

# 数据库资源输出
output "mongodb_connection_string" {
  description = "MongoDB连接字符串"
  value       = "mongodb://${alicloud_mongodb_account.main.account_name}:${var.mongodb_password}@${alicloud_mongodb_instance.main.replica_set_name}.mongodb.rds.aliyuncs.com:3717/smart_charging"
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis连接字符串"
  value       = "redis://${alicloud_kvstore_account.main.account_name}:${var.redis_password}@${alicloud_kvstore_instance.main.connection_domain}:6379"
  sensitive   = true
}

output "mongodb_instance_id" {
  description = "MongoDB实例ID"
  value       = alicloud_mongodb_instance.main.id
}

output "redis_instance_id" {
  description = "Redis实例ID"
  value       = alicloud_kvstore_instance.main.id
}

# 存储资源输出
output "static_bucket_name" {
  description = "静态资源OSS存储桶名称"
  value       = alicloud_oss_bucket.static.bucket
}

output "uploads_bucket_name" {
  description = "用户上传OSS存储桶名称"
  value       = alicloud_oss_bucket.uploads.bucket
}

output "backup_bucket_name" {
  description = "备份OSS存储桶名称"
  value       = alicloud_oss_bucket.backup.bucket
}

output "static_bucket_endpoint" {
  description = "静态资源OSS访问端点"
  value       = alicloud_oss_bucket.static.extranet_endpoint
}

output "uploads_bucket_endpoint" {
  description = "用户上传OSS访问端点"
  value       = alicloud_oss_bucket.uploads.extranet_endpoint
}

output "cdn_domain" {
  description = "CDN加速域名"
  value       = alicloud_cdn_domain_new.static.domain_name
}

output "cdn_cname" {
  description = "CDN CNAME记录"
  value       = alicloud_cdn_domain_new.static.cname
}

# SSL和域名输出
output "ssl_certificate_id" {
  description = "SSL证书ID"
  value       = alicloud_ssl_certificates_service_certificate.main.id
}

output "domain_name" {
  description = "主域名"
  value       = alicloud_alidns_domain.main.domain_name
}

output "main_domain_record" {
  description = "主域名A记录"
  value       = "${alicloud_alidns_record.main.rr}.${alicloud_alidns_record.main.domain_name} -> ${alicloud_alidns_record.main.value}"
}

output "www_domain_record" {
  description = "WWW子域名A记录"
  value       = "${alicloud_alidns_record.www.rr}.${alicloud_alidns_record.www.domain_name} -> ${alicloud_alidns_record.www.value}"
}

output "api_domain_record" {
  description = "API子域名CNAME记录"
  value       = "${alicloud_alidns_record.api.rr}.${alicloud_alidns_record.api.domain_name} -> ${alicloud_alidns_record.api.value}"
}

output "static_domain_record" {
  description = "静态资源子域名CNAME记录"
  value       = "${alicloud_alidns_record.static.rr}.${alicloud_alidns_record.static.domain_name} -> ${alicloud_alidns_record.static.value}"
}

# 安全组输出
output "web_security_group_id" {
  description = "Web层安全组ID"
  value       = alicloud_security_group.web.id
}

output "app_security_group_id" {
  description = "应用层安全组ID"
  value       = alicloud_security_group.app.id
}

output "db_security_group_id" {
  description = "数据库层安全组ID"
  value       = alicloud_security_group.db.id
}

# 部署信息汇总
output "deployment_summary" {
  description = "部署信息汇总"
  value = {
    region                = var.region
    project_name         = var.project_name
    environment          = var.environment
    vpc_cidr            = alicloud_vpc.main.cidr_block
    web_subnet_cidr     = alicloud_vswitch.web.cidr_block
    app_subnet_cidr     = alicloud_vswitch.app.cidr_block
    db_subnet_cidr      = alicloud_vswitch.db.cidr_block
    load_balancer_ip    = alicloud_slb_load_balancer.web.address
    web_instance_count  = length(alicloud_instance.web)
    app_instance_count  = length(alicloud_instance.app)
    mongodb_version     = alicloud_mongodb_instance.main.engine_version
    redis_version       = alicloud_kvstore_instance.main.engine_version
  }
}