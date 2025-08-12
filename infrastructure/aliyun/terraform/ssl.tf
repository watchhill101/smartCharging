# SSL证书配置

# 创建SSL证书
resource "alicloud_ssl_certificates_service_certificate" "main" {
  certificate_name = "${var.project_name}-ssl-cert"
  cert             = file("${path.module}/certs/domain.crt")
  key              = file("${path.module}/certs/domain.key")
  
  tags = {
    Name        = "${var.project_name}-ssl-cert"
    Environment = var.environment
  }
}

# 域名解析配置
resource "alicloud_alidns_domain" "main" {
  domain_name = var.domain_name
  
  tags = {
    Name        = "${var.project_name}-domain"
    Environment = var.environment
  }
}

# A记录 - 主域名指向负载均衡器
resource "alicloud_alidns_record" "main" {
  domain_name = alicloud_alidns_domain.main.domain_name
  rr          = "@"
  type        = "A"
  value       = alicloud_slb_load_balancer.web.address
  ttl         = 600
}

# A记录 - www子域名指向负载均衡器
resource "alicloud_alidns_record" "www" {
  domain_name = alicloud_alidns_domain.main.domain_name
  rr          = "www"
  type        = "A"
  value       = alicloud_slb_load_balancer.web.address
  ttl         = 600
}

# CNAME记录 - API子域名指向负载均衡器
resource "alicloud_alidns_record" "api" {
  domain_name = alicloud_alidns_domain.main.domain_name
  rr          = "api"
  type        = "CNAME"
  value       = alicloud_slb_load_balancer.web.address
  ttl         = 600
}

# CNAME记录 - 静态资源CDN
resource "alicloud_alidns_record" "static" {
  domain_name = alicloud_alidns_domain.main.domain_name
  rr          = "static"
  type        = "CNAME"
  value       = alicloud_cdn_domain_new.static.cname
  ttl         = 600
}

# MX记录 - 邮件服务（可选）
resource "alicloud_alidns_record" "mx" {
  domain_name = alicloud_alidns_domain.main.domain_name
  rr          = "@"
  type        = "MX"
  value       = "10 mail.${var.domain_name}"
  ttl         = 600
}

# TXT记录 - SPF记录（可选）
resource "alicloud_alidns_record" "spf" {
  domain_name = alicloud_alidns_domain.main.domain_name
  rr          = "@"
  type        = "TXT"
  value       = "v=spf1 include:_spf.${var.domain_name} ~all"
  ttl         = 600
}

# 输出
output "ssl_certificate_id" {
  description = "SSL证书ID"
  value       = alicloud_ssl_certificates_service_certificate.main.id
}

output "domain_name" {
  description = "域名"
  value       = alicloud_alidns_domain.main.domain_name
}

output "main_domain_record" {
  description = "主域名A记录"
  value       = "${alicloud_alidns_record.main.rr}.${alicloud_alidns_record.main.domain_name} -> ${alicloud_alidns_record.main.value}"
}

output "www_domain_record" {
  description = "WWW域名A记录"
  value       = "${alicloud_alidns_record.www.rr}.${alicloud_alidns_record.www.domain_name} -> ${alicloud_alidns_record.www.value}"
}

output "api_domain_record" {
  description = "API域名CNAME记录"
  value       = "${alicloud_alidns_record.api.rr}.${alicloud_alidns_record.api.domain_name} -> ${alicloud_alidns_record.api.value}"
}

output "static_domain_record" {
  description = "静态资源域名CNAME记录"
  value       = "${alicloud_alidns_record.static.rr}.${alicloud_alidns_record.static.domain_name} -> ${alicloud_alidns_record.static.value}"
}