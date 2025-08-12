# 阿里云数据库配置

# MongoDB云数据库实例
resource "alicloud_mongodb_instance" "main" {
  engine_version      = "4.4"
  db_instance_class   = "dds.mongo.mid"
  db_instance_storage = 20
  name                = "${var.project_name}-mongodb"
  vswitch_id          = alicloud_vswitch.db.id
  security_ip_list    = ["10.2.0.0/24"]
  
  tags = {
    Name        = "${var.project_name}-mongodb"
    Environment = var.environment
    Service     = "database"
  }
}

# MongoDB数据库账号
resource "alicloud_mongodb_account" "main" {
  account_name        = "smartcharging"
  account_password    = var.mongodb_password
  instance_id         = alicloud_mongodb_instance.main.id
  account_description = "智能充电应用数据库账号"
}

# Redis云数据库实例
resource "alicloud_kvstore_instance" "main" {
  instance_class   = "redis.master.small.default"
  instance_name    = "${var.project_name}-redis"
  vswitch_id       = alicloud_vswitch.db.id
  private_ip       = "10.3.0.10"
  security_ips     = ["10.2.0.0/24"]
  instance_type    = "Redis"
  engine_version   = "5.0"
  config = {
    "maxmemory-policy" = "allkeys-lru"
    "timeout"          = "300"
  }
  
  tags = {
    Name        = "${var.project_name}-redis"
    Environment = var.environment
    Service     = "cache"
  }
}

# Redis账号
resource "alicloud_kvstore_account" "main" {
  account_name     = "smartcharging"
  account_password = var.redis_password
  instance_id      = alicloud_kvstore_instance.main.id
  account_type     = "Normal"
  account_privilege = "RoleReadWrite"
  description      = "智能充电应用Redis账号"
}

# 数据库备份策略
resource "alicloud_mongodb_backup_policy" "main" {
  instance_id   = alicloud_mongodb_instance.main.id
  backup_time   = "02:00Z-03:00Z"
  backup_period = ["Monday", "Wednesday", "Friday"]
  retention_period = 7
}

# 变量定义
variable "mongodb_password" {
  description = "MongoDB数据库密码"
  type        = string
  sensitive   = true
  default     = "SmartCharging2024!"
}

variable "redis_password" {
  description = "Redis数据库密码"
  type        = string
  sensitive   = true
  default     = "SmartCharging2024!"
}

# 输出
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