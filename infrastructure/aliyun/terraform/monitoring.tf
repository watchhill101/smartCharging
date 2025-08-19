# 阿里云监控配置

# 云监控报警联系人组
resource "alicloud_cms_alarm_contact_group" "main" {
  alarm_contact_group_name = "${var.project_name}-alert-group"
  describe                 = "智能充电应用监控报警联系人组"
  
  contacts = [
    "admin@smartcharging.com",
    "ops@smartcharging.com"
  ]
}

# ECS实例监控报警 - CPU使用率
resource "alicloud_cms_alarm" "ecs_cpu_high" {
  count = length(concat(alicloud_instance.web, alicloud_instance.app))
  
  name         = "${var.project_name}-ecs-cpu-high-${count.index}"
  project      = "acs_ecs_dashboard"
  metric       = "CPUUtilization"
  dimensions = {
    instanceId = concat(alicloud_instance.web, alicloud_instance.app)[count.index].id
  }
  
  statistics          = "Average"
  period              = 300
  operator            = "GreaterThanThreshold"
  threshold           = "80"
  triggered_count     = 3
  contact_groups      = [alicloud_cms_alarm_contact_group.main.id]
  effective_interval  = "00:00-23:59"
  
  webhook = "https://api.smartcharging.com/webhook/alert"
  
  tags = merge(var.common_tags, {
    AlertType = "cpu-high"
  })
}

# ECS实例监控报警 - 内存使用率
resource "alicloud_cms_alarm" "ecs_memory_high" {
  count = length(concat(alicloud_instance.web, alicloud_instance.app))
  
  name         = "${var.project_name}-ecs-memory-high-${count.index}"
  project      = "acs_ecs_dashboard"
  metric       = "memory_usedutilization"
  dimensions = {
    instanceId = concat(alicloud_instance.web, alicloud_instance.app)[count.index].id
  }
  
  statistics          = "Average"
  period              = 300
  operator            = "GreaterThanThreshold"
  threshold           = "85"
  triggered_count     = 3
  contact_groups      = [alicloud_cms_alarm_contact_group.main.id]
  effective_interval  = "00:00-23:59"
  
  tags = merge(var.common_tags, {
    AlertType = "memory-high"
  })
}

# ECS实例监控报警 - 磁盘使用率
resource "alicloud_cms_alarm" "ecs_disk_high" {
  count = length(concat(alicloud_instance.web, alicloud_instance.app))
  
  name         = "${var.project_name}-ecs-disk-high-${count.index}"
  project      = "acs_ecs_dashboard"
  metric       = "diskusage_utilization"
  dimensions = {
    instanceId = concat(alicloud_instance.web, alicloud_instance.app)[count.index].id
    device     = "/dev/vda1"
  }
  
  statistics          = "Average"
  period              = 300
  operator            = "GreaterThanThreshold"
  threshold           = "85"
  triggered_count     = 2
  contact_groups      = [alicloud_cms_alarm_contact_group.main.id]
  effective_interval  = "00:00-23:59"
  
  tags = merge(var.common_tags, {
    AlertType = "disk-high"
  })
}

# 负载均衡器监控报警 - 健康检查失败
resource "alicloud_cms_alarm" "slb_unhealthy_server" {
  name         = "${var.project_name}-slb-unhealthy-server"
  project      = "acs_slb_dashboard"
  metric       = "UnhealthyServerCount"
  dimensions = {
    instanceId = alicloud_slb_load_balancer.web.id
  }
  
  statistics          = "Maximum"
  period              = 60
  operator            = "GreaterThanThreshold"
  threshold           = "0"
  triggered_count     = 2
  contact_groups      = [alicloud_cms_alarm_contact_group.main.id]
  effective_interval  = "00:00-23:59"
  
  tags = merge(var.common_tags, {
    AlertType = "slb-unhealthy"
  })
}

