#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocket连接优化测试脚本
测试增强连接管理器和WebSocket优化器的功能
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Dict, List

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MockWebSocket:
    """模拟WebSocket连接"""
    
    def __init__(self, pile_id: str):
        self.pile_id = pile_id
        self.is_connected = True
        self.messages_sent = []
        self.messages_received = []
        self.last_activity = datetime.now()
    
    async def accept(self):
        """接受连接"""
        logger.info(f"MockWebSocket {self.pile_id} 连接已接受")
    
    async def send_json(self, data: dict):
        """发送JSON消息"""
        if not self.is_connected:
            raise Exception("WebSocket连接已断开")
        
        self.messages_sent.append({
            "data": data,
            "timestamp": datetime.now().isoformat()
        })
        self.last_activity = datetime.now()
        logger.debug(f"MockWebSocket {self.pile_id} 发送消息: {data.get('action', 'unknown')}")
    
    async def receive_json(self) -> dict:
        """接收JSON消息"""
        if not self.is_connected:
            raise Exception("WebSocket连接已断开")
        
        # 模拟接收消息
        await asyncio.sleep(0.1)  # 模拟网络延迟
        
        message = {
            "action": "Heartbeat",
            "timestamp": datetime.now().isoformat(),
            "pile_id": self.pile_id
        }
        
        self.messages_received.append(message)
        self.last_activity = datetime.now()
        return message
    
    async def close(self):
        """关闭连接"""
        self.is_connected = False
        logger.info(f"MockWebSocket {self.pile_id} 连接已关闭")
    
    def get_stats(self) -> dict:
        """获取连接统计"""
        return {
            "pile_id": self.pile_id,
            "is_connected": self.is_connected,
            "messages_sent": len(self.messages_sent),
            "messages_received": len(self.messages_received),
            "last_activity": self.last_activity.isoformat()
        }

