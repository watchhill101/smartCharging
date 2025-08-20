"""OCPP协议增强功能简单测试
不依赖pytest的基础功能测试
"""

import asyncio
import json
from datetime import datetime, timedelta

# 导入我们的模块
try:
    from ocpp_error_handler import (
        OCPPErrorHandler, OCPPMessageValidator, 
        RetryStrategy, OCPPErrorType
    )
    from ocpp_monitoring import OCPPMonitoringService
    print("✓ 成功导入OCPP增强模块")
except ImportError as e:
    print(f"✗ 导入模块失败: {e}")
    exit(1)

def test_error_handler():
    """测试错误处理器"""
    print("\n=== 测试错误处理器 ===")
    
    error_handler = OCPPErrorHandler()
    
    # 测试重试配置
    config = error_handler.get_retry_config("RemoteStartTransaction")
    print(f"RemoteStartTransaction重试配置: {config}")
    assert config["max_retries"] == 3
    assert config["timeout"] == 30.0
    print("✓ 重试配置测试通过")
    
    # 测试延迟计算
    delay = error_handler.calculate_delay(0, RetryStrategy.EXPONENTIAL_BACKOFF, 2.0, 30.0)
    assert delay == 2.0
    print(f"✓ 延迟计算测试通过: {delay}秒")
    
    # 测试健康状态
    error_handler._record_success("pile_001", "RemoteStartTransaction", 1.5)
    error_handler._record_error("pile_001", "RemoteStartTransaction", OCPPErrorType.TIMEOUT_ERROR, 2.0)
    
    health = error_handler.get_pile_health_status("pile_001")
    print(f"充电桩健康状态: {health}")
    assert health["total_operations"] == 2
    print("✓ 健康状态测试通过")

def test_message_validator():
    """测试消息验证器"""
    print("\n=== 测试消息验证器 ===")
    
    validator = OCPPMessageValidator()
    
    # 测试有效的BootNotification
    valid_payload = {
        "chargePointVendor": "TestVendor",
        "chargePointModel": "TestModel",
        "chargePointSerialNumber": "12345"
    }
    result = validator.validate_message("BootNotification", valid_payload)
    assert result == True
    print("✓ 有效BootNotification验证通过")
    
    # 测试无效的BootNotification
    invalid_payload = {
        "chargePointVendor": "TestVendor"
        # 缺少必需字段
    }
    result = validator.validate_message("BootNotification", invalid_payload)
    assert result == False
    print("✓ 无效BootNotification验证通过")
    
    # 测试StartTransaction
    valid_start = {
        "connectorId": 1,
        "idTag": "RFID123",
        "meterStart": 1000,
        "timestamp": "2024-01-15T10:30:00Z"
    }
    result = validator.validate_message("StartTransaction", valid_start)
    assert result == True
    print("✓ 有效StartTransaction验证通过")
    
    # 测试时间戳验证
    assert validator._validate_timestamp("2024-01-15T10:30:00Z") == True
    assert validator._validate_timestamp("invalid-timestamp") == False
    print("✓ 时间戳验证测试通过")
    
    # 测试连接器ID验证
    assert validator._validate_connector_id(1) == True
    assert validator._validate_connector_id(-1) == False
    print("✓ 连接器ID验证测试通过")

def test_monitoring_service():
    """测试监控服务"""
    print("\n=== 测试监控服务 ===")
    
    monitoring = OCPPMonitoringService()
    
    # 记录一些消息
    monitoring.record_message("RemoteStartTransaction", True, 1.5)
    monitoring.record_message("RemoteStartTransaction", False, 2.0)
    monitoring.record_message("Reset", True, 0.8)
    
    # 检查统计
    assert monitoring.message_counts["total"] == 3
    assert monitoring.message_counts["successful"] == 2
    assert monitoring.message_counts["failed"] == 1
    print("✓ 消息统计测试通过")
    
    # 获取统计信息
    stats = monitoring.get_statistics()
    print(f"统计信息: 总消息={stats.total_messages}, 成功={stats.successful_operations}, 失败={stats.failed_operations}")
    assert stats.total_messages == 3
    assert stats.successful_operations == 2
    assert stats.failed_operations == 1
    print("✓ 统计信息获取测试通过")
    
    # 测试系统健康状态
    system_health = monitoring.get_system_health()
    print(f"系统健康状态: {system_health.status}")
    assert system_health.total_messages == 3
    print("✓ 系统健康状态测试通过")