# MongoDB监控报警 - CPU使用率
resource "alicloud_cms_alarm" "mongodb_cpu_high" {
  name         = "${var.project_name}-mongodb-cpu-high"
  project      = "acs_mongodb"
  metric       = "CPUUtilization"
  dimensions = {
    instanceId = alicloud_mongodb_instance.main.id
  }
  
  statistics          = "Average"
  period              = 300
  operator            = "GreaterThanThreshold"
  threshold           = "80"
  triggered_count     = 3
  contact_groups      = [alicloud_cms_alarm_contact_group.main.id]
  effective_interval  = "00:00-23:59"
  
  tags = merge(var.common_tags, {
    AlertType = "mongodb-cpu-high"
  })
}

# MongoDB监控报警 - 连接数
resource "alicloud_cms_alarm" "mongodb_connections_high" {
  name         = "${var.project_name}-mongodb-connections-high"
  project      = "acs_mongodb"
  metric       = "ConnectionAmount"
  dimensions = {
    instanceId = alicloud_mongodb_instance.main.id
  }
  
  statistics          = "Average"
  period              = 300
  operator            = "GreaterThanThreshold"
  threshold           = "80"
  triggered_count     = 3
  contact_groups      = [alicloud_cms_alarm_contact_group.main.id]
  effective_interval  = "00:00-23:59"
  
  tags = merge(var.common_tags, {
    AlertType = "mongodb-connections-high"
  })
}

# Redis监控报警 - 内存使用率
resource "alicloud_cms_alarm" "redis_memory_high" {
  name         = "${var.project_name}-redis-memory-high"
  project      = "acs_kvstore"
  metric       = "MemoryUsage"
  dimensions = {
    instanceId = alicloud_kvstore_instance.main.id
  }
  
  statistics          = "Average"
  period              = 300
  operator            = "GreaterThanThreshold"
  threshold           = "85"
  triggered_count     = 3
  contact_groups      = [alicloud_cms_alarm_contact_group.main.id]
  effective_interval  = "00:00-23:59"
  
  tags = merge(var.common_tags, {
    AlertType = "redis-memory-high"
  })
}

# Redis监控报警 - 连接数
resource "alicloud_cms_alarm" "redis_connections_high" {
  name         = "${var.project_name}-redis-connections-high"
  project      = "acs_kvstore"
  metric       = "ConnectionUsage"
  dimensions = {
    instanceId = alicloud_kvstore_instance.main.id
  }
  
  statistics          = "Average"
  period              = 300
  operator            = "GreaterThanThreshold"
  threshold           = "80"
  triggered_count     = 3
  contact_groups      = [alicloud_cms_alarm_contact_group.main.id]
  effective_interval  = "00:00-23:59"
  
  tags = merge(var.common_tags, {
    AlertType = "redis-connections-high"
  })
}

# 自定义监控指标 - 应用响应时间
resource "alicloud_cms_alarm" "app_response_time_high" {
  name         = "${var.project_name}-app-response-time-high"
  project      = "acs_custommetric"
  metric       = "ResponseTime"
  dimensions = {
    service = "smart-charging-api"
  }
  
  statistics          = "Average"
  period              = 300
  operator            = "GreaterThanThreshold"
  threshold           = "2000"
  triggered_count     = 3
  contact_groups      = [alicloud_cms_alarm_contact_group.main.id]
  effective_interval  = "00:00-23:59"
  
  tags = merge(var.common_tags, {
    AlertType = "app-response-time-high"
  })
}

# 自定义监控指标 - 应用错误率
resource "alicloud_cms_alarm" "app_error_rate_high" {
  name         = "${var.project_name}-app-error-rate-high"
  project      = "acs_custommetric"
  metric       = "ErrorRate"
  dimensions = {
    service = "smart-charging-api"
  }
  
  statistics          = "Average"
  period              = 300
  operator            = "GreaterThanThreshold"
  threshold           = "5"
  triggered_count     = 2
  contact_groups      = [alicloud_cms_alarm_contact_group.main.id]
  effective_interval  = "00:00-23:59"
  
  tags = merge(var.common_tags, {
    AlertType = "app-error-rate-high"
  })
}

# 输出监控信息
output "monitoring_dashboard_url" {
  description = "云监控控制台URL"
  value       = "https://cms.console.aliyun.com/metric-meta/acs_ecs_dashboard/instanceId"
}

output "alarm_contact_group_id" {
  description = "报警联系人组ID"
  value       = alicloud_cms_alarm_contact_group.main.id
}