#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
增强的连接管理器
集成WebSocket优化器，提供高级连接管理功能
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Callable, Any
from contextlib import asynccontextmanager

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from websocket_optimizer import (
    WebSocketOptimizer, ConnectionConfig, MessagePriority,
    websocket_connection, websocket_optimizer
)
from ocpp_monitoring import monitoring_service
from ocpp_error_handler import error_handler

# 配置日志
logger = logging.getLogger(__name__)

class ConnectionStats(BaseModel):
    """连接统计信息"""
    total_connections: int = 0
    active_connections: int = 0
    pile_connections: Dict[str, int] = {}
    messages_sent: int = 0
    messages_received: int = 0
    errors: int = 0
    avg_response_time: float = 0.0
    uptime_seconds: int = 0

class MessageFilter:
    """消息过滤器"""
    
    def __init__(self):
        self.filters: List[Callable[[dict], bool]] = []
        self.transformers: List[Callable[[dict], dict]] = []
    
    def add_filter(self, filter_func: Callable[[dict], bool]):
        """添加消息过滤器"""
        self.filters.append(filter_func)
    
    def add_transformer(self, transformer_func: Callable[[dict], dict]):
        """添加消息转换器"""
        self.transformers.append(transformer_func)
    
    def should_process(self, message: dict) -> bool:
        """检查消息是否应该被处理"""
        for filter_func in self.filters:
            if not filter_func(message):
                return False
        return True
    
    def transform_message(self, message: dict) -> dict:
        """转换消息"""
        result = message.copy()
        for transformer in self.transformers:
            result = transformer(result)
        return result

