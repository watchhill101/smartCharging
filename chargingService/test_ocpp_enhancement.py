"""OCPP协议增强功能测试
测试错误处理、重试机制和监控功能
"""

import asyncio
import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch

from ocpp_error_handler import (
    OCPPErrorHandler, OCPPMessageValidator, 
    RetryStrategy, OCPPErrorType,
    error_handler, message_validator
)
from ocpp_monitoring import OCPPMonitoringService, monitoring_service
from ocpp_service import OCPPService

class TestOCPPErrorHandler:
    """OCPP错误处理器测试"""
    
    def setup_method(self):
        """测试前准备"""
        self.error_handler = OCPPErrorHandler()
    
    def test_retry_config(self):
        """测试重试配置"""
        # 测试默认配置
        config = self.error_handler.get_retry_config("UnknownAction")
        assert config["max_retries"] == 2
        assert config["strategy"] == RetryStrategy.EXPONENTIAL_BACKOFF
        
        # 测试特定操作配置
        config = self.error_handler.get_retry_config("RemoteStartTransaction")
        assert config["max_retries"] == 3
        assert config["timeout"] == 30.0
    
    def test_calculate_delay(self):
        """测试延迟计算"""
        # 指数退避
        delay = self.error_handler.calculate_delay(
            0, RetryStrategy.EXPONENTIAL_BACKOFF, 2.0, 30.0
        )
        assert delay == 2.0
        
        delay = self.error_handler.calculate_delay(
            2, RetryStrategy.EXPONENTIAL_BACKOFF, 2.0, 30.0
        )
        assert delay == 8.0
        
        # 线性退避
        delay = self.error_handler.calculate_delay(
            1, RetryStrategy.LINEAR_BACKOFF, 3.0, 15.0
        )
        assert delay == 6.0
        
        # 固定间隔
        delay = self.error_handler.calculate_delay(
            5, RetryStrategy.FIXED_INTERVAL, 5.0, 60.0
        )
        assert delay == 5.0
    
    @pytest.mark.asyncio
    async def test_execute_with_retry_success(self):
        """测试重试机制 - 成功场景"""
        async def mock_operation():
            return {"status": "success"}
        
        result = await self.error_handler.execute_with_retry(
            "RemoteStartTransaction",
            "pile_001",
            mock_operation
        )
        
        assert result["status"] == "success"
        
        # 检查统计信息
        stats = self.error_handler.get_pile_health_status("pile_001")
        assert stats["status"] in ["healthy", "unknown"]
    
    @pytest.mark.asyncio
    async def test_execute_with_retry_failure(self):
        """测试重试机制 - 失败场景"""
        call_count = 0
        
        async def mock_operation():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("Connection failed")
        
        with pytest.raises(ConnectionError):
            await self.error_handler.execute_with_retry(
                "RemoteStartTransaction",
                "pile_002",
                mock_operation
            )
        
        # 应该重试3次 + 初始尝试 = 4次
        assert call_count == 4
        
        # 检查错误统计
        stats = self.error_handler.get_pile_health_status("pile_002")
        assert stats["status"] in ["critical", "warning"]
    
    @pytest.mark.asyncio
    async def test_execute_with_retry_timeout(self):
        """测试重试机制 - 超时场景"""
        async def mock_operation():
            await asyncio.sleep(2)  # 模拟长时间操作
            return {"status": "success"}
        
        # 设置较短的超时时间
        self.error_handler.retry_configs["TestAction"] = {
            "max_retries": 1,
            "strategy": RetryStrategy.FIXED_INTERVAL,
            "base_delay": 0.1,
            "max_delay": 1.0,
            "timeout": 0.5  # 0.5秒超时
        }
        
        with pytest.raises(asyncio.TimeoutError):
            await self.error_handler.execute_with_retry(
                "TestAction",
                "pile_003",
                mock_operation
            )
    
    def test_pile_health_status(self):
        """测试充电桩健康状态"""
        # 记录一些成功和失败的操作
        self.error_handler._record_success("pile_004", "RemoteStartTransaction", 0)
        self.error_handler._record_success("pile_004", "RemoteStartTransaction", 0)
        self.error_handler._record_error("pile_004", "RemoteStartTransaction", OCPPErrorType.TIMEOUT_ERROR, 0)
        
        health = self.error_handler.get_pile_health_status("pile_004")
        
        assert health["total_operations"] == 3
        assert health["success_rate"] == 2/3
        assert health["status"] in ["healthy", "warning"]
    
    def test_error_statistics(self):
        """测试错误统计"""
        # 添加一些测试数据
        self.error_handler._record_error("pile_005", "Reset", OCPPErrorType.COMMUNICATION_ERROR, 0)
        self.error_handler._record_error("pile_006", "UnlockConnector", OCPPErrorType.VALIDATION_ERROR, 0)
        
        stats = self.error_handler.get_error_statistics()
        
        assert stats["total_piles"] >= 2
        assert stats["total_errors"] >= 2
        assert len(stats["error_details"]) >= 2

