"""OCPP协议错误处理和重试机制
增强OCPP协议的错误处理、超时管理和重试逻辑
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
import json

from config import OCPP_CONFIG, ERROR_CODE_MAPPING

logger = logging.getLogger(__name__)

class RetryStrategy(Enum):
    """重试策略"""
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    FIXED_INTERVAL = "fixed_interval"
    LINEAR_BACKOFF = "linear_backoff"

class OCPPErrorType(Enum):
    """OCPP错误类型"""
    COMMUNICATION_ERROR = "communication_error"
    TIMEOUT_ERROR = "timeout_error"
    PROTOCOL_ERROR = "protocol_error"
    VALIDATION_ERROR = "validation_error"
    INTERNAL_ERROR = "internal_error"
    CHARGER_ERROR = "charger_error"

class OCPPErrorHandler:
    """OCPP错误处理器"""
    
    def __init__(self):
        self.error_stats: Dict[str, Dict] = {}
        self.retry_configs = {
            "RemoteStartTransaction": {
                "max_retries": 3,
                "strategy": RetryStrategy.EXPONENTIAL_BACKOFF,
                "base_delay": 2.0,
                "max_delay": 30.0,
                "timeout": 30.0
            },
            "RemoteStopTransaction": {
                "max_retries": 3,
                "strategy": RetryStrategy.EXPONENTIAL_BACKOFF,
                "base_delay": 2.0,
                "max_delay": 30.0,
                "timeout": 30.0
            },
            "Reset": {
                "max_retries": 2,
                "strategy": RetryStrategy.FIXED_INTERVAL,
                "base_delay": 5.0,
                "max_delay": 60.0,
                "timeout": 60.0
            },
            "UnlockConnector": {
                "max_retries": 2,
                "strategy": RetryStrategy.LINEAR_BACKOFF,
                "base_delay": 3.0,
                "max_delay": 15.0,
                "timeout": 20.0
            },
            "default": {
                "max_retries": 2,
                "strategy": RetryStrategy.EXPONENTIAL_BACKOFF,
                "base_delay": 1.0,
                "max_delay": 10.0,
                "timeout": 30.0
            }
        }
    
    def get_retry_config(self, action: str) -> Dict:
        """获取重试配置"""
        return self.retry_configs.get(action, self.retry_configs["default"])
    
    def calculate_delay(self, attempt: int, strategy: RetryStrategy, base_delay: float, max_delay: float) -> float:
        """计算重试延迟时间"""
        if strategy == RetryStrategy.EXPONENTIAL_BACKOFF:
            delay = base_delay * (2 ** attempt)
        elif strategy == RetryStrategy.LINEAR_BACKOFF:
            delay = base_delay * (attempt + 1)
        else:  # FIXED_INTERVAL
            delay = base_delay
        
        return min(delay, max_delay)
    
    async def execute_with_retry(self, 
                               action: str,
                               pile_id: str,
                               operation: Callable,
                               *args, **kwargs) -> Dict:
        """带重试机制的操作执行"""
        config = self.get_retry_config(action)
        max_retries = config["max_retries"]
        strategy = config["strategy"]
        base_delay = config["base_delay"]
        max_delay = config["max_delay"]
        timeout = config["timeout"]
        
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                # 执行操作，带超时控制
                result = await asyncio.wait_for(
                    operation(*args, **kwargs),
                    timeout=timeout
                )
                
                # 成功执行，记录统计信息
                self._record_success(pile_id, action, attempt)
                return result
                
            except asyncio.TimeoutError as e:
                last_error = e
                error_type = OCPPErrorType.TIMEOUT_ERROR
                logger.warning(f"操作超时: {action} - {pile_id}, 尝试 {attempt + 1}/{max_retries + 1}")
                
            except ConnectionError as e:
                last_error = e
                error_type = OCPPErrorType.COMMUNICATION_ERROR
                logger.warning(f"通信错误: {action} - {pile_id}, 尝试 {attempt + 1}/{max_retries + 1}: {e}")
                
            except ValueError as e:
                last_error = e
                error_type = OCPPErrorType.VALIDATION_ERROR
                logger.error(f"验证错误: {action} - {pile_id}: {e}")
                break  # 验证错误不重试
                
            except Exception as e:
                last_error = e
                error_type = OCPPErrorType.INTERNAL_ERROR
                logger.error(f"内部错误: {action} - {pile_id}, 尝试 {attempt + 1}/{max_retries + 1}: {e}")
            
            # 记录错误统计
            self._record_error(pile_id, action, error_type, attempt)
            
            # 如果还有重试机会，等待后重试
            if attempt < max_retries:
                delay = self.calculate_delay(attempt, strategy, base_delay, max_delay)
                logger.info(f"等待 {delay:.2f} 秒后重试...")
                await asyncio.sleep(delay)
        
        # 所有重试都失败了
        logger.error(f"操作最终失败: {action} - {pile_id}, 已尝试 {max_retries + 1} 次")
        raise last_error
    
    def _record_success(self, pile_id: str, action: str, attempts: int):
        """记录成功统计"""
        key = f"{pile_id}:{action}"
        if key not in self.error_stats:
            self.error_stats[key] = {
                "success_count": 0,
                "error_count": 0,
                "last_success": None,
                "last_error": None,
                "total_attempts": 0
            }
        
        stats = self.error_stats[key]
        stats["success_count"] += 1
        stats["last_success"] = datetime.now()
        stats["total_attempts"] += attempts + 1
    
    def _record_error(self, pile_id: str, action: str, error_type: OCPPErrorType, attempt: int):
        """记录错误统计"""
        key = f"{pile_id}:{action}"
        if key not in self.error_stats:
            self.error_stats[key] = {
                "success_count": 0,
                "error_count": 0,
                "last_success": None,
                "last_error": None,
                "total_attempts": 0,
                "error_types": {}
            }
        
        stats = self.error_stats[key]
        stats["error_count"] += 1
        stats["last_error"] = {
            "timestamp": datetime.now(),
            "type": error_type.value,
            "attempt": attempt
        }
        
        # 记录错误类型统计
        if "error_types" not in stats:
            stats["error_types"] = {}
        
        error_type_key = error_type.value
        if error_type_key not in stats["error_types"]:
            stats["error_types"][error_type_key] = 0
        stats["error_types"][error_type_key] += 1
    
    def get_pile_health_status(self, pile_id: str) -> Dict:
        """获取充电桩健康状态"""
        pile_stats = {}
        
        for key, stats in self.error_stats.items():
            if key.startswith(f"{pile_id}:"):
                action = key.split(":", 1)[1]
                pile_stats[action] = stats
        
        if not pile_stats:
            return {"status": "unknown", "message": "无统计数据"}
        
        # 计算总体健康状态
        total_success = sum(stats["success_count"] for stats in pile_stats.values())
        total_error = sum(stats["error_count"] for stats in pile_stats.values())
        total_operations = total_success + total_error
        
        if total_operations == 0:
            return {"status": "unknown", "message": "无操作记录"}
        
        success_rate = total_success / total_operations
        
        if success_rate >= 0.95:
            status = "healthy"
            message = "充电桩运行正常"
        elif success_rate >= 0.80:
            status = "warning"
            message = "充电桩偶有异常，需要关注"
        else:
            status = "critical"
            message = "充电桩异常频繁，需要检修"
        
        return {
            "status": status,
            "message": message,
            "success_rate": success_rate,
            "total_operations": total_operations,
            "statistics": pile_stats
        }
    
    def get_error_statistics(self) -> Dict:
        """获取错误统计信息"""
        return {
            "total_piles": len(set(key.split(":")[0] for key in self.error_stats.keys())),
            "total_operations": sum(
                stats["success_count"] + stats["error_count"] 
                for stats in self.error_stats.values()
            ),
            "total_errors": sum(stats["error_count"] for stats in self.error_stats.values()),
            "error_details": self.error_stats
        }
    
    def clear_old_statistics(self, days: int = 7):
        """清理旧的统计数据"""
        cutoff_date = datetime.now() - timedelta(days=days)
        
        keys_to_remove = []
        for key, stats in self.error_stats.items():
            last_activity = max(
                stats.get("last_success", datetime.min),
                stats.get("last_error", {}).get("timestamp", datetime.min)
            )
            
            if last_activity < cutoff_date:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.error_stats[key]
        
        logger.info(f"清理了 {len(keys_to_remove)} 条旧统计数据")
    
    async def handle_connection_error(self, pile_id: str, error: Exception):
        """处理连接错误"""
        error_type = OCPPErrorType.COMMUNICATION_ERROR
        
        if "timeout" in str(error).lower():
            error_type = OCPPErrorType.TIMEOUT_ERROR
        elif "connection" in str(error).lower():
            error_type = OCPPErrorType.COMMUNICATION_ERROR
        
        # 记录连接错误
        self._record_error(pile_id, "connection", error_type, 0)
        
        logger.error(f"充电桩 {pile_id} 连接错误: {error}")
    
    async def handle_ocpp_error(self, pile_id: str, message: Any, error: Exception) -> Optional[Dict]:
        """处理OCPP协议错误"""
        error_type = OCPPErrorType.PROTOCOL_ERROR
        
        if isinstance(error, ValueError):
            error_type = OCPPErrorType.VALIDATION_ERROR
        elif isinstance(error, asyncio.TimeoutError):
            error_type = OCPPErrorType.TIMEOUT_ERROR
        elif "connection" in str(error).lower():
            error_type = OCPPErrorType.COMMUNICATION_ERROR
        
        # 记录OCPP错误
        action = "unknown"
        try:
            if isinstance(message, dict):
                action = message.get("action", "unknown")
            elif isinstance(message, str):
                import json
                parsed = json.loads(message)
                if len(parsed) >= 3 and parsed[0] == 2:
                    action = parsed[2]
        except:
            pass
        
        self._record_error(pile_id, action, error_type, 0)
        
        logger.error(f"充电桩 {pile_id} OCPP错误 ({action}): {error}")
        
        # 返回错误响应
        if error_type == OCPPErrorType.VALIDATION_ERROR:
            return {
                "type": "error",
                "code": "FormatViolation",
                "message": f"消息格式错误: {str(error)}",
                "timestamp": datetime.now().isoformat()
            }
        elif error_type == OCPPErrorType.TIMEOUT_ERROR:
            return {
                "type": "error",
                "code": "GenericError",
                "message": "操作超时",
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "type": "error",
                "code": "InternalError",
                "message": f"内部处理错误: {str(error)}",
                "timestamp": datetime.now().isoformat()
            }

class OCPPMessageValidator:
    """OCPP消息验证器"""
    
    def __init__(self):
        self.required_fields = {
            "BootNotification": ["chargePointVendor", "chargePointModel"],
            "StatusNotification": ["connectorId", "status", "errorCode"],
            "StartTransaction": ["connectorId", "idTag", "meterStart", "timestamp"],
            "StopTransaction": ["transactionId", "meterStop", "timestamp"],
            "Heartbeat": [],
            "MeterValues": ["connectorId", "meterValue"],
            "Authorize": ["idTag"],
            "RemoteStartTransaction": ["connectorId", "idTag"],
            "RemoteStopTransaction": ["transactionId"],
            "Reset": ["type"],
            "UnlockConnector": ["connectorId"]
        }
    
    def validate_message(self, action: str, payload: Dict) -> bool:
        """验证OCPP消息格式"""
        if action not in self.required_fields:
            logger.warning(f"未知的OCPP操作: {action}")
            return False
        
        required = self.required_fields[action]
        
        for field in required:
            if field not in payload:
                logger.error(f"缺少必需字段 '{field}' 在 {action} 消息中")
                return False
        
        # 特定字段验证
        if action in ["StartTransaction", "StopTransaction", "MeterValues"]:
            if not self._validate_timestamp(payload.get("timestamp")):
                return False
        
        if action in ["StatusNotification", "StartTransaction", "StopTransaction", "MeterValues", "RemoteStartTransaction", "UnlockConnector"]:
            if not self._validate_connector_id(payload.get("connectorId")):
                return False
        
        return True
    
    def _validate_timestamp(self, timestamp: str) -> bool:
        """验证时间戳格式"""
        if not timestamp:
            return False
        
        try:
            datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            return True
        except (ValueError, AttributeError):
            logger.error(f"无效的时间戳格式: {timestamp}")
            return False
    
    def _validate_connector_id(self, connector_id: Any) -> bool:
        """验证连接器ID"""
        if not isinstance(connector_id, int) or connector_id < 0:
            logger.error(f"无效的连接器ID: {connector_id}")
            return False
        return True

# 全局实例
error_handler = OCPPErrorHandler()
message_validator = OCPPMessageValidator()