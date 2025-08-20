#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
基础WebSocket优化测试脚本
不依赖外部库，测试核心WebSocket优化逻辑
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict, deque
import heapq

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 简化的WebSocket优化组件实现
class ConnectionState(Enum):
    """连接状态"""
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    RECONNECTING = "reconnecting"
    ERROR = "error"

class MessagePriority(Enum):
    """消息优先级"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4

@dataclass
class ConnectionConfig:
    """连接配置"""
    max_connections: int = 100
    heartbeat_interval: float = 30.0
    reconnect_delay: float = 5.0
    max_reconnect_attempts: int = 3
    connection_timeout: float = 10.0
    idle_timeout: float = 300.0
    max_message_size: int = 1024 * 1024  # 1MB
    enable_compression: bool = True
    enable_load_balancing: bool = True

@dataclass
class ConnectionMetrics:
    """连接指标"""
    connection_id: str = ""
    pile_id: str = ""
    state: ConnectionState = ConnectionState.DISCONNECTED
    connected_at: Optional[datetime] = None
    last_activity: Optional[datetime] = None
    messages_sent: int = 0
    messages_received: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    errors: int = 0
    reconnect_attempts: int = 0
    avg_response_time: float = 0.0
    last_error: Optional[str] = None
    health_score: float = 100.0

@dataclass
class QueuedMessage:
    """队列消息"""
    data: dict
    priority: MessagePriority
    pile_id: str
    created_at: datetime = field(default_factory=datetime.now)
    attempts: int = 0
    max_attempts: int = 3
    timeout: float = 30.0
    
    def __lt__(self, other):
        # 优先级高的消息排在前面（数值越大优先级越高）
        if self.priority.value != other.priority.value:
            return self.priority.value > other.priority.value
        # 相同优先级按创建时间排序
        return self.created_at < other.created_at

class SimpleConnectionPool:
    """简化的连接池"""
    
    def __init__(self, config: ConnectionConfig):
        self.config = config
        self.connections: Dict[str, ConnectionMetrics] = {}
        self.pile_connections: Dict[str, List[str]] = defaultdict(list)
        self.connection_count = 0
        self.total_connections = 0
    
    def add_connection(self, connection_id: str, pile_id: str) -> bool:
        """添加连接"""
        if self.connection_count >= self.config.max_connections:
            logger.warning(f"连接池已满，无法添加连接 {connection_id}")
            return False
        
        metrics = ConnectionMetrics(
            connection_id=connection_id,
            pile_id=pile_id,
            state=ConnectionState.CONNECTED,
            connected_at=datetime.now(),
            last_activity=datetime.now()
        )
        
        self.connections[connection_id] = metrics
        self.pile_connections[pile_id].append(connection_id)
        self.connection_count += 1
        self.total_connections += 1
        
        logger.info(f"连接 {connection_id} 已添加到池中 (桩ID: {pile_id})")
        return True
    
    def remove_connection(self, connection_id: str) -> bool:
        """移除连接"""
        if connection_id not in self.connections:
            return False
        
        metrics = self.connections[connection_id]
        pile_id = metrics.pile_id
        
        # 从连接池中移除
        del self.connections[connection_id]
        
        # 从桩连接列表中移除
        if pile_id in self.pile_connections:
            try:
                self.pile_connections[pile_id].remove(connection_id)
                if not self.pile_connections[pile_id]:
                    del self.pile_connections[pile_id]
            except ValueError:
                pass
        
        self.connection_count -= 1
        logger.info(f"连接 {connection_id} 已从池中移除")
        return True
    
    def get_connection_metrics(self, connection_id: str) -> Optional[ConnectionMetrics]:
        """获取连接指标"""
        return self.connections.get(connection_id)
    
    def get_pile_connections(self, pile_id: str) -> List[str]:
        """获取桩的所有连接"""
        return self.pile_connections.get(pile_id, [])
    
    def update_activity(self, connection_id: str):
        """更新连接活动时间"""
        if connection_id in self.connections:
            self.connections[connection_id].last_activity = datetime.now()
    
    def get_stats(self) -> dict:
        """获取连接池统计"""
        active_connections = sum(1 for m in self.connections.values() 
                               if m.state == ConnectionState.CONNECTED)
        
        total_messages_sent = sum(m.messages_sent for m in self.connections.values())
        total_messages_received = sum(m.messages_received for m in self.connections.values())
        total_errors = sum(m.errors for m in self.connections.values())
        
        return {
            "total_connections": self.total_connections,
            "active_connections": active_connections,
            "connection_count": self.connection_count,
            "pile_count": len(self.pile_connections),
            "messages_sent": total_messages_sent,
            "messages_received": total_messages_received,
            "errors": total_errors,
            "pool_utilization": (self.connection_count / self.config.max_connections) * 100
        }

class SimpleMessageQueue:
    """简化的消息队列"""
    
    def __init__(self):
        self.queues: Dict[str, List[QueuedMessage]] = defaultdict(list)
        self.priority_queue: List[QueuedMessage] = []
        self.message_count = 0
    
    def enqueue(self, message: QueuedMessage) -> bool:
        """入队消息"""
        try:
            # 添加到桩特定队列
            self.queues[message.pile_id].append(message)
            
            # 添加到优先级队列
            heapq.heappush(self.priority_queue, message)
            
            self.message_count += 1
            logger.debug(f"消息已入队: {message.pile_id} - {message.priority.name}")
            return True
        except Exception as e:
            logger.error(f"消息入队失败: {e}")
            return False
    
    def dequeue(self, pile_id: str = None) -> Optional[QueuedMessage]:
        """出队消息"""
        try:
            if pile_id:
                # 从特定桩队列出队
                if pile_id in self.queues and self.queues[pile_id]:
                    message = self.queues[pile_id].pop(0)
                    self.message_count -= 1
                    return message
            else:
                # 从优先级队列出队
                if self.priority_queue:
                    message = heapq.heappop(self.priority_queue)
                    # 同时从桩队列中移除
                    if message.pile_id in self.queues:
                        try:
                            self.queues[message.pile_id].remove(message)
                        except ValueError:
                            pass
                    self.message_count -= 1
                    return message
            
            return None
        except Exception as e:
            logger.error(f"消息出队失败: {e}")
            return None
    
    def get_queue_size(self, pile_id: str = None) -> int:
        """获取队列大小"""
        if pile_id:
            return len(self.queues.get(pile_id, []))
        return len(self.priority_queue)
    
    def clear_queue(self, pile_id: str = None):
        """清空队列"""
        if pile_id:
            if pile_id in self.queues:
                self.message_count -= len(self.queues[pile_id])
                del self.queues[pile_id]
        else:
            self.message_count = 0
            self.queues.clear()
            self.priority_queue.clear()

class SimpleWebSocketOptimizer:
    """简化的WebSocket优化器"""
    
    def __init__(self, config: ConnectionConfig):
        self.config = config
        self.connection_pool = SimpleConnectionPool(config)
        self.message_queue = SimpleMessageQueue()
        self.is_running = False
        self.start_time = datetime.now()
        
        # 性能指标
        self.global_metrics = {
            "total_messages_processed": 0,
            "avg_response_time": 0.0,
            "error_rate": 0.0,
            "throughput": 0.0,
            "uptime_seconds": 0
        }
        
        # 健康监控
        self.health_checks = {
            "connection_pool": True,
            "message_queue": True,
            "performance": True
        }
    
    async def start(self):
        """启动优化器"""
        self.is_running = True
        self.start_time = datetime.now()
        logger.info("WebSocket优化器已启动")
    
    async def stop(self):
        """停止优化器"""
        self.is_running = False
        logger.info("WebSocket优化器已停止")
    
    def add_connection(self, connection_id: str, pile_id: str) -> bool:
        """添加连接"""
        return self.connection_pool.add_connection(connection_id, pile_id)
    
    def remove_connection(self, connection_id: str) -> bool:
        """移除连接"""
        return self.connection_pool.remove_connection(connection_id)
    
    async def send_message(self, pile_id: str, message: dict, 
                          priority: MessagePriority = MessagePriority.NORMAL) -> bool:
        """发送消息"""
        try:
            # 创建队列消息
            queued_msg = QueuedMessage(
                data=message,
                priority=priority,
                pile_id=pile_id
            )
            
            # 入队
            if not self.message_queue.enqueue(queued_msg):
                return False
            
            # 模拟发送处理
            await asyncio.sleep(0.01)  # 模拟网络延迟
            
            # 更新指标
            connections = self.connection_pool.get_pile_connections(pile_id)
            for conn_id in connections:
                metrics = self.connection_pool.get_connection_metrics(conn_id)
                if metrics:
                    metrics.messages_sent += 1
                    metrics.last_activity = datetime.now()
            
            self.global_metrics["total_messages_processed"] += 1
            
            # 出队（模拟消息已发送）
            self.message_queue.dequeue(pile_id)
            
            logger.debug(f"消息已发送到桩 {pile_id}: {message.get('action', 'unknown')}")
            return True
            
        except Exception as e:
            logger.error(f"发送消息失败: {e}")
            return False
    
    async def broadcast_message(self, message: dict, 
                               priority: MessagePriority = MessagePriority.NORMAL) -> int:
        """广播消息"""
        success_count = 0
        
        for pile_id in self.connection_pool.pile_connections.keys():
            if await self.send_message(pile_id, message, priority):
                success_count += 1
        
        logger.info(f"广播消息完成，成功发送到 {success_count} 个桩")
        return success_count
    
    def get_connection_metrics(self, connection_id: str) -> Optional[dict]:
        """获取连接指标"""
        metrics = self.connection_pool.get_connection_metrics(connection_id)
        if metrics:
            return {
                "connection_id": metrics.connection_id,
                "pile_id": metrics.pile_id,
                "state": metrics.state.value,
                "connected_at": metrics.connected_at.isoformat() if metrics.connected_at else None,
                "last_activity": metrics.last_activity.isoformat() if metrics.last_activity else None,
                "messages_sent": metrics.messages_sent,
                "messages_received": metrics.messages_received,
                "errors": metrics.errors,
                "health_score": metrics.health_score
            }
        return None
    
    def get_pile_metrics(self, pile_id: str) -> Optional[dict]:
        """获取桩指标"""
        connections = self.connection_pool.get_pile_connections(pile_id)
        if not connections:
            return None
        
        total_messages_sent = 0
        total_messages_received = 0
        total_errors = 0
        connection_details = []
        
        for conn_id in connections:
            metrics = self.connection_pool.get_connection_metrics(conn_id)
            if metrics:
                total_messages_sent += metrics.messages_sent
                total_messages_received += metrics.messages_received
                total_errors += metrics.errors
                connection_details.append({
                    "connection_id": conn_id,
                    "state": metrics.state.value,
                    "last_activity": metrics.last_activity.isoformat() if metrics.last_activity else None
                })
        
        return {
            "pile_id": pile_id,
            "connection_count": len(connections),
            "messages_sent": total_messages_sent,
            "messages_received": total_messages_received,
            "errors": total_errors,
            "queue_size": self.message_queue.get_queue_size(pile_id),
            "connections": connection_details
        }
    
    def get_global_metrics(self) -> dict:
        """获取全局指标"""
        uptime = (datetime.now() - self.start_time).total_seconds()
        self.global_metrics["uptime_seconds"] = int(uptime)
        
        # 计算吞吐量
        if uptime > 0:
            self.global_metrics["throughput"] = self.global_metrics["total_messages_processed"] / uptime
        
        # 添加连接池统计
        pool_stats = self.connection_pool.get_stats()
        
        return {
            **self.global_metrics,
            **pool_stats,
            "queue_size": self.message_queue.message_count,
            "is_running": self.is_running
        }
    
    def health_check(self) -> dict:
        """健康检查"""
        health_score = 100
        issues = []
        
        # 检查连接池
        pool_stats = self.connection_pool.get_stats()
        if pool_stats["pool_utilization"] > 90:
            health_score -= 20
            issues.append("连接池使用率过高")
        
        # 检查消息队列
        if self.message_queue.message_count > 1000:
            health_score -= 15
            issues.append("消息队列积压")
        
        # 检查错误率
        total_messages = pool_stats["messages_sent"] + pool_stats["messages_received"]
        if total_messages > 0:
            error_rate = pool_stats["errors"] / total_messages
            if error_rate > 0.1:
                health_score -= 25
                issues.append(f"错误率过高: {error_rate:.1%}")
        
        # 确定健康状态
        if health_score >= 80:
            status = "healthy"
        elif health_score >= 60:
            status = "degraded"
        else:
            status = "unhealthy"
        
        return {
            "status": status,
            "health_score": health_score,
            "issues": issues,
            "timestamp": datetime.now().isoformat(),
            "checks": self.health_checks,
            "metrics": self.get_global_metrics()
        }

class BasicWebSocketTester:
    """基础WebSocket测试器"""
    
    def __init__(self):
        self.test_results = []
        self.optimizer = None
    
    def log_test_result(self, test_name: str, success: bool, details: str = ""):
        """记录测试结果"""
        result = {
            "test_name": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✓" if success else "✗"
        logger.info(f"{status} {test_name}: {details}")
    
    async def test_connection_config(self):
        """测试连接配置"""
        try:
            # 测试默认配置
            config = ConnectionConfig()
            assert config.max_connections == 100
            assert config.heartbeat_interval == 30.0
            assert config.reconnect_delay == 5.0
            
            # 测试自定义配置
            custom_config = ConnectionConfig(
                max_connections=50,
                heartbeat_interval=15.0,
                reconnect_delay=2.0
            )
            assert custom_config.max_connections == 50
            assert custom_config.heartbeat_interval == 15.0
            
            self.log_test_result("连接配置测试", True, "配置参数验证通过")
            
        except Exception as e:
            self.log_test_result("连接配置测试", False, f"配置测试失败: {e}")
    
    async def test_connection_pool(self):
        """测试连接池"""
        try:
            config = ConnectionConfig(max_connections=5)
            pool = SimpleConnectionPool(config)
            
            # 测试添加连接
            assert pool.add_connection("conn1", "pile1") is True
            assert pool.add_connection("conn2", "pile1") is True
            assert pool.add_connection("conn3", "pile2") is True
            
            # 测试连接统计
            stats = pool.get_stats()
            assert stats["connection_count"] == 3
            assert stats["pile_count"] == 2
            
            # 测试获取桩连接
            pile1_conns = pool.get_pile_connections("pile1")
            assert len(pile1_conns) == 2
            assert "conn1" in pile1_conns
            assert "conn2" in pile1_conns
            
            # 测试移除连接
            assert pool.remove_connection("conn1") is True
            assert pool.get_stats()["connection_count"] == 2
            
            # 测试连接池满的情况
            for i in range(4, 10):  # 添加更多连接直到满
                pool.add_connection(f"conn{i}", f"pile{i}")
            
            # 应该无法再添加连接
            assert pool.add_connection("conn_overflow", "pile_overflow") is False
            
            self.log_test_result("连接池测试", True, "连接池功能正常")
            
        except Exception as e:
            self.log_test_result("连接池测试", False, f"连接池测试失败: {e}")
    
    async def test_message_queue(self):
        """测试消息队列"""
        try:
            queue = SimpleMessageQueue()
            
            # 创建不同优先级的消息
            msg1 = QueuedMessage(
                data={"action": "low_priority"},
                priority=MessagePriority.LOW,
                pile_id="pile1"
            )
            
            msg2 = QueuedMessage(
                data={"action": "high_priority"},
                priority=MessagePriority.HIGH,
                pile_id="pile1"
            )
            
            msg3 = QueuedMessage(
                data={"action": "critical"},
                priority=MessagePriority.CRITICAL,
                pile_id="pile2"
            )
            
            # 入队消息
            assert queue.enqueue(msg1) is True
            assert queue.enqueue(msg2) is True
            assert queue.enqueue(msg3) is True
            
            # 测试队列大小
            assert queue.get_queue_size() == 3
            assert queue.get_queue_size("pile1") == 2
            assert queue.get_queue_size("pile2") == 1
            
            # 测试优先级出队（应该先出高优先级消息）
            dequeued = queue.dequeue()
            assert dequeued is not None
            assert dequeued.priority == MessagePriority.CRITICAL
            
            dequeued = queue.dequeue()
            assert dequeued is not None
            assert dequeued.priority == MessagePriority.HIGH
            
            # 测试特定桩出队
            dequeued = queue.dequeue("pile1")
            assert dequeued is not None
            assert dequeued.pile_id == "pile1"
            
            self.log_test_result("消息队列测试", True, "消息队列功能正常")
            
        except Exception as e:
            self.log_test_result("消息队列测试", False, f"消息队列测试失败: {e}")
    
    async def test_websocket_optimizer(self):
        """测试WebSocket优化器"""
        try:
            config = ConnectionConfig(max_connections=10)
            self.optimizer = SimpleWebSocketOptimizer(config)
            
            # 启动优化器
            await self.optimizer.start()
            assert self.optimizer.is_running is True
            
            # 添加连接
            assert self.optimizer.add_connection("conn1", "pile1") is True
            assert self.optimizer.add_connection("conn2", "pile2") is True
            
            # 测试发送消息
            message = {"action": "StatusNotification", "status": "Available"}
            assert await self.optimizer.send_message("pile1", message, MessagePriority.NORMAL) is True
            
            # 测试广播消息
            broadcast_msg = {"action": "Reset", "type": "Soft"}
            success_count = await self.optimizer.broadcast_message(broadcast_msg, MessagePriority.HIGH)
            assert success_count == 2  # 应该发送到2个桩
            
            # 测试获取指标
            global_metrics = self.optimizer.get_global_metrics()
            assert global_metrics["total_messages_processed"] >= 3  # 1个单发 + 2个广播
            assert global_metrics["is_running"] is True
            
            pile_metrics = self.optimizer.get_pile_metrics("pile1")
            assert pile_metrics is not None
            assert pile_metrics["pile_id"] == "pile1"
            assert pile_metrics["connection_count"] == 1
            
            # 测试健康检查
            health = self.optimizer.health_check()
            assert "status" in health
            assert "health_score" in health
            assert health["health_score"] > 0
            
            # 停止优化器
            await self.optimizer.stop()
            assert self.optimizer.is_running is False
            
            self.log_test_result("WebSocket优化器测试", True, "优化器功能正常")
            
        except Exception as e:
            self.log_test_result("WebSocket优化器测试", False, f"优化器测试失败: {e}")
    
    async def test_performance_simulation(self):
        """测试性能模拟"""
        try:
            config = ConnectionConfig(max_connections=20)
            optimizer = SimpleWebSocketOptimizer(config)
            await optimizer.start()
            
            # 添加多个连接
            pile_count = 5
            for i in range(pile_count):
                optimizer.add_connection(f"conn_{i}", f"pile_{i}")
            
            # 性能测试
            start_time = time.time()
            message_count = 100
            
            for i in range(message_count):
                pile_id = f"pile_{i % pile_count}"
                message = {
                    "action": "test_message",
                    "id": i,
                    "timestamp": datetime.now().isoformat()
                }
                await optimizer.send_message(pile_id, message, MessagePriority.NORMAL)
            
            end_time = time.time()
            duration = end_time - start_time
            throughput = message_count / duration
            
            # 验证性能指标
            global_metrics = optimizer.get_global_metrics()
            assert global_metrics["total_messages_processed"] >= message_count
            assert global_metrics["throughput"] > 0
            
            await optimizer.stop()
            
            self.log_test_result(
                "性能模拟测试", 
                True, 
                f"处理 {message_count} 消息用时 {duration:.2f}s，吞吐量 {throughput:.1f} msg/s"
            )
            
        except Exception as e:
            self.log_test_result("性能模拟测试", False, f"性能测试失败: {e}")
    
    async def test_error_scenarios(self):
        """测试错误场景"""
        try:
            config = ConnectionConfig(max_connections=2)
            optimizer = SimpleWebSocketOptimizer(config)
            await optimizer.start()
            
            # 测试连接池满的情况
            assert optimizer.add_connection("conn1", "pile1") is True
            assert optimizer.add_connection("conn2", "pile2") is True
            assert optimizer.add_connection("conn3", "pile3") is False  # 应该失败
            
            # 测试发送消息到不存在的桩
            result = await optimizer.send_message("nonexistent_pile", {"action": "test"}, MessagePriority.NORMAL)
            # 这应该成功（消息会入队，但没有实际连接处理）
            assert result is True
            
            # 测试移除不存在的连接
            assert optimizer.remove_connection("nonexistent_conn") is False
            
            # 测试获取不存在桩的指标
            metrics = optimizer.get_pile_metrics("nonexistent_pile")
            assert metrics is None
            
            await optimizer.stop()
            
            self.log_test_result("错误场景测试", True, "错误处理正常")
            
        except Exception as e:
            self.log_test_result("错误场景测试", False, f"错误场景测试失败: {e}")
    
    async def test_connection_lifecycle(self):
        """测试连接生命周期"""
        try:
            config = ConnectionConfig()
            optimizer = SimpleWebSocketOptimizer(config)
            await optimizer.start()
            
            # 连接建立
            connection_id = "lifecycle_conn"
            pile_id = "lifecycle_pile"
            
            assert optimizer.add_connection(connection_id, pile_id) is True
            
            # 获取连接指标
            metrics = optimizer.get_connection_metrics(connection_id)
            assert metrics is not None
            assert metrics["connection_id"] == connection_id
            assert metrics["pile_id"] == pile_id
            assert metrics["state"] == ConnectionState.CONNECTED.value
            
            # 发送消息（更新活动时间）
            message = {"action": "Heartbeat"}
            assert await optimizer.send_message(pile_id, message, MessagePriority.NORMAL) is True
            
            # 验证消息计数更新
            updated_metrics = optimizer.get_connection_metrics(connection_id)
            assert updated_metrics["messages_sent"] == 1
            
            # 连接断开
            assert optimizer.remove_connection(connection_id) is True
            
            # 验证连接已移除
            removed_metrics = optimizer.get_connection_metrics(connection_id)
            assert removed_metrics is None
            
            await optimizer.stop()
            
            self.log_test_result("连接生命周期测试", True, "连接生命周期管理正常")
            
        except Exception as e:
            self.log_test_result("连接生命周期测试", False, f"生命周期测试失败: {e}")
    
    async def run_all_tests(self):
        """运行所有测试"""
        logger.info("开始基础WebSocket优化测试")
        
        test_methods = [
            self.test_connection_config,
            self.test_connection_pool,
            self.test_message_queue,
            self.test_websocket_optimizer,
            self.test_performance_simulation,
            self.test_error_scenarios,
            self.test_connection_lifecycle
        ]
        
        for test_method in test_methods:
            try:
                await test_method()
            except Exception as e:
                logger.error(f"测试方法 {test_method.__name__} 执行失败: {e}")
        
        # 生成测试报告
        self.generate_test_report()
    
    def generate_test_report(self):
        """生成测试报告"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        logger.info("\n" + "="*60)
        logger.info("基础WebSocket优化测试报告")
        logger.info("="*60)
        logger.info(f"总测试数: {total_tests}")
        logger.info(f"通过测试: {passed_tests}")
        logger.info(f"失败测试: {failed_tests}")
        logger.info(f"成功率: {success_rate:.1f}%")
        logger.info("="*60)
        
        if failed_tests > 0:
            logger.info("失败的测试:")
            for result in self.test_results:
                if not result["success"]:
                    logger.info(f"  ✗ {result['test_name']}: {result['details']}")
        
        logger.info("\n详细测试结果:")
        for result in self.test_results:
            status = "✓" if result["success"] else "✗"
            logger.info(f"  {status} {result['test_name']}: {result['details']}")
        
        logger.info("="*60)
        
        # 保存测试结果
        try:
            with open("basic_websocket_test_results.json", "w", encoding="utf-8") as f:
                json.dump({
                    "summary": {
                        "total_tests": total_tests,
                        "passed_tests": passed_tests,
                        "failed_tests": failed_tests,
                        "success_rate": success_rate,
                        "timestamp": datetime.now().isoformat()
                    },
                    "results": self.test_results
                }, f, indent=2, ensure_ascii=False)
            
            logger.info("测试结果已保存到 basic_websocket_test_results.json")
        except Exception as e:
            logger.error(f"保存测试结果失败: {e}")

async def main():
    """主函数"""
    tester = BasicWebSocketTester()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())