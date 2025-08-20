#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocket连接优化器
提供连接池管理、智能重连、负载均衡和性能监控功能
"""

import asyncio
import json
import logging
import time
import weakref
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Set, Callable, Any, Tuple
from concurrent.futures import ThreadPoolExecutor
import threading
from contextlib import asynccontextmanager

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel

# 配置日志
logger = logging.getLogger(__name__)

class ConnectionState(Enum):
    """连接状态枚举"""
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTING = "disconnecting"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    RECONNECTING = "reconnecting"

class MessagePriority(Enum):
    """消息优先级"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4

@dataclass
class ConnectionMetrics:
    """连接指标"""
    connected_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    messages_sent: int = 0
    messages_received: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    errors: int = 0
    reconnect_count: int = 0
    avg_response_time: float = 0.0
    response_times: deque = field(default_factory=lambda: deque(maxlen=100))
    
    def update_response_time(self, response_time: float):
        """更新响应时间统计"""
        self.response_times.append(response_time)
        self.avg_response_time = sum(self.response_times) / len(self.response_times)

@dataclass
class QueuedMessage:
    """队列消息"""
    data: dict
    priority: MessagePriority = MessagePriority.NORMAL
    timestamp: datetime = field(default_factory=datetime.now)
    retry_count: int = 0
    max_retries: int = 3
    callback: Optional[Callable] = None
    
    def __lt__(self, other):
        # 优先级队列排序：优先级高的先处理，同优先级按时间排序
        if self.priority.value != other.priority.value:
            return self.priority.value > other.priority.value
        return self.timestamp < other.timestamp

class ConnectionConfig:
    """连接配置"""
    def __init__(self):
        # 连接池配置
        self.max_connections_per_pile = 3  # 每个充电桩最大连接数
        self.connection_timeout = 30.0  # 连接超时时间
        self.idle_timeout = 300.0  # 空闲超时时间
        
        # 重连配置
        self.max_reconnect_attempts = 5
        self.initial_reconnect_delay = 1.0
        self.max_reconnect_delay = 60.0
        self.reconnect_backoff_factor = 2.0
        
        # 心跳配置
        self.heartbeat_interval = 30.0
        self.heartbeat_timeout = 10.0
        
        # 消息队列配置
        self.max_queue_size = 1000
        self.message_timeout = 30.0
        
        # 性能配置
        self.enable_compression = True
        self.max_message_size = 1024 * 1024  # 1MB
        self.batch_size = 10  # 批量处理消息数量
        
        # 监控配置
        self.metrics_retention_hours = 24
        self.health_check_interval = 60.0