class TestOCPPMessageValidator:
    """OCPP消息验证器测试"""
    
    def setup_method(self):
        """测试前准备"""
        self.validator = OCPPMessageValidator()
    
    def test_validate_boot_notification(self):
        """测试BootNotification消息验证"""
        # 有效消息
        valid_payload = {
            "chargePointVendor": "TestVendor",
            "chargePointModel": "TestModel",
            "chargePointSerialNumber": "12345"
        }
        assert self.validator.validate_message("BootNotification", valid_payload)
        
        # 缺少必需字段
        invalid_payload = {
            "chargePointVendor": "TestVendor"
            # 缺少 chargePointModel
        }
        assert not self.validator.validate_message("BootNotification", invalid_payload)
    
    def test_validate_start_transaction(self):
        """测试StartTransaction消息验证"""
        # 有效消息
        valid_payload = {
            "connectorId": 1,
            "idTag": "RFID123",
            "meterStart": 1000,
            "timestamp": "2024-01-15T10:30:00Z"
        }
        assert self.validator.validate_message("StartTransaction", valid_payload)
        
        # 无效连接器ID
        invalid_payload = {
            "connectorId": -1,  # 负数无效
            "idTag": "RFID123",
            "meterStart": 1000,
            "timestamp": "2024-01-15T10:30:00Z"
        }
        assert not self.validator.validate_message("StartTransaction", invalid_payload)
        
        # 无效时间戳
        invalid_payload = {
            "connectorId": 1,
            "idTag": "RFID123",
            "meterStart": 1000,
            "timestamp": "invalid-timestamp"
        }
        assert not self.validator.validate_message("StartTransaction", invalid_payload)
    
    def test_validate_unknown_action(self):
        """测试未知操作验证"""
        payload = {"someField": "someValue"}
        assert not self.validator.validate_message("UnknownAction", payload)
    
    def test_timestamp_validation(self):
        """测试时间戳验证"""
        # 有效时间戳格式
        assert self.validator._validate_timestamp("2024-01-15T10:30:00Z")
        assert self.validator._validate_timestamp("2024-01-15T10:30:00.123Z")
        assert self.validator._validate_timestamp("2024-01-15T10:30:00+08:00")
        
        # 无效时间戳格式
        assert not self.validator._validate_timestamp("2024-01-15 10:30:00")
        assert not self.validator._validate_timestamp("invalid")
        assert not self.validator._validate_timestamp(None)
    
    def test_connector_id_validation(self):
        """测试连接器ID验证"""
        # 有效连接器ID
        assert self.validator._validate_connector_id(0)
        assert self.validator._validate_connector_id(1)
        assert self.validator._validate_connector_id(10)
        
        # 无效连接器ID
        assert not self.validator._validate_connector_id(-1)
        assert not self.validator._validate_connector_id("1")
        assert not self.validator._validate_connector_id(None)
        assert not self.validator._validate_connector_id(1.5)