async def test_async_retry_mechanism():
    """测试异步重试机制"""
    print("\n=== 测试异步重试机制 ===")
    
    error_handler = OCPPErrorHandler()
    
    # 测试成功场景
    async def mock_success_operation():
        return {"status": "success", "data": "test"}
    
    result = await error_handler.execute_with_retry(
        "RemoteStartTransaction",
        "pile_test",
        mock_success_operation
    )
    
    assert result["status"] == "success"
    print("✓ 成功场景重试测试通过")
    
    # 测试失败场景
    call_count = 0
    async def mock_failure_operation():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise ConnectionError("模拟连接失败")
        return {"status": "success", "data": "最终成功"}
    
    result = await error_handler.execute_with_retry(
        "RemoteStartTransaction",
        "pile_test2",
        mock_failure_operation
    )
    
    assert result["status"] == "success"
    assert call_count == 3  # 重试了2次后成功
    print(f"✓ 重试机制测试通过，总共尝试{call_count}次")
    
    # 测试超时场景
    async def mock_timeout_operation():
        await asyncio.sleep(2)  # 模拟长时间操作
        return {"status": "success"}
    
    # 设置短超时
    error_handler.retry_configs["TestTimeout"] = {
        "max_retries": 1,
        "strategy": RetryStrategy.FIXED_INTERVAL,
        "base_delay": 0.1,
        "max_delay": 1.0,
        "timeout": 0.5  # 0.5秒超时
    }
    
    try:
        await error_handler.execute_with_retry(
            "TestTimeout",
            "pile_timeout",
            mock_timeout_operation
        )
        assert False, "应该抛出超时异常"
    except asyncio.TimeoutError:
        print("✓ 超时处理测试通过")

def test_error_handling():
    """测试错误处理功能"""
    print("\n=== 测试错误处理功能 ===")
    
    error_handler = OCPPErrorHandler()
    
    # 测试连接错误处理
    conn_error = ConnectionError("连接失败")
    error_response = error_handler.handle_connection_error("pile_001", "RemoteStartTransaction", conn_error)
    
    print(f"连接错误响应: {error_response}")
    assert error_response["error_type"] == "CommunicationError"
    print("✓ 连接错误处理测试通过")
    
    # 测试OCPP错误处理
    ocpp_error = {"errorCode": "InternalError", "errorDescription": "内部错误"}
    error_response = error_handler.handle_ocpp_error("pile_001", "Reset", ocpp_error)
    
    print(f"OCPP错误响应: {error_response}")
    assert error_response["error_type"] == "ProtocolError"
    print("✓ OCPP错误处理测试通过")
    
    # 测试错误统计
    stats = error_handler.get_error_statistics()
    print(f"错误统计: {stats}")
    assert stats["total_errors"] >= 2
    print("✓ 错误统计测试通过")

def main():
    """主测试函数"""
    print("开始OCPP协议增强功能测试...")
    
    try:
        # 同步测试
        test_error_handler()
        test_message_validator()
        test_monitoring_service()
        test_error_handling()
        
        # 异步测试
        print("\n开始异步测试...")
        asyncio.run(test_async_retry_mechanism())
        
        print("\n🎉 所有测试通过！OCPP协议增强功能正常工作")
        
        # 显示功能总结
        print("\n=== OCPP协议增强功能总结 ===")
        print("✓ 错误处理和重试机制")
        print("✓ 消息验证和格式检查")
        print("✓ 监控和统计功能")
        print("✓ 健康状态检查")
        print("✓ 超时和异常处理")
        print("✓ 异步操作支持")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)