class EnhancedConnection:
    """增强的WebSocket连接"""
    
    def __init__(self, websocket: WebSocket, connection_id: str, pile_id: str, config: ConnectionConfig):
        self.websocket = websocket
        self.connection_id = connection_id
        self.pile_id = pile_id
        self.config = config
        
        self.state = ConnectionState.CONNECTING
        self.metrics = ConnectionMetrics()
        self.message_queue = asyncio.PriorityQueue(maxsize=config.max_queue_size)
        self.pending_messages: Dict[str, QueuedMessage] = {}
        
        # 异步任务
        self.heartbeat_task: Optional[asyncio.Task] = None
        self.message_processor_task: Optional[asyncio.Task] = None
        self.health_monitor_task: Optional[asyncio.Task] = None
        
        # 事件回调
        self.on_message_callbacks: List[Callable] = []
        self.on_disconnect_callbacks: List[Callable] = []
        self.on_error_callbacks: List[Callable] = []
        
        # 线程安全锁
        self._lock = asyncio.Lock()
        
    async def initialize(self):
        """初始化连接"""
        try:
            self.state = ConnectionState.CONNECTED
            self.metrics.connected_at = datetime.now()
            
            # 启动后台任务
            self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            self.message_processor_task = asyncio.create_task(self._message_processor())
            self.health_monitor_task = asyncio.create_task(self._health_monitor())
            
            logger.info(f"连接 {self.connection_id} 初始化完成")
            
        except Exception as e:
            self.state = ConnectionState.ERROR
            logger.error(f"连接 {self.connection_id} 初始化失败: {e}")
            raise
    
    async def send_message(self, data: dict, priority: MessagePriority = MessagePriority.NORMAL, 
                          callback: Optional[Callable] = None) -> bool:
        """发送消息"""
        if self.state != ConnectionState.CONNECTED:
            logger.warning(f"连接 {self.connection_id} 状态异常，无法发送消息")
            return False
        
        message = QueuedMessage(data=data, priority=priority, callback=callback)
        
        try:
            await self.message_queue.put(message)
            return True
        except asyncio.QueueFull:
            logger.error(f"连接 {self.connection_id} 消息队列已满")
            return False
    
    async def _message_processor(self):
        """消息处理器"""
        batch = []
        
        while self.state in [ConnectionState.CONNECTED, ConnectionState.RECONNECTING]:
            try:
                # 批量获取消息
                timeout = 0.1  # 100ms超时
                
                try:
                    message = await asyncio.wait_for(self.message_queue.get(), timeout=timeout)
                    batch.append(message)
                except asyncio.TimeoutError:
                    pass
                
                # 达到批量大小或有消息待处理时发送
                if len(batch) >= self.config.batch_size or (batch and self.message_queue.empty()):
                    await self._send_batch(batch)
                    batch.clear()
                    
            except Exception as e:
                logger.error(f"消息处理器错误: {e}")
                await asyncio.sleep(1)
    
    async def _send_batch(self, messages: List[QueuedMessage]):
        """批量发送消息"""
        if not messages:
            return
        
        async with self._lock:
            for message in messages:
                try:
                    start_time = time.time()
                    
                    # 发送消息
                    await self.websocket.send_json(message.data)
                    
                    # 更新统计
                    response_time = time.time() - start_time
                    self.metrics.messages_sent += 1
                    self.metrics.bytes_sent += len(json.dumps(message.data))
                    self.metrics.update_response_time(response_time)
                    self.metrics.last_activity = datetime.now()
                    
                    # 执行回调
                    if message.callback:
                        try:
                            await message.callback(True, None)
                        except Exception as e:
                            logger.error(f"消息回调执行失败: {e}")
                    
                except Exception as e:
                    logger.error(f"发送消息失败: {e}")
                    self.metrics.errors += 1
                    
                    # 重试逻辑
                    if message.retry_count < message.max_retries:
                        message.retry_count += 1
                        await self.message_queue.put(message)
                    else:
                        # 执行失败回调
                        if message.callback:
                            try:
                                await message.callback(False, e)
                            except Exception as callback_error:
                                logger.error(f"失败回调执行失败: {callback_error}")
    
    async def _heartbeat_loop(self):
        """心跳循环"""
        while self.state in [ConnectionState.CONNECTED, ConnectionState.RECONNECTING]:
            try:
                # 发送心跳
                heartbeat_data = {
                    "type": "heartbeat",
                    "timestamp": datetime.now().isoformat(),
                    "connection_id": self.connection_id
                }
                
                await self.send_message(heartbeat_data, MessagePriority.HIGH)
                await asyncio.sleep(self.config.heartbeat_interval)
                
            except Exception as e:
                logger.error(f"心跳发送失败: {e}")
                await asyncio.sleep(5)
    
    async def _health_monitor(self):
        """健康监控"""
        while self.state in [ConnectionState.CONNECTED, ConnectionState.RECONNECTING]:
            try:
                now = datetime.now()
                
                # 检查空闲超时
                idle_time = (now - self.metrics.last_activity).total_seconds()
                if idle_time > self.config.idle_timeout:
                    logger.warning(f"连接 {self.connection_id} 空闲超时")
                    await self.disconnect()
                    break
                
                # 检查错误率
                total_messages = self.metrics.messages_sent + self.metrics.messages_received
                if total_messages > 100:  # 至少100条消息后才检查错误率
                    error_rate = self.metrics.errors / total_messages
                    if error_rate > 0.1:  # 错误率超过10%
                        logger.warning(f"连接 {self.connection_id} 错误率过高: {error_rate:.2%}")
                
                await asyncio.sleep(self.config.health_check_interval)
                
            except Exception as e:
                logger.error(f"健康监控错误: {e}")
                await asyncio.sleep(30)
    
    async def receive_message(self) -> Optional[dict]:
        """接收消息"""
        try:
            data = await self.websocket.receive_json()
            
            # 更新统计
            self.metrics.messages_received += 1
            self.metrics.bytes_received += len(json.dumps(data))
            self.metrics.last_activity = datetime.now()
            
            # 执行回调
            for callback in self.on_message_callbacks:
                try:
                    await callback(data)
                except Exception as e:
                    logger.error(f"消息回调执行失败: {e}")
            
            return data
            
        except WebSocketDisconnect:
            logger.info(f"连接 {self.connection_id} 正常断开")
            await self.disconnect()
            return None
        except Exception as e:
            logger.error(f"接收消息失败: {e}")
            self.metrics.errors += 1
            
            # 执行错误回调
            for callback in self.on_error_callbacks:
                try:
                    await callback(e)
                except Exception as callback_error:
                    logger.error(f"错误回调执行失败: {callback_error}")
            
            return None
    
    async def disconnect(self):
        """断开连接"""
        if self.state == ConnectionState.DISCONNECTED:
            return
        
        self.state = ConnectionState.DISCONNECTING
        
        # 取消后台任务
        for task in [self.heartbeat_task, self.message_processor_task, self.health_monitor_task]:
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        # 关闭WebSocket连接
        try:
            await self.websocket.close()
        except Exception as e:
            logger.error(f"关闭WebSocket连接失败: {e}")
        
        self.state = ConnectionState.DISCONNECTED
        
        # 执行断开回调
        for callback in self.on_disconnect_callbacks:
            try:
                await callback()
            except Exception as e:
                logger.error(f"断开回调执行失败: {e}")
        
        logger.info(f"连接 {self.connection_id} 已断开")
    
    def add_message_callback(self, callback: Callable):
        """添加消息回调"""
        self.on_message_callbacks.append(callback)
    
    def add_disconnect_callback(self, callback: Callable):
        """添加断开回调"""
        self.on_disconnect_callbacks.append(callback)
    
    def add_error_callback(self, callback: Callable):
        """添加错误回调"""
        self.on_error_callbacks.append(callback)
    
    def get_metrics(self) -> dict:
        """获取连接指标"""
        return {
            "connection_id": self.connection_id,
            "pile_id": self.pile_id,
            "state": self.state.value,
            "connected_at": self.metrics.connected_at.isoformat(),
            "last_activity": self.metrics.last_activity.isoformat(),
            "messages_sent": self.metrics.messages_sent,
            "messages_received": self.metrics.messages_received,
            "bytes_sent": self.metrics.bytes_sent,
            "bytes_received": self.metrics.bytes_received,
            "errors": self.metrics.errors,
            "reconnect_count": self.metrics.reconnect_count,
            "avg_response_time": self.metrics.avg_response_time,
            "queue_size": self.message_queue.qsize()
        }