class TestOCPPMonitoringService:
    """OCPP监控服务测试"""
    
    def setup_method(self):
        """测试前准备"""
        self.monitoring = OCPPMonitoringService()
    
    def test_record_message(self):
        """测试消息记录"""
        # 记录成功消息
        self.monitoring.record_message("RemoteStartTransaction", True, 1.5)
        
        # 记录失败消息
        self.monitoring.record_message("RemoteStartTransaction", False, 2.0)
        
        # 检查统计
        assert self.monitoring.message_counts["total"] == 2
        assert self.monitoring.message_counts["successful"] == 1
        assert self.monitoring.message_counts["failed"] == 1
        
        # 检查按操作类型统计
        action_stats = self.monitoring.message_counts["by_action"]["RemoteStartTransaction"]
        assert action_stats["success"] == 1
        assert action_stats["failed"] == 1
        
        # 检查响应时间记录
        assert len(self.monitoring.response_times) == 2
        assert 1.5 in self.monitoring.response_times
        assert 2.0 in self.monitoring.response_times
    
    def test_get_statistics(self):
        """测试获取统计信息"""
        # 添加一些测试数据
        self.monitoring.record_message("RemoteStartTransaction", True, 1.0)
        self.monitoring.record_message("RemoteStopTransaction", True, 1.5)
        self.monitoring.record_message("Reset", False, 2.0)
        
        stats = self.monitoring.get_statistics()
        
        assert stats.total_messages == 3
        assert stats.successful_operations == 2
        assert stats.failed_operations == 1
        assert stats.average_response_time == (1.0 + 1.5 + 2.0) / 3
        
        # 检查操作分解统计
        assert "RemoteStartTransaction" in stats.operation_breakdown
        assert "RemoteStopTransaction" in stats.operation_breakdown
        assert "Reset" in stats.operation_breakdown
    
    def test_cleanup_old_data(self):
        """测试清理旧数据"""
        # 添加一些旧的小时数据
        old_hour = (datetime.now() - timedelta(hours=25)).strftime("%Y-%m-%d %H:00")
        self.monitoring.message_counts["by_hour"][old_hour] = 10
        
        # 添加当前小时数据
        current_hour = datetime.now().strftime("%Y-%m-%d %H:00")
        self.monitoring.message_counts["by_hour"][current_hour] = 5
        
        # 执行清理
        self.monitoring._cleanup_old_data()
        
        # 检查旧数据被清理
        assert old_hour not in self.monitoring.message_counts["by_hour"]
        assert current_hour in self.monitoring.message_counts["by_hour"]

@pytest.mark.asyncio
class TestOCPPServiceIntegration:
    """OCPP服务集成测试"""
    
    def setup_method(self):
        """测试前准备"""
        self.ocpp_service = OCPPService()
    
    async def test_remote_start_with_retry(self):
        """测试带重试的远程启动"""
        with patch('main.manager') as mock_manager:
            mock_manager.send_message = AsyncMock()
            
            result = await self.ocpp_service.remote_start_transaction(
                "pile_001", "RFID123", 1
            )
            
            # 应该返回成功结果
            assert result["status"] == "success"
            assert result["action"] == "RemoteStartTransaction"
            
            # 验证消息发送被调用
            mock_manager.send_message.assert_called_once()
    
    async def test_remote_start_validation_error(self):
        """测试远程启动参数验证错误"""
        # 使用无效的连接器ID
        result = await self.ocpp_service.remote_start_transaction(
            "pile_001", "RFID123", -1  # 无效连接器ID
        )
        
        # 应该返回错误结果
        assert result["status"] == "error"
        assert "无效的RemoteStartTransaction参数" in result["error"]
    
    async def test_message_handling_with_validation(self):
        """测试消息处理和验证"""
        # 测试有效的CALL消息
        valid_message = json.dumps([
            2,  # CALL
            "12345",  # message_id
            "BootNotification",  # action
            {
                "chargePointVendor": "TestVendor",
                "chargePointModel": "TestModel"
            }
        ])
        
        response = await self.ocpp_service.handle_message("pile_001", valid_message)
        
        # 应该返回CALLRESULT响应
        assert response is not None
        parsed_response = json.loads(response)
        assert parsed_response[0] == 3  # CALLRESULT
        assert parsed_response[1] == "12345"  # 相同的message_id
    
    async def test_message_handling_invalid_format(self):
        """测试无效格式消息处理"""
        # 测试无效JSON
        invalid_json = "invalid json"
        
        response = await self.ocpp_service.handle_message("pile_001", invalid_json)
        
        # 应该返回错误响应
        assert response is not None
        parsed_response = json.loads(response)
        assert parsed_response[0] == 4  # CALLERROR
        assert "FormatViolation" in parsed_response[2]
    
    async def test_message_handling_missing_fields(self):
        """测试缺少字段的消息处理"""
        # 测试缺少必需字段的消息
        incomplete_message = json.dumps([
            2,  # CALL
            "12345",  # message_id
            "BootNotification",  # action
            {
                "chargePointVendor": "TestVendor"
                # 缺少 chargePointModel
            }
        ])
        
        response = await self.ocpp_service.handle_message("pile_001", incomplete_message)
        
        # 应该返回验证错误响应
        assert response is not None
        parsed_response = json.loads(response)
        assert parsed_response[0] == 4  # CALLERROR
        assert "FormatViolation" in parsed_response[2]

if __name__ == "__main__":
    # 运行测试
    pytest.main(["-v", __file__])