class WebSocketOptimizationTester:
    """WebSocket优化测试器"""
    
    def __init__(self):
        self.test_results = []
        self.mock_websockets: Dict[str, MockWebSocket] = {}
    
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
            from websocket_optimizer import ConnectionConfig
            
            # 测试默认配置
            config = ConnectionConfig()
            assert config.max_connections > 0
            assert config.heartbeat_interval > 0
            assert config.reconnect_delay > 0
            
            # 测试自定义配置
            custom_config = ConnectionConfig(
                max_connections=200,
                heartbeat_interval=20.0,
                reconnect_delay=3.0,
                max_reconnect_attempts=5
            )
            assert custom_config.max_connections == 200
            assert custom_config.heartbeat_interval == 20.0
            
            self.log_test_result("连接配置测试", True, "配置参数验证通过")
            
        except Exception as e:
            self.log_test_result("连接配置测试", False, f"配置测试失败: {e}")
    
    async def test_connection_states(self):
        """测试连接状态管理"""
        try:
            from websocket_optimizer import ConnectionState, ConnectionMetrics
            
            # 测试连接状态枚举
            states = [ConnectionState.CONNECTING, ConnectionState.CONNECTED, 
                     ConnectionState.DISCONNECTED, ConnectionState.RECONNECTING]
            assert len(states) == 4
            
            # 测试连接指标
            metrics = ConnectionMetrics()
            assert metrics.messages_sent == 0
            assert metrics.messages_received == 0
            assert metrics.errors == 0
            
            # 更新指标
            metrics.messages_sent = 10
            metrics.messages_received = 8
            metrics.errors = 1
            
            assert metrics.messages_sent == 10
            assert metrics.messages_received == 8
            assert metrics.errors == 1
            
            self.log_test_result("连接状态测试", True, "状态和指标管理正常")
            
        except Exception as e:
            self.log_test_result("连接状态测试", False, f"状态测试失败: {e}")
    
    async def test_message_priority(self):
        """测试消息优先级"""
        try:
            from websocket_optimizer import MessagePriority, QueuedMessage
            
            # 测试优先级枚举
            priorities = [MessagePriority.LOW, MessagePriority.NORMAL, 
                         MessagePriority.HIGH, MessagePriority.CRITICAL]
            assert len(priorities) == 4
            
            # 测试队列消息
            message = QueuedMessage(
                data={"action": "test"},
                priority=MessagePriority.HIGH,
                pile_id="test_pile"
            )
            
            assert message.priority == MessagePriority.HIGH
            assert message.pile_id == "test_pile"
            assert message.data["action"] == "test"
            
            self.log_test_result("消息优先级测试", True, "优先级系统正常")
            
        except Exception as e:
            self.log_test_result("消息优先级测试", False, f"优先级测试失败: {e}")
    
    async def test_enhanced_connection_manager(self):
        """测试增强连接管理器"""
        try:
            from enhanced_connection_manager import EnhancedConnectionManager
            from websocket_optimizer import ConnectionConfig
            
            # 创建测试配置
            config = ConnectionConfig(max_connections=10, heartbeat_interval=5.0)
            manager = EnhancedConnectionManager(config)
            
            # 启动管理器
            await manager.start()
            
            # 测试统计信息
            stats = await manager.get_connection_stats()
            assert stats.total_connections >= 0
            assert stats.active_connections >= 0
            
            # 测试健康检查
            health = await manager.health_check()
            assert "status" in health
            assert "health_score" in health
            assert "timestamp" in health
            
            # 停止管理器
            await manager.stop()
            
            self.log_test_result("增强连接管理器测试", True, "管理器功能正常")
            
        except Exception as e:
            self.log_test_result("增强连接管理器测试", False, f"管理器测试失败: {e}")
    
    async def test_websocket_optimizer(self):
        """测试WebSocket优化器"""
        try:
            from websocket_optimizer import WebSocketOptimizer, ConnectionConfig
            
            # 创建优化器
            config = ConnectionConfig(max_connections=5)
            optimizer = WebSocketOptimizer(config)
            
            # 启动优化器
            await optimizer.start()
            
            # 测试全局指标
            metrics = await optimizer.get_global_metrics()
            assert isinstance(metrics, dict)
            
            # 停止优化器
            await optimizer.stop()
            
            self.log_test_result("WebSocket优化器测试", True, "优化器功能正常")
            
        except Exception as e:
            self.log_test_result("WebSocket优化器测试", False, f"优化器测试失败: {e}")
    
    async def test_mock_connection_simulation(self):
        """测试模拟连接"""
        try:
            # 创建模拟WebSocket连接
            pile_ids = ["pile_001", "pile_002", "pile_003"]
            
            for pile_id in pile_ids:
                mock_ws = MockWebSocket(pile_id)
                self.mock_websockets[pile_id] = mock_ws
                
                # 测试连接
                await mock_ws.accept()
                
                # 测试发送消息
                test_message = {
                    "action": "StatusNotification",
                    "connectorId": 1,
                    "status": "Available"
                }
                await mock_ws.send_json(test_message)
                
                # 测试接收消息
                received = await mock_ws.receive_json()
                assert received["action"] == "Heartbeat"
                assert received["pile_id"] == pile_id
            
            # 验证所有连接的统计信息
            for pile_id, mock_ws in self.mock_websockets.items():
                stats = mock_ws.get_stats()
                assert stats["messages_sent"] >= 1
                assert stats["messages_received"] >= 1
                assert stats["is_connected"] is True
            
            self.log_test_result("模拟连接测试", True, f"成功创建和测试 {len(pile_ids)} 个模拟连接")
            
        except Exception as e:
            self.log_test_result("模拟连接测试", False, f"模拟连接测试失败: {e}")
    
    async def test_message_filtering(self):
        """测试消息过滤"""
        try:
            from enhanced_connection_manager import MessageFilter
            
            # 创建消息过滤器
            filter_obj = MessageFilter()
            
            # 添加过滤器 - 只允许特定类型的消息
            def action_filter(msg: dict) -> bool:
                allowed_actions = ["Heartbeat", "StatusNotification", "BootNotification"]
                return msg.get("action") in allowed_actions
            
            filter_obj.add_filter(action_filter)
            
            # 添加转换器 - 添加处理时间戳
            def add_processed_timestamp(msg: dict) -> dict:
                result = msg.copy()
                result["processed_at"] = datetime.now().isoformat()
                return result
            
            filter_obj.add_transformer(add_processed_timestamp)
            
            # 测试允许的消息
            allowed_message = {"action": "Heartbeat", "timestamp": datetime.now().isoformat()}
            assert filter_obj.should_process(allowed_message) is True
            
            transformed = filter_obj.transform_message(allowed_message)
            assert "processed_at" in transformed
            
            # 测试不允许的消息
            blocked_message = {"action": "UnknownAction", "data": "test"}
            assert filter_obj.should_process(blocked_message) is False
            
            self.log_test_result("消息过滤测试", True, "过滤器和转换器工作正常")
            
        except Exception as e:
            self.log_test_result("消息过滤测试", False, f"消息过滤测试失败: {e}")
    
    async def test_performance_metrics(self):
        """测试性能指标"""
        try:
            # 模拟性能测试
            start_time = time.time()
            
            # 执行一些操作
            operations = 1000
            for i in range(operations):
                # 模拟消息处理
                message = {
                    "action": "test",
                    "id": i,
                    "timestamp": datetime.now().isoformat()
                }
                # 模拟处理延迟
                await asyncio.sleep(0.001)
            
            end_time = time.time()
            duration = end_time - start_time
            ops_per_second = operations / duration
            
            # 验证性能指标
            assert ops_per_second > 0
            assert duration > 0
            
            self.log_test_result(
                "性能指标测试", 
                True, 
                f"处理 {operations} 个操作用时 {duration:.2f}s，速率 {ops_per_second:.1f} ops/s"
            )
            
        except Exception as e:
            self.log_test_result("性能指标测试", False, f"性能测试失败: {e}")
    
    async def test_error_handling(self):
        """测试错误处理"""
        try:
            # 测试连接错误处理
            mock_ws = MockWebSocket("error_test_pile")
            await mock_ws.accept()
            
            # 模拟连接断开
            await mock_ws.close()
            
            # 尝试发送消息到已断开的连接
            try:
                await mock_ws.send_json({"action": "test"})
                # 如果没有抛出异常，测试失败
                self.log_test_result("错误处理测试", False, "应该抛出连接断开异常")
            except Exception as expected_error:
                # 预期的异常
                self.log_test_result(
                    "错误处理测试", 
                    True, 
                    f"正确处理连接断开错误: {expected_error}"
                )
            
        except Exception as e:
            self.log_test_result("错误处理测试", False, f"错误处理测试失败: {e}")
    
    async def cleanup_mock_connections(self):
        """清理模拟连接"""
        try:
            for pile_id, mock_ws in self.mock_websockets.items():
                if mock_ws.is_connected:
                    await mock_ws.close()
            
            self.mock_websockets.clear()
            logger.info("模拟连接清理完成")
            
        except Exception as e:
            logger.error(f"清理模拟连接失败: {e}")
    
    async def run_all_tests(self):
        """运行所有测试"""
        logger.info("开始WebSocket优化功能测试")
        
        test_methods = [
            self.test_connection_config,
            self.test_connection_states,
            self.test_message_priority,
            self.test_enhanced_connection_manager,
            self.test_websocket_optimizer,
            self.test_mock_connection_simulation,
            self.test_message_filtering,
            self.test_performance_metrics,
            self.test_error_handling
        ]
        
        for test_method in test_methods:
            try:
                await test_method()
            except Exception as e:
                logger.error(f"测试方法 {test_method.__name__} 执行失败: {e}")
        
        # 清理资源
        await self.cleanup_mock_connections()
        
        # 生成测试报告
        self.generate_test_report()
    
    def generate_test_report(self):
        """生成测试报告"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        logger.info("\n" + "="*60)
        logger.info("WebSocket优化功能测试报告")
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
        
        # 保存测试结果到文件
        try:
            import json
            with open("websocket_optimization_test_results.json", "w", encoding="utf-8") as f:
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
            
            logger.info("测试结果已保存到 websocket_optimization_test_results.json")
        except Exception as e:
            logger.error(f"保存测试结果失败: {e}")

async def main():
    """主函数"""
    tester = WebSocketOptimizationTester()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())