class EnhancedConnectionManager:
    """增强的连接管理器"""
    
    def __init__(self, config: Optional[ConnectionConfig] = None):
        self.config = config or ConnectionConfig()
        self.optimizer = websocket_optimizer
        
        # 消息处理
        self.message_handlers: Dict[str, List[Callable]] = {}
        self.message_filter = MessageFilter()
        
        # 连接事件回调
        self.on_connect_callbacks: List[Callable] = []
        self.on_disconnect_callbacks: List[Callable] = []
        self.on_message_callbacks: List[Callable] = []
        self.on_error_callbacks: List[Callable] = []
        
        # 统计信息
        self.start_time = datetime.now()
        self.stats = ConnectionStats()
        
        # 初始化消息过滤器
        self._setup_default_filters()
        
        logger.info("增强连接管理器初始化完成")
    
    async def start(self):
        """启动连接管理器"""
        await self.optimizer.start()
        logger.info("增强连接管理器已启动")
    
    async def stop(self):
        """停止连接管理器"""
        await self.optimizer.stop()
        logger.info("增强连接管理器已停止")
    
    @asynccontextmanager
    async def connect_pile(self, websocket: WebSocket, pile_id: str):
        """连接充电桩（上下文管理器）"""
        connection_id = None
        try:
            # 接受WebSocket连接
            await websocket.accept()
            
            # 添加到优化器
            connection_id = await self.optimizer.add_connection(websocket, pile_id)
            
            # 更新统计
            self.stats.total_connections += 1
            self.stats.active_connections += 1
            if pile_id not in self.stats.pile_connections:
                self.stats.pile_connections[pile_id] = 0
            self.stats.pile_connections[pile_id] += 1
            
            # 执行连接回调
            for callback in self.on_connect_callbacks:
                try:
                    await callback(pile_id, connection_id)
                except Exception as e:
                    logger.error(f"连接回调执行失败: {e}")
            
            logger.info(f"充电桩 {pile_id} 连接成功 (连接ID: {connection_id})")
            
            yield connection_id
            
        except Exception as e:
            logger.error(f"充电桩 {pile_id} 连接失败: {e}")
            self.stats.errors += 1
            
            # 执行错误回调
            for callback in self.on_error_callbacks:
                try:
                    await callback(pile_id, e)
                except Exception as callback_error:
                    logger.error(f"错误回调执行失败: {callback_error}")
            
            raise
        
        finally:
            if connection_id:
                # 更新统计
                self.stats.active_connections -= 1
                if pile_id in self.stats.pile_connections:
                    self.stats.pile_connections[pile_id] -= 1
                    if self.stats.pile_connections[pile_id] <= 0:
                        del self.stats.pile_connections[pile_id]
                
                # 执行断开回调
                for callback in self.on_disconnect_callbacks:
                    try:
                        await callback(pile_id, connection_id)
                    except Exception as e:
                        logger.error(f"断开回调执行失败: {e}")
                
                logger.info(f"充电桩 {pile_id} 连接已断开 (连接ID: {connection_id})")
    
    async def send_message_to_pile(self, pile_id: str, message: dict, 
                                  priority: MessagePriority = MessagePriority.NORMAL,
                                  timeout: float = 30.0) -> bool:
        """向充电桩发送消息"""
        try:
            # 消息预处理
            if not self.message_filter.should_process(message):
                logger.debug(f"消息被过滤器拒绝: {message.get('type', 'unknown')}")
                return False
            
            processed_message = self.message_filter.transform_message(message)
            
            # 添加时间戳和追踪信息
            processed_message.update({
                "timestamp": datetime.now().isoformat(),
                "pile_id": pile_id,
                "message_id": f"{pile_id}_{int(datetime.now().timestamp() * 1000)}"
            })
            
            # 发送消息
            start_time = datetime.now()
            success = await self.optimizer.send_message_to_pile(pile_id, processed_message, priority)
            response_time = (datetime.now() - start_time).total_seconds()
            
            # 更新统计
            if success:
                self.stats.messages_sent += 1
                monitoring_service.record_message(
                    processed_message.get('action', 'unknown'), 
                    True, 
                    response_time
                )
            else:
                self.stats.errors += 1
                monitoring_service.record_message(
                    processed_message.get('action', 'unknown'), 
                    False, 
                    response_time
                )
            
            return success
            
        except Exception as e:
            logger.error(f"发送消息到充电桩 {pile_id} 失败: {e}")
            self.stats.errors += 1
            
            # 使用错误处理器
            await error_handler.handle_connection_error(pile_id, e)
            return False
    
    async def broadcast_to_pile(self, pile_id: str, message: dict, 
                               priority: MessagePriority = MessagePriority.NORMAL) -> int:
        """向充电桩的所有连接广播消息"""
        try:
            # 消息预处理
            if not self.message_filter.should_process(message):
                logger.debug(f"广播消息被过滤器拒绝: {message.get('type', 'unknown')}")
                return 0
            
            processed_message = self.message_filter.transform_message(message)
            processed_message.update({
                "timestamp": datetime.now().isoformat(),
                "pile_id": pile_id,
                "broadcast": True
            })
            
            # 广播消息
            success_count = await self.optimizer.broadcast_to_pile(pile_id, processed_message, priority)
            
            # 更新统计
            self.stats.messages_sent += success_count
            if success_count > 0:
                monitoring_service.record_message(
                    processed_message.get('action', 'broadcast'), 
                    True
                )
            
            return success_count
            
        except Exception as e:
            logger.error(f"广播消息到充电桩 {pile_id} 失败: {e}")
            self.stats.errors += 1
            await error_handler.handle_connection_error(pile_id, e)
            return 0
    
    async def receive_message(self, websocket: WebSocket, pile_id: str) -> Optional[dict]:
        """接收消息"""
        try:
            data = await websocket.receive_json()
            
            # 更新统计
            self.stats.messages_received += 1
            
            # 消息预处理
            if not self.message_filter.should_process(data):
                logger.debug(f"接收消息被过滤器拒绝: {data.get('type', 'unknown')}")
                return None
            
            processed_data = self.message_filter.transform_message(data)
            
            # 添加接收信息
            processed_data.update({
                "received_at": datetime.now().isoformat(),
                "pile_id": pile_id
            })
            
            # 执行消息回调
            for callback in self.on_message_callbacks:
                try:
                    await callback(pile_id, processed_data)
                except Exception as e:
                    logger.error(f"消息回调执行失败: {e}")
            
            # 执行特定类型的消息处理器
            message_type = processed_data.get('type', 'unknown')
            if message_type in self.message_handlers:
                for handler in self.message_handlers[message_type]:
                    try:
                        await handler(pile_id, processed_data)
                    except Exception as e:
                        logger.error(f"消息处理器执行失败: {e}")
            
            return processed_data
            
        except WebSocketDisconnect:
            logger.info(f"充电桩 {pile_id} WebSocket连接断开")
            return None
        except Exception as e:
            logger.error(f"接收充电桩 {pile_id} 消息失败: {e}")
            self.stats.errors += 1
            
            # 执行错误回调
            for callback in self.on_error_callbacks:
                try:
                    await callback(pile_id, e)
                except Exception as callback_error:
                    logger.error(f"错误回调执行失败: {callback_error}")
            
            return None
    
    def add_message_handler(self, message_type: str, handler: Callable):
        """添加消息处理器"""
        if message_type not in self.message_handlers:
            self.message_handlers[message_type] = []
        self.message_handlers[message_type].append(handler)
    
    def remove_message_handler(self, message_type: str, handler: Callable):
        """移除消息处理器"""
        if message_type in self.message_handlers:
            try:
                self.message_handlers[message_type].remove(handler)
            except ValueError:
                pass
    
    def add_connect_callback(self, callback: Callable):
        """添加连接回调"""
        self.on_connect_callbacks.append(callback)
    
    def add_disconnect_callback(self, callback: Callable):
        """添加断开回调"""
        self.on_disconnect_callbacks.append(callback)
    
    def add_message_callback(self, callback: Callable):
        """添加消息回调"""
        self.on_message_callbacks.append(callback)
    
    def add_error_callback(self, callback: Callable):
        """添加错误回调"""
        self.on_error_callbacks.append(callback)
    
    async def get_connection_stats(self) -> ConnectionStats:
        """获取连接统计信息"""
        # 更新运行时间
        uptime = (datetime.now() - self.start_time).total_seconds()
        self.stats.uptime_seconds = int(uptime)
        
        # 获取优化器的全局指标
        global_metrics = await self.optimizer.get_global_metrics()
        self.stats.avg_response_time = global_metrics.get('avg_response_time', 0.0)
        
        return self.stats
    
    async def get_pile_stats(self, pile_id: str) -> Optional[dict]:
        """获取充电桩统计信息"""
        return await self.optimizer.get_pile_metrics(pile_id)
    
    async def get_connection_metrics(self, connection_id: str) -> Optional[dict]:
        """获取连接指标"""
        return await self.optimizer.get_connection_metrics(connection_id)
    
    async def health_check(self) -> dict:
        """健康检查"""
        stats = await self.get_connection_stats()
        global_metrics = await self.optimizer.get_global_metrics()
        
        # 计算健康分数
        health_score = 100
        
        # 错误率检查
        total_messages = stats.messages_sent + stats.messages_received
        if total_messages > 0:
            error_rate = stats.errors / total_messages
            if error_rate > 0.1:  # 错误率超过10%
                health_score -= 30
            elif error_rate > 0.05:  # 错误率超过5%
                health_score -= 15
        
        # 响应时间检查
        if stats.avg_response_time > 5.0:  # 响应时间超过5秒
            health_score -= 20
        elif stats.avg_response_time > 2.0:  # 响应时间超过2秒
            health_score -= 10
        
        # 连接数检查
        if stats.active_connections == 0 and stats.total_connections > 0:
            health_score -= 40  # 没有活跃连接但曾经有连接
        
        status = "healthy"
        if health_score < 60:
            status = "unhealthy"
        elif health_score < 80:
            status = "degraded"
        
        return {
            "status": status,
            "health_score": health_score,
            "timestamp": datetime.now().isoformat(),
            "stats": stats.dict(),
            "global_metrics": global_metrics,
            "checks": {
                "error_rate": error_rate if total_messages > 0 else 0,
                "avg_response_time": stats.avg_response_time,
                "active_connections": stats.active_connections,
                "uptime_hours": stats.uptime_seconds / 3600
            }
        }
    
    def _setup_default_filters(self):
        """设置默认过滤器"""
        # 过滤空消息
        self.message_filter.add_filter(lambda msg: bool(msg))
        
        # 过滤过大的消息
        def size_filter(msg: dict) -> bool:
            try:
                size = len(json.dumps(msg))
                return size <= self.config.max_message_size
            except Exception:
                return False
        
        self.message_filter.add_filter(size_filter)
        
        # 添加默认字段转换器
        def add_metadata(msg: dict) -> dict:
            result = msg.copy()
            if 'metadata' not in result:
                result['metadata'] = {}
            result['metadata'].update({
                'processed_at': datetime.now().isoformat(),
                'manager_version': '1.0.0'
            })
            return result
        
        self.message_filter.add_transformer(add_metadata)
    
    async def reset_pile_connection(self, pile_id: str) -> bool:
        """重置充电桩连接"""
        try:
            # 获取充电桩的连接信息
            pile_metrics = await self.get_pile_stats(pile_id)
            if not pile_metrics or pile_metrics['connection_count'] == 0:
                logger.warning(f"充电桩 {pile_id} 没有活跃连接")
                return False
            
            # 发送重置命令
            reset_message = {
                "type": "reset",
                "action": "Reset",
                "reset_type": "Soft",
                "reason": "Connection reset requested"
            }
            
            success = await self.send_message_to_pile(pile_id, reset_message, MessagePriority.HIGH)
            
            if success:
                logger.info(f"充电桩 {pile_id} 重置命令发送成功")
            else:
                logger.error(f"充电桩 {pile_id} 重置命令发送失败")
            
            return success
            
        except Exception as e:
            logger.error(f"重置充电桩 {pile_id} 连接失败: {e}")
            return False
    
    async def cleanup_idle_connections(self) -> int:
        """清理空闲连接"""
        try:
            cleaned_count = 0
            current_time = datetime.now()
            
            # 获取所有连接的指标
            for pile_id in list(self.stats.pile_connections.keys()):
                pile_metrics = await self.get_pile_stats(pile_id)
                if not pile_metrics:
                    continue
                
                for conn_metrics in pile_metrics.get('connections', []):
                    # 检查空闲时间
                    last_activity = datetime.fromisoformat(conn_metrics['last_activity'])
                    idle_time = (current_time - last_activity).total_seconds()
                    
                    if idle_time > self.config.idle_timeout:
                        connection_id = conn_metrics['connection_id']
                        await self.optimizer.remove_connection(connection_id)
                        cleaned_count += 1
                        logger.info(f"清理空闲连接: {connection_id} (空闲时间: {idle_time:.1f}s)")
            
            return cleaned_count
            
        except Exception as e:
            logger.error(f"清理空闲连接失败: {e}")
            return 0

# 全局增强连接管理器实例
enhanced_manager = EnhancedConnectionManager()

# 便捷函数
async def start_connection_manager():
    """启动连接管理器"""
    await enhanced_manager.start()

async def stop_connection_manager():
    """停止连接管理器"""
    await enhanced_manager.stop()

# 装饰器
def message_handler(message_type: str):
    """消息处理器装饰器"""
    def decorator(func):
        enhanced_manager.add_message_handler(message_type, func)
        return func
    return decorator

# 示例消息处理器
@message_handler("heartbeat")
async def handle_heartbeat(pile_id: str, message: dict):
    """处理心跳消息"""
    logger.debug(f"收到充电桩 {pile_id} 心跳")
    
    # 回复心跳
    response = {
        "type": "heartbeat_response",
        "timestamp": datetime.now().isoformat()
    }
    
    await enhanced_manager.send_message_to_pile(pile_id, response, MessagePriority.HIGH)

@message_handler("status_notification")
async def handle_status_notification(pile_id: str, message: dict):
    """处理状态通知"""
    logger.info(f"充电桩 {pile_id} 状态更新: {message.get('status', 'unknown')}")
    
    # 记录状态变化
    monitoring_service.record_message("status_notification", True)