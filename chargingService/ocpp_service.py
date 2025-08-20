"""
OCPP 1.6J协议服务实现
处理充电桩与中央系统之间的OCPP消息通信
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import logging

from models import (
    OCPPMessage, ChargingPile, ChargingSession,
    BootNotificationRequest, BootNotificationResponse,
    StatusNotificationRequest, StatusNotificationResponse,
    StartTransactionRequest, StartTransactionResponse,
    StopTransactionRequest, StopTransactionResponse,
    HeartbeatRequest, HeartbeatResponse,
    MeterValuesRequest, MeterValuesResponse,
    AuthorizeRequest, AuthorizeResponse,
    RemoteStartTransactionRequest, RemoteStartTransactionResponse,
    RemoteStopTransactionRequest, RemoteStopTransactionResponse,
    ResetRequest, ResetResponse,
    UnlockConnectorRequest, UnlockConnectorResponse
)
from ocpp_error_handler import error_handler, message_validator, OCPPErrorType

logger = logging.getLogger(__name__)

class OCPPService:
    """OCPP协议服务"""
    
    def __init__(self):
        self.message_handlers = {
            # 充电桩发起的消息
            "BootNotification": self.handle_boot_notification,
            "StatusNotification": self.handle_status_notification,
            "StartTransaction": self.handle_start_transaction,
            "StopTransaction": self.handle_stop_transaction,
            "Heartbeat": self.handle_heartbeat,
            "MeterValues": self.handle_meter_values,
            "Authorize": self.handle_authorize,
            
            # 中央系统响应
            "RemoteStartTransactionResponse": self.handle_remote_start_response,
            "RemoteStopTransactionResponse": self.handle_remote_stop_response,
            "ResetResponse": self.handle_reset_response,
            "UnlockConnectorResponse": self.handle_unlock_response,
        }
        
        self.pending_requests: Dict[str, Dict] = {}
        self.pile_sessions: Dict[str, Dict] = {}
        
    async def initialize(self):
        """初始化OCPP服务"""
        logger.info("初始化OCPP服务...")
        # 这里可以加载配置、连接数据库等
        
    async def cleanup(self):
        """清理OCPP服务资源"""
        logger.info("清理OCPP服务资源...")
        self.pending_requests.clear()
        self.pile_sessions.clear()
        
    async def handle_message(self, pile_id: str, message: Dict) -> Optional[Dict]:
        """处理OCPP消息"""
        try:
            # 解析消息格式 [MessageType, MessageId, Action, Payload]
            if not isinstance(message, list) or len(message) < 3:
                logger.error(f"无效的OCPP消息格式: {message}")
                return self.create_call_error(
                    message[1] if len(message) > 1 else "unknown",
                    "FormatViolation",
                    "Invalid message format"
                )
            
            message_type = message[0]
            message_id = message[1]
            
            # 验证消息ID
            if not isinstance(message_id, str) or not message_id.strip():
                logger.error(f"无效的消息ID: {message_id}")
                return self.create_call_error(
                    str(message_id) if message_id else "unknown",
                    "FormatViolation",
                    "Invalid message ID"
                )
            
            # 验证消息类型
            if not isinstance(message_type, int) or message_type not in [2, 3, 4]:
                logger.error(f"无效的消息类型: {message_type}")
                return self.create_call_error(message_id, "MessageTypeNotSupported", "Invalid message type")
            
            if message_type == 2:  # CALL
                if len(message) != 4:
                    logger.error(f"CALL消息格式错误: {message}")
                    return self.create_call_error(message_id, "FormatViolation", "Invalid CALL message format")
                
                action = message[2]
                payload = message[3]
                
                # 验证action
                if not isinstance(action, str) or not action.strip():
                    logger.error(f"无效的action: {action}")
                    return self.create_call_error(message_id, "FormatViolation", "Invalid action")
                
                # 验证payload
                if not isinstance(payload, dict):
                    logger.error(f"无效的payload: {payload}")
                    return self.create_call_error(message_id, "FormatViolation", "Invalid payload format")
                
                return await self.handle_call(pile_id, message_id, action, payload)
                
            elif message_type == 3:  # CALLRESULT
                if len(message) != 3:
                    logger.error(f"CALLRESULT消息格式错误: {message}")
                    return None
                
                payload = message[2]
                if not isinstance(payload, dict):
                    logger.error(f"无效的CALLRESULT payload: {payload}")
                    return None
                
                return await self.handle_call_result(pile_id, message_id, payload)
                
            elif message_type == 4:  # CALLERROR
                if len(message) != 5:
                    logger.error(f"CALLERROR消息格式错误: {message}")
                    return None
                
                error_code = message[2]
                error_description = message[3]
                error_details = message[4]
                
                # 验证错误信息格式
                if not isinstance(error_code, str):
                    logger.error(f"无效的error_code: {error_code}")
                    return None
                
                if not isinstance(error_description, str):
                    logger.error(f"无效的error_description: {error_description}")
                    return None
                
                if not isinstance(error_details, dict):
                    logger.error(f"无效的error_details: {error_details}")
                    return None
                
                return await self.handle_call_error(pile_id, message_id, error_code, error_description, error_details)
                
        except KeyError as e:
            logger.error(f"消息字段缺失: {e}")
            return self.create_call_error(
                message[1] if len(message) > 1 else "unknown",
                "FormatViolation",
                f"Missing required field: {str(e)}"
            )
        except TypeError as e:
            logger.error(f"消息类型错误: {e}")
            return self.create_call_error(
                message[1] if len(message) > 1 else "unknown",
                "TypeConstraintViolation",
                f"Type error: {str(e)}"
            )
        except Exception as e:
            logger.error(f"处理OCPP消息失败: {e}")
            return self.create_call_error(
                message[1] if len(message) > 1 else "unknown",
                "InternalError",
                str(e)
            )
    
    async def handle_call(self, pile_id: str, message_id: str, action: str, payload: Dict) -> Dict:
        """处理CALL消息"""
        logger.info(f"处理CALL消息: {pile_id} - {action}")
        
        if action in self.message_handlers:
            try:
                result = await self.message_handlers[action](pile_id, payload)
                return self.create_call_result(message_id, result)
            except Exception as e:
                logger.error(f"处理{action}失败: {e}")
                return self.create_call_error(message_id, "InternalError", str(e))
        else:
            logger.error(f"不支持的操作: {action}")
            return self.create_call_error(message_id, "NotSupported", f"Action {action} not supported")
    
    async def handle_call_result(self, pile_id: str, message_id: str, payload: Dict):
        """处理CALLRESULT消息"""
        logger.info(f"收到CALLRESULT: {pile_id} - {message_id}")
        
        if message_id in self.pending_requests:
            request_info = self.pending_requests.pop(message_id)
            action = request_info.get("action")
            
            # 根据不同的响应类型处理
            if action in self.message_handlers:
                await self.message_handlers[f"{action}Response"](pile_id, payload)
        
        return None
    
    async def handle_call_error(self, pile_id: str, message_id: str, error_code: str, error_description: str, error_details: Dict):
        """处理CALLERROR消息"""
        logger.error(f"收到CALLERROR: {pile_id} - {error_code}: {error_description}")
        
        if message_id in self.pending_requests:
            request_info = self.pending_requests.pop(message_id)
            logger.error(f"请求失败: {request_info}")
        
        return None
    
    # OCPP消息处理器
    
    async def handle_boot_notification(self, pile_id: str, payload: Dict) -> Dict:
        """处理BootNotification"""
        logger.info(f"充电桩 {pile_id} 启动通知: {payload}")
        
        # 更新充电桩信息
        from pile_manager import pile_manager
        await pile_manager.update_pile_info(pile_id, {
            "charge_point_vendor": payload.get("chargePointVendor"),
            "charge_point_model": payload.get("chargePointModel"),
            "charge_point_serial_number": payload.get("chargePointSerialNumber"),
            "firmware_version": payload.get("firmwareVersion"),
            "last_boot_time": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "status": "Accepted",
            "currentTime": datetime.now(timezone.utc).isoformat(),
            "interval": 300  # 心跳间隔5分钟
        }
    
    async def handle_status_notification(self, pile_id: str, payload: Dict) -> Dict:
        """处理StatusNotification"""
        connector_id = payload.get("connectorId", 0)
        status = payload.get("status")
        error_code = payload.get("errorCode", "NoError")
        
        logger.info(f"充电桩 {pile_id} 连接器 {connector_id} 状态: {status}")
        
        # 更新充电桩状态
        from pile_manager import pile_manager
        await pile_manager.update_connector_status(pile_id, connector_id, status, error_code)
        
        return {}
    
    async def handle_start_transaction(self, pile_id: str, payload: Dict) -> Dict:
        """处理StartTransaction"""
        connector_id = payload.get("connectorId")
        id_tag = payload.get("idTag")
        meter_start = payload.get("meterStart", 0)
        timestamp = payload.get("timestamp")
        
        logger.info(f"充电桩 {pile_id} 开始交易: 连接器{connector_id}, 用户{id_tag}")
        
        # 验证用户授权
        if not await self.authorize_user(id_tag):
            return {
                "idTagInfo": {
                    "status": "Invalid"
                }
            }
        
        # 生成交易ID
        transaction_id = await self.generate_transaction_id()
        
        # 创建充电会话
        from charging_session import session_manager
        session = await session_manager.create_session_from_pile(
            pile_id=pile_id,
            connector_id=connector_id,
            id_tag=id_tag,
            transaction_id=transaction_id,
            meter_start=meter_start,
            start_time=timestamp
        )
        
        return {
            "idTagInfo": {
                "status": "Accepted"
            },
            "transactionId": transaction_id
        }
    
    async def handle_stop_transaction(self, pile_id: str, payload: Dict) -> Dict:
        """处理StopTransaction"""
        transaction_id = payload.get("transactionId")
        meter_stop = payload.get("meterStop", 0)
        timestamp = payload.get("timestamp")
        reason = payload.get("reason", "Local")
        
        logger.info(f"充电桩 {pile_id} 停止交易: {transaction_id}")
        
        # 结束充电会话
        from charging_session import session_manager
        session = await session_manager.end_session_by_transaction(
            transaction_id=transaction_id,
            meter_stop=meter_stop,
            end_time=timestamp,
            reason=reason
        )
        
        if session:
            return {
                "idTagInfo": {
                    "status": "Accepted"
                }
            }
        else:
            return {
                "idTagInfo": {
                    "status": "Invalid"
                }
            }
    
    async def handle_heartbeat(self, pile_id: str, payload: Dict) -> Dict:
        """处理Heartbeat"""
        logger.debug(f"收到充电桩 {pile_id} 心跳")
        
        # 更新最后心跳时间
        from pile_manager import pile_manager
        await pile_manager.update_last_heartbeat(pile_id)
        
        return {
            "currentTime": datetime.now(timezone.utc).isoformat()
        }
    
    async def handle_meter_values(self, pile_id: str, payload: Dict) -> Dict:
        """处理MeterValues"""
        connector_id = payload.get("connectorId")
        transaction_id = payload.get("transactionId")
        meter_values = payload.get("meterValue", [])
        
        logger.debug(f"收到充电桩 {pile_id} 电表数据: 交易{transaction_id}")
        
        # 处理电表数据
        from charging_session import session_manager
        await session_manager.update_meter_values(transaction_id, meter_values)
        
        return {}
    
    async def handle_authorize(self, pile_id: str, payload: Dict) -> Dict:
        """处理Authorize"""
        id_tag = payload.get("idTag")
        
        logger.info(f"充电桩 {pile_id} 授权请求: {id_tag}")
        
        # 验证用户授权
        is_authorized = await self.authorize_user(id_tag)
        
        return {
            "idTagInfo": {
                "status": "Accepted" if is_authorized else "Invalid"
            }
        }
    
    # 中央系统发起的操作
    
    async def remote_start_transaction(self, pile_id: str, id_tag: str, connector_id: int = 1) -> Dict:
        """远程启动充电"""
        async def _execute_remote_start():
            # 验证输入参数
            payload = {
                "connectorId": connector_id,
                "idTag": id_tag
            }
            
            if not message_validator.validate_message("RemoteStartTransaction", payload):
                raise ValueError(f"无效的RemoteStartTransaction参数: {payload}")
            
            message_id = str(uuid.uuid4())
            message = self.create_call(message_id, "RemoteStartTransaction", payload)
            
            # 记录待处理请求
            self.pending_requests[message_id] = {
                "action": "RemoteStartTransaction",
                "pile_id": pile_id,
                "timestamp": datetime.now()
            }
            
            # 发送消息到充电桩
            from main import manager
            await manager.send_message(pile_id, message)
            
            # 等待响应（简化处理，实际应该有超时机制）
            await asyncio.sleep(1)
            
            return {
                "status": "success",
                "message_id": message_id,
                "action": "RemoteStartTransaction"
            }
        
        try:
            return await error_handler.execute_with_retry(
                "RemoteStartTransaction",
                pile_id,
                _execute_remote_start
            )
        except Exception as e:
            logger.error(f"远程启动充电最终失败: {pile_id}, 错误: {e}")
            return {
                "status": "error",
                "error": str(e),
                "action": "RemoteStartTransaction"
            }
    
    async def remote_stop_transaction(self, pile_id: str, transaction_id: int) -> Dict:
        """远程停止充电"""
        async def _execute_remote_stop():
            # 验证输入参数
            payload = {
                "transactionId": transaction_id
            }
            
            if not message_validator.validate_message("RemoteStopTransaction", payload):
                raise ValueError(f"无效的RemoteStopTransaction参数: {payload}")
            
            message_id = str(uuid.uuid4())
            message = self.create_call(message_id, "RemoteStopTransaction", payload)
            
            self.pending_requests[message_id] = {
                "action": "RemoteStopTransaction",
                "pile_id": pile_id,
                "timestamp": datetime.now()
            }
            
            from main import manager
            await manager.send_message(pile_id, message)
            
            await asyncio.sleep(1)
            
            return {
                "status": "success",
                "message_id": message_id,
                "action": "RemoteStopTransaction"
            }
        
        try:
            return await error_handler.execute_with_retry(
                "RemoteStopTransaction",
                pile_id,
                _execute_remote_stop
            )
        except Exception as e:
            logger.error(f"远程停止充电最终失败: {pile_id}, 错误: {e}")
            return {
                "status": "error",
                "error": str(e),
                "action": "RemoteStopTransaction"
            }
    
    async def reset_pile(self, pile_id: str, reset_type: str = "Soft") -> Dict:
        """重置充电桩"""
        async def _execute_reset():
            # 验证输入参数
            payload = {
                "type": reset_type
            }
            
            if not message_validator.validate_message("Reset", payload):
                raise ValueError(f"无效的Reset参数: {payload}")
            
            message_id = str(uuid.uuid4())
            message = self.create_call(message_id, "Reset", payload)
            
            self.pending_requests[message_id] = {
                "action": "Reset",
                "pile_id": pile_id,
                "timestamp": datetime.now()
            }
            
            from main import manager
            await manager.send_message(pile_id, message)
            
            await asyncio.sleep(1)
            
            return {
                "status": "success",
                "message_id": message_id,
                "action": "Reset",
                "reset_type": reset_type
            }
        
        try:
            return await error_handler.execute_with_retry(
                "Reset",
                pile_id,
                _execute_reset
            )
        except Exception as e:
            logger.error(f"重置充电桩最终失败: {pile_id}, 错误: {e}")
            return {
                "status": "error",
                "error": str(e),
                "action": "Reset"
            }
    
    async def unlock_connector(self, pile_id: str, connector_id: int) -> Dict:
        """解锁充电枪"""
        async def _execute_unlock():
            # 验证输入参数
            payload = {
                "connectorId": connector_id
            }
            
            if not message_validator.validate_message("UnlockConnector", payload):
                raise ValueError(f"无效的UnlockConnector参数: {payload}")
            
            message_id = str(uuid.uuid4())
            message = self.create_call(message_id, "UnlockConnector", payload)
            
            self.pending_requests[message_id] = {
                "action": "UnlockConnector",
                "pile_id": pile_id,
                "timestamp": datetime.now()
            }
            
            from main import manager
            await manager.send_message(pile_id, message)
            
            await asyncio.sleep(1)
            
            return {
                "status": "success",
                "message_id": message_id,
                "action": "UnlockConnector",
                "connector_id": connector_id
            }
        
        try:
            return await error_handler.execute_with_retry(
                "UnlockConnector",
                pile_id,
                _execute_unlock
            )
        except Exception as e:
            logger.error(f"解锁充电枪最终失败: {pile_id}, 错误: {e}")
            return {
                "status": "error",
                "error": str(e),
                "action": "UnlockConnector"
            }
    
    # 响应处理器
    
    async def handle_remote_start_response(self, pile_id: str, payload: Dict):
        """处理RemoteStartTransaction响应"""
        status = payload.get("status")
        logger.info(f"充电桩 {pile_id} 远程启动响应: {status}")
    
    async def handle_remote_stop_response(self, pile_id: str, payload: Dict):
        """处理RemoteStopTransaction响应"""
        status = payload.get("status")
        logger.info(f"充电桩 {pile_id} 远程停止响应: {status}")
    
    async def handle_reset_response(self, pile_id: str, payload: Dict):
        """处理Reset响应"""
        status = payload.get("status")
        logger.info(f"充电桩 {pile_id} 重置响应: {status}")
    
    async def handle_unlock_response(self, pile_id: str, payload: Dict):
        """处理UnlockConnector响应"""
        status = payload.get("status")
        logger.info(f"充电桩 {pile_id} 解锁响应: {status}")
    
    # 辅助方法
    
    def create_call(self, message_id: str, action: str, payload: Dict) -> List:
        """创建CALL消息"""
        return [2, message_id, action, payload]
    
    def create_call_result(self, message_id: str, payload: Dict) -> List:
        """创建CALLRESULT消息"""
        return [3, message_id, payload]
    
    def create_call_error(self, message_id: str, error_code: str, error_description: str, error_details: Dict = None) -> List:
        """创建CALLERROR消息"""
        return [4, message_id, error_code, error_description, error_details or {}]
    
    async def authorize_user(self, id_tag: str) -> bool:
        """验证用户授权"""
        # 这里应该连接到用户管理系统验证
        # 简化处理，假设所有用户都有效
        return True
    
    async def generate_transaction_id(self) -> int:
        """生成交易ID"""
        # 简化处理，使用时间戳
        return int(datetime.now().timestamp() * 1000) % 2147483647