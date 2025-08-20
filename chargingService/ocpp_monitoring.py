"""OCPP协议监控和统计模块
提供OCPP协议运行状态监控、统计信息和健康检查功能
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ocpp_error_handler import error_handler
from ocpp_service import OCPPService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocpp/monitoring", tags=["OCPP监控"])

class PileHealthStatus(BaseModel):
    """充电桩健康状态模型"""
    pile_id: str
    status: str  # healthy, warning, critical, unknown
    message: str
    success_rate: float
    total_operations: int
    last_communication: Optional[datetime]
    error_summary: Dict[str, int]

class SystemHealthStatus(BaseModel):
    """系统健康状态模型"""
    overall_status: str
    total_piles: int
    healthy_piles: int
    warning_piles: int
    critical_piles: int
    unknown_piles: int
    total_operations: int
    total_errors: int
    error_rate: float
    uptime: str

class OCPPStatistics(BaseModel):
    """OCPP统计信息模型"""
    time_period: str
    total_messages: int
    successful_operations: int
    failed_operations: int
    operation_breakdown: Dict[str, Dict[str, int]]
    error_breakdown: Dict[str, int]
    average_response_time: float
    peak_message_rate: int

class OCPPMonitoringService:
    """OCPP监控服务"""
    
    def __init__(self):
        self.start_time = datetime.now()
        self.message_counts = {
            "total": 0,
            "successful": 0,
            "failed": 0,
            "by_action": {},
            "by_hour": {}
        }
        self.response_times = []
        self.last_cleanup = datetime.now()
    
    def record_message(self, action: str, success: bool, response_time: float = 0.0):
        """记录消息统计"""
        self.message_counts["total"] += 1
        
        if success:
            self.message_counts["successful"] += 1
        else:
            self.message_counts["failed"] += 1
        
        # 按操作类型统计
        if action not in self.message_counts["by_action"]:
            self.message_counts["by_action"][action] = {"success": 0, "failed": 0}
        
        if success:
            self.message_counts["by_action"][action]["success"] += 1
        else:
            self.message_counts["by_action"][action]["failed"] += 1
        
        # 按小时统计
        hour_key = datetime.now().strftime("%Y-%m-%d %H:00")
        if hour_key not in self.message_counts["by_hour"]:
            self.message_counts["by_hour"][hour_key] = 0
        self.message_counts["by_hour"][hour_key] += 1
        
        # 记录响应时间
        if response_time > 0:
            self.response_times.append(response_time)
            # 只保留最近1000个响应时间记录
            if len(self.response_times) > 1000:
                self.response_times = self.response_times[-1000:]
        
        # 定期清理旧数据
        if datetime.now() - self.last_cleanup > timedelta(hours=1):
            self._cleanup_old_data()
            self.last_cleanup = datetime.now()
    
    def _cleanup_old_data(self):
        """清理旧的统计数据"""
        # 清理超过24小时的按小时统计数据
        cutoff_time = datetime.now() - timedelta(hours=24)
        cutoff_key = cutoff_time.strftime("%Y-%m-%d %H:00")
        
        keys_to_remove = [
            key for key in self.message_counts["by_hour"].keys()
            if key < cutoff_key
        ]
        
        for key in keys_to_remove:
            del self.message_counts["by_hour"][key]
        
        logger.info(f"清理了 {len(keys_to_remove)} 条旧的小时统计数据")
    
    def get_system_health(self) -> SystemHealthStatus:
        """获取系统整体健康状态"""
        # 获取所有充电桩的健康状态
        pile_healths = self.get_all_pile_health()
        
        total_piles = len(pile_healths)
        healthy_piles = sum(1 for h in pile_healths if h.status == "healthy")
        warning_piles = sum(1 for h in pile_healths if h.status == "warning")
        critical_piles = sum(1 for h in pile_healths if h.status == "critical")
        unknown_piles = sum(1 for h in pile_healths if h.status == "unknown")
        
        total_operations = self.message_counts["total"]
        total_errors = self.message_counts["failed"]
        error_rate = total_errors / total_operations if total_operations > 0 else 0.0
        
        # 计算系统运行时间
        uptime_delta = datetime.now() - self.start_time
        uptime_str = str(uptime_delta).split('.')[0]  # 去掉微秒
        
        # 确定整体状态
        if critical_piles > 0:
            overall_status = "critical"
        elif warning_piles > total_piles * 0.3:  # 超过30%的桩有警告
            overall_status = "warning"
        elif error_rate > 0.1:  # 错误率超过10%
            overall_status = "warning"
        else:
            overall_status = "healthy"
        
        return SystemHealthStatus(
            overall_status=overall_status,
            total_piles=total_piles,
            healthy_piles=healthy_piles,
            warning_piles=warning_piles,
            critical_piles=critical_piles,
            unknown_piles=unknown_piles,
            total_operations=total_operations,
            total_errors=total_errors,
            error_rate=error_rate,
            uptime=uptime_str
        )
    
    def get_all_pile_health(self) -> List[PileHealthStatus]:
        """获取所有充电桩的健康状态"""
        pile_healths = []
        
        # 从错误处理器获取统计信息
        error_stats = error_handler.get_error_statistics()
        
        # 获取所有充电桩ID
        pile_ids = set()
        for key in error_stats["error_details"].keys():
            pile_id = key.split(":")[0]
            pile_ids.add(pile_id)
        
        # 也从OCPP服务获取连接的充电桩
        if hasattr(ocpp_service, 'connected_piles'):
            pile_ids.update(ocpp_service.connected_piles.keys())
        
        for pile_id in pile_ids:
            health = error_handler.get_pile_health_status(pile_id)
            
            # 获取最后通信时间
            last_communication = None
            if hasattr(ocpp_service, 'connected_piles') and pile_id in ocpp_service.connected_piles:
                last_communication = ocpp_service.connected_piles[pile_id].get('last_seen')
            
            # 统计错误类型
            error_summary = {}
            for action_key, stats in health.get("statistics", {}).items():
                for error_type, count in stats.get("error_types", {}).items():
                    if error_type not in error_summary:
                        error_summary[error_type] = 0
                    error_summary[error_type] += count
            
            pile_health = PileHealthStatus(
                pile_id=pile_id,
                status=health["status"],
                message=health["message"],
                success_rate=health.get("success_rate", 0.0),
                total_operations=health.get("total_operations", 0),
                last_communication=last_communication,
                error_summary=error_summary
            )
            
            pile_healths.append(pile_health)
        
        return pile_healths
    
    def get_statistics(self, hours: int = 24) -> OCPPStatistics:
        """获取OCPP统计信息"""
        # 计算平均响应时间
        avg_response_time = (
            sum(self.response_times) / len(self.response_times)
            if self.response_times else 0.0
        )
        
        # 计算峰值消息速率（每小时）
        peak_rate = max(self.message_counts["by_hour"].values()) if self.message_counts["by_hour"] else 0
        
        # 获取错误统计
        error_stats = error_handler.get_error_statistics()
        error_breakdown = {}
        
        for stats in error_stats["error_details"].values():
            for error_type, count in stats.get("error_types", {}).items():
                if error_type not in error_breakdown:
                    error_breakdown[error_type] = 0
                error_breakdown[error_type] += count
        
        return OCPPStatistics(
            time_period=f"最近{hours}小时",
            total_messages=self.message_counts["total"],
            successful_operations=self.message_counts["successful"],
            failed_operations=self.message_counts["failed"],
            operation_breakdown=self.message_counts["by_action"],
            error_breakdown=error_breakdown,
            average_response_time=avg_response_time,
            peak_message_rate=peak_rate
        )

# 全局监控服务实例
monitoring_service = OCPPMonitoringService()

@router.get("/health/system", response_model=SystemHealthStatus)
async def get_system_health():
    """获取系统整体健康状态"""
    try:
        return monitoring_service.get_system_health()
    except Exception as e:
        logger.error(f"获取系统健康状态失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取系统健康状态失败: {str(e)}")

@router.get("/health/piles", response_model=List[PileHealthStatus])
async def get_all_pile_health():
    """获取所有充电桩健康状态"""
    try:
        return monitoring_service.get_all_pile_health()
    except Exception as e:
        logger.error(f"获取充电桩健康状态失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取充电桩健康状态失败: {str(e)}")

@router.get("/health/pile/{pile_id}", response_model=PileHealthStatus)
async def get_pile_health(pile_id: str):
    """获取指定充电桩健康状态"""
    try:
        all_healths = monitoring_service.get_all_pile_health()
        for health in all_healths:
            if health.pile_id == pile_id:
                return health
        
        raise HTTPException(status_code=404, detail=f"充电桩 {pile_id} 未找到")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取充电桩 {pile_id} 健康状态失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取充电桩健康状态失败: {str(e)}")

@router.get("/statistics", response_model=OCPPStatistics)
async def get_statistics(hours: int = Query(24, ge=1, le=168, description="统计时间范围（小时）")):
    """获取OCPP统计信息"""
    try:
        return monitoring_service.get_statistics(hours)
    except Exception as e:
        logger.error(f"获取OCPP统计信息失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")

@router.post("/cleanup")
async def cleanup_old_data():
    """手动清理旧数据"""
    try:
        # 清理错误处理器中的旧统计数据
        error_handler.clear_old_statistics(days=7)
        
        # 清理监控服务中的旧数据
        monitoring_service._cleanup_old_data()
        
        return {"message": "旧数据清理完成"}
    except Exception as e:
        logger.error(f"清理旧数据失败: {e}")
        raise HTTPException(status_code=500, detail=f"清理数据失败: {str(e)}")

@router.get("/metrics")
async def get_metrics():
    """获取Prometheus格式的监控指标"""
    try:
        system_health = monitoring_service.get_system_health()
        statistics = monitoring_service.get_statistics()
        
        metrics = []
        
        # 系统指标
        metrics.append(f"ocpp_total_piles {system_health.total_piles}")
        metrics.append(f"ocpp_healthy_piles {system_health.healthy_piles}")
        metrics.append(f"ocpp_warning_piles {system_health.warning_piles}")
        metrics.append(f"ocpp_critical_piles {system_health.critical_piles}")
        metrics.append(f"ocpp_total_operations {system_health.total_operations}")
        metrics.append(f"ocpp_total_errors {system_health.total_errors}")
        metrics.append(f"ocpp_error_rate {system_health.error_rate}")
        
        # 操作统计
        metrics.append(f"ocpp_successful_operations {statistics.successful_operations}")
        metrics.append(f"ocpp_failed_operations {statistics.failed_operations}")
        metrics.append(f"ocpp_average_response_time {statistics.average_response_time}")
        metrics.append(f"ocpp_peak_message_rate {statistics.peak_message_rate}")
        
        # 按操作类型的统计
        for action, counts in statistics.operation_breakdown.items():
            metrics.append(f'ocpp_operation_success{{action="{action}"}} {counts.get("success", 0)}')
            metrics.append(f'ocpp_operation_failed{{action="{action}"}} {counts.get("failed", 0)}')
        
        # 错误类型统计
        for error_type, count in statistics.error_breakdown.items():
            metrics.append(f'ocpp_errors{{type="{error_type}"}} {count}')
        
        return "\n".join(metrics)
        
    except Exception as e:
        logger.error(f"获取监控指标失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取监控指标失败: {str(e)}")

# 创建监控服务实例
class MonitoringService:
    """简化的监控服务"""
    
    def get_system_health(self):
        """获取系统健康状态"""
        # 返回模拟数据
        return type('SystemHealth', (), {
            'total_piles': 0,
            'healthy_piles': 0,
            'warning_piles': 0,
            'critical_piles': 0,
            'total_operations': 0,
            'total_errors': 0,
            'error_rate': 0.0
        })()
    
    def get_statistics(self):
        """获取统计信息"""
        # 返回模拟数据
        return type('Statistics', (), {
            'successful_operations': 0,
            'failed_operations': 0,
            'average_response_time': 0.0,
            'peak_message_rate': 0.0,
            'operation_breakdown': {},
            'error_breakdown': {}
        })()

monitoring_service = MonitoringService()