class WebSocketOptimizer:
    """WebSocket连接优化器"""
    
    def __init__(self, config: Optional[ConnectionConfig] = None):
        self.config = config or ConnectionConfig()
        
        # 连接池
        self.connections: Dict[str, EnhancedConnection] = {}
        self.pile_connections: Dict[str, List[str]] = defaultdict(list)  # pile_id -> connection_ids
        
        # 负载均衡
        self.connection_load: Dict[str, int] = defaultdict(int)  # connection_id -> load
        
        # 重连管理
        self.reconnect_tasks: Dict[str, asyncio.Task] = {}
        
        # 统计信息
        self.global_metrics = {
            "total_connections": 0,
            "active_connections": 0,
            "total_messages": 0,
            "total_errors": 0,
            "avg_response_time": 0.0
        }
        
        # 后台任务
        self.cleanup_task: Optional[asyncio.Task] = None
        self.metrics_task: Optional[asyncio.Task] = None
        
        # 线程池用于CPU密集型任务
        self.thread_pool = ThreadPoolExecutor(max_workers=4)
        
        logger.info("WebSocket优化器初始化完成")
    
    async def start(self):
        """启动优化器"""
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        self.metrics_task = asyncio.create_task(self._metrics_loop())
        logger.info("WebSocket优化器已启动")
    
    async def stop(self):
        """停止优化器"""
        # 取消后台任务
        for task in [self.cleanup_task, self.metrics_task]:
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        # 断开所有连接
        disconnect_tasks = []
        for connection in self.connections.values():
            disconnect_tasks.append(connection.disconnect())
        
        if disconnect_tasks:
            await asyncio.gather(*disconnect_tasks, return_exceptions=True)
        
        # 关闭线程池
        self.thread_pool.shutdown(wait=True)
        
        logger.info("WebSocket优化器已停止")
    
    async def add_connection(self, websocket: WebSocket, pile_id: str) -> str:
        """添加连接"""
        # 检查连接数限制
        if len(self.pile_connections[pile_id]) >= self.config.max_connections_per_pile:
            # 移除最旧的连接
            oldest_connection_id = self.pile_connections[pile_id][0]
            await self.remove_connection(oldest_connection_id)
        
        # 创建连接ID
        connection_id = f"{pile_id}_{int(time.time() * 1000)}"
        
        # 创建增强连接
        connection = EnhancedConnection(websocket, connection_id, pile_id, self.config)
        
        # 添加到连接池
        self.connections[connection_id] = connection
        self.pile_connections[pile_id].append(connection_id)
        self.connection_load[connection_id] = 0
        
        # 初始化连接
        await connection.initialize()
        
        # 添加断开回调
        connection.add_disconnect_callback(lambda: self._on_connection_disconnect(connection_id))
        
        # 更新统计
        self.global_metrics["total_connections"] += 1
        self.global_metrics["active_connections"] += 1
        
        logger.info(f"添加连接: {connection_id} (充电桩: {pile_id})")
        return connection_id
    
    async def remove_connection(self, connection_id: str):
        """移除连接"""
        if connection_id not in self.connections:
            return
        
        connection = self.connections[connection_id]
        pile_id = connection.pile_id
        
        # 断开连接
        await connection.disconnect()
        
        # 从连接池移除
        del self.connections[connection_id]
        if connection_id in self.pile_connections[pile_id]:
            self.pile_connections[pile_id].remove(connection_id)
        if connection_id in self.connection_load:
            del self.connection_load[connection_id]
        
        # 取消重连任务
        if connection_id in self.reconnect_tasks:
            self.reconnect_tasks[connection_id].cancel()
            del self.reconnect_tasks[connection_id]
        
        # 更新统计
        self.global_metrics["active_connections"] -= 1
        
        logger.info(f"移除连接: {connection_id}")
    
    async def send_message_to_pile(self, pile_id: str, data: dict, 
                                  priority: MessagePriority = MessagePriority.NORMAL) -> bool:
        """向充电桩发送消息（负载均衡）"""
        connection_ids = self.pile_connections.get(pile_id, [])
        if not connection_ids:
            logger.warning(f"充电桩 {pile_id} 没有可用连接")
            return False
        
        # 选择负载最低的连接
        best_connection_id = min(connection_ids, key=lambda cid: self.connection_load.get(cid, 0))
        connection = self.connections.get(best_connection_id)
        
        if not connection or connection.state != ConnectionState.CONNECTED:
            logger.warning(f"连接 {best_connection_id} 不可用")
            return False
        
        # 发送消息
        success = await connection.send_message(data, priority)
        if success:
            self.connection_load[best_connection_id] += 1
            self.global_metrics["total_messages"] += 1
        
        return success
    
    async def broadcast_to_pile(self, pile_id: str, data: dict, 
                               priority: MessagePriority = MessagePriority.NORMAL) -> int:
        """向充电桩的所有连接广播消息"""
        connection_ids = self.pile_connections.get(pile_id, [])
        success_count = 0
        
        for connection_id in connection_ids:
            connection = self.connections.get(connection_id)
            if connection and connection.state == ConnectionState.CONNECTED:
                if await connection.send_message(data, priority):
                    success_count += 1
                    self.connection_load[connection_id] += 1
        
        self.global_metrics["total_messages"] += success_count
        return success_count
    
    async def get_connection_metrics(self, connection_id: str) -> Optional[dict]:
        """获取连接指标"""
        connection = self.connections.get(connection_id)
        return connection.get_metrics() if connection else None
    
    async def get_pile_metrics(self, pile_id: str) -> dict:
        """获取充电桩指标"""
        connection_ids = self.pile_connections.get(pile_id, [])
        metrics = {
            "pile_id": pile_id,
            "connection_count": len(connection_ids),
            "active_connections": 0,
            "total_messages_sent": 0,
            "total_messages_received": 0,
            "total_errors": 0,
            "avg_response_time": 0.0,
            "connections": []
        }
        
        response_times = []
        for connection_id in connection_ids:
            connection = self.connections.get(connection_id)
            if connection:
                conn_metrics = connection.get_metrics()
                metrics["connections"].append(conn_metrics)
                
                if connection.state == ConnectionState.CONNECTED:
                    metrics["active_connections"] += 1
                
                metrics["total_messages_sent"] += connection.metrics.messages_sent
                metrics["total_messages_received"] += connection.metrics.messages_received
                metrics["total_errors"] += connection.metrics.errors
                
                if connection.metrics.avg_response_time > 0:
                    response_times.append(connection.metrics.avg_response_time)
        
        if response_times:
            metrics["avg_response_time"] = sum(response_times) / len(response_times)
        
        return metrics
    
    async def get_global_metrics(self) -> dict:
        """获取全局指标"""
        # 计算平均响应时间
        response_times = []
        for connection in self.connections.values():
            if connection.metrics.avg_response_time > 0:
                response_times.append(connection.metrics.avg_response_time)
        
        if response_times:
            self.global_metrics["avg_response_time"] = sum(response_times) / len(response_times)
        
        return self.global_metrics.copy()
    
    async def _on_connection_disconnect(self, connection_id: str):
        """连接断开回调"""
        if connection_id in self.connections:
            connection = self.connections[connection_id]
            
            # 启动重连任务
            if connection.metrics.reconnect_count < self.config.max_reconnect_attempts:
                self.reconnect_tasks[connection_id] = asyncio.create_task(
                    self._reconnect_connection(connection_id)
                )
    
    async def _reconnect_connection(self, connection_id: str):
        """重连连接"""
        if connection_id not in self.connections:
            return
        
        connection = self.connections[connection_id]
        connection.state = ConnectionState.RECONNECTING
        connection.metrics.reconnect_count += 1
        
        # 计算重连延迟
        delay = min(
            self.config.initial_reconnect_delay * 
            (self.config.reconnect_backoff_factor ** (connection.metrics.reconnect_count - 1)),
            self.config.max_reconnect_delay
        )
        
        logger.info(f"连接 {connection_id} 将在 {delay:.1f}s 后重连 (第{connection.metrics.reconnect_count}次)")
        await asyncio.sleep(delay)
        
        try:
            # 这里需要实际的重连逻辑，具体实现取决于WebSocket库
            # 由于FastAPI的WebSocket不支持重连，这里只是示例
            logger.info(f"连接 {connection_id} 重连成功")
            connection.state = ConnectionState.CONNECTED
            
        except Exception as e:
            logger.error(f"连接 {connection_id} 重连失败: {e}")
            
            if connection.metrics.reconnect_count >= self.config.max_reconnect_attempts:
                logger.error(f"连接 {connection_id} 重连次数超限，放弃重连")
                await self.remove_connection(connection_id)
            else:
                # 继续重连
                self.reconnect_tasks[connection_id] = asyncio.create_task(
                    self._reconnect_connection(connection_id)
                )
    
    async def _cleanup_loop(self):
        """清理循环"""
        while True:
            try:
                # 清理断开的连接
                disconnected_connections = []
                for connection_id, connection in self.connections.items():
                    if connection.state == ConnectionState.DISCONNECTED:
                        disconnected_connections.append(connection_id)
                
                for connection_id in disconnected_connections:
                    await self.remove_connection(connection_id)
                
                # 重置负载计数
                for connection_id in self.connection_load:
                    self.connection_load[connection_id] = max(0, self.connection_load[connection_id] - 1)
                
                await asyncio.sleep(60)  # 每分钟清理一次
                
            except Exception as e:
                logger.error(f"清理循环错误: {e}")
                await asyncio.sleep(30)
    
    async def _metrics_loop(self):
        """指标收集循环"""
        while True:
            try:
                # 更新全局指标
                active_count = sum(1 for conn in self.connections.values() 
                                 if conn.state == ConnectionState.CONNECTED)
                self.global_metrics["active_connections"] = active_count
                
                total_errors = sum(conn.metrics.errors for conn in self.connections.values())
                self.global_metrics["total_errors"] = total_errors
                
                await asyncio.sleep(self.config.health_check_interval)
                
            except Exception as e:
                logger.error(f"指标收集错误: {e}")
                await asyncio.sleep(30)

# 全局优化器实例
websocket_optimizer = WebSocketOptimizer()

# 上下文管理器
@asynccontextmanager
async def websocket_connection(websocket: WebSocket, pile_id: str):
    """WebSocket连接上下文管理器"""
    connection_id = None
    try:
        connection_id = await websocket_optimizer.add_connection(websocket, pile_id)
        yield connection_id
    finally:
        if connection_id:
            await websocket_optimizer.remove_connection(connection_id)