#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
增强日志系统测试脚本
测试结构化日志、性能追踪、错误监控等功能
"""

import asyncio
import json
import time
import traceback
from datetime import datetime
from pathlib import Path

# 导入增强日志系统
from enhanced_logging import (
    get_logger, configure_logging, LogContext, LogLevel,
    log_manager, PerformanceMetrics
)

class EnhancedLoggingTester:
    """增强日志系统测试器"""
    
    def __init__(self):
        self.test_results = []
        self.logger = get_logger('test_logger')
        
        # 配置测试日志
        configure_logging(
            level=LogLevel.DEBUG,
            enable_console=True,
            enable_file=True,
            enable_structured=True,
            enable_performance_tracking=True,
            log_dir='test_logs',
            max_file_size=5 * 1024 * 1024,  # 5MB
            backup_count=5,
            enable_error_tracking=True,
            enable_metrics=True
        )
    
    def record_test_result(self, test_name: str, success: bool, 
                          duration: float = 0, details: str = ""):
        """记录测试结果"""
        result = {
            'test_name': test_name,
            'success': success,
            'duration': duration,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        if success:
            self.logger.info(f"测试通过: {test_name}", metadata={
                'test_duration': duration,
                'test_details': details
            })
        else:
            self.logger.error(f"测试失败: {test_name}", metadata={
                'test_duration': duration,
                'failure_details': details
            })
    
    async def test_basic_logging(self):
        """测试基础日志功能"""
        test_name = "基础日志功能测试"
        start_time = time.time()
        
        try:
            # 测试各个日志级别
            self.logger.trace("这是一条TRACE日志")
            self.logger.debug("这是一条DEBUG日志")
            self.logger.info("这是一条INFO日志")
            self.logger.warning("这是一条WARNING日志")
            self.logger.error("这是一条ERROR日志")
            self.logger.critical("这是一条CRITICAL日志")
            
            duration = time.time() - start_time
            self.record_test_result(test_name, True, duration, "所有日志级别测试完成")
            
        except Exception as e:
            duration = time.time() - start_time
            self.record_test_result(test_name, False, duration, str(e))
    
    async def test_structured_logging(self):
        """测试结构化日志"""
        test_name = "结构化日志测试"
        start_time = time.time()
        
        try:
            # 测试带上下文的日志
            context = LogContext(
                request_id="req-12345",
                user_id="user-67890",
                pile_id="pile-abc123",
                operation="test_operation",
                component="test_component"
            )
            
            self.logger.info("结构化日志测试", context=context, metadata={
                'test_data': {'key1': 'value1', 'key2': 'value2'},
                'test_number': 42,
                'test_boolean': True
            })
            
            duration = time.time() - start_time
            self.record_test_result(test_name, True, duration, "结构化日志记录成功")
            
        except Exception as e:
            duration = time.time() - start_time
            self.record_test_result(test_name, False, duration, str(e))
    
    async def test_context_management(self):
        """测试上下文管理"""
        test_name = "上下文管理测试"
        start_time = time.time()
        
        try:
            # 测试上下文管理器
            with self.logger.context(request_id="ctx-test-123", operation="context_test"):
                self.logger.info("在上下文中的日志1")
                
                with self.logger.context(user_id="user-ctx-456"):
                    self.logger.info("嵌套上下文中的日志")
                
                self.logger.info("在上下文中的日志2")
            
            self.logger.info("上下文外的日志")
            
            duration = time.time() - start_time
            self.record_test_result(test_name, True, duration, "上下文管理测试完成")
            
        except Exception as e:
            duration = time.time() - start_time
            self.record_test_result(test_name, False, duration, str(e))
    
    async def test_performance_tracking(self):
        """测试性能追踪"""
        test_name = "性能追踪测试"
        start_time = time.time()
        
        try:
            # 测试计时器
            self.logger.start_timer("test_operation")
            
            # 模拟一些工作
            await asyncio.sleep(0.1)
            
            duration_measured = self.logger.end_timer("test_operation", "测试操作完成")
            
            # 测试上下文计时器
            with self.logger.timer("context_operation", "上下文操作完成"):
                await asyncio.sleep(0.05)
            
            duration = time.time() - start_time
            self.record_test_result(test_name, True, duration, 
                                  f"计时器测试完成，测量时长: {duration_measured:.3f}s")
            
        except Exception as e:
            duration = time.time() - start_time
            self.record_test_result(test_name, False, duration, str(e))
    
    async def test_error_handling(self):
        """测试错误处理"""
        test_name = "错误处理测试"
        start_time = time.time()
        
        try:
            # 测试异常日志记录
            try:
                raise ValueError("这是一个测试异常")
            except Exception as e:
                self.logger.error("捕获到测试异常", error=e, metadata={
                    'error_context': 'test_error_handling',
                    'error_code': 'TEST_ERROR_001'
                })
            
            # 测试不同类型的异常
            try:
                result = 1 / 0
            except ZeroDivisionError as e:
                self.logger.error("除零错误", error=e)
            
            duration = time.time() - start_time
            self.record_test_result(test_name, True, duration, "错误处理测试完成")
            
        except Exception as e:
            duration = time.time() - start_time
            self.record_test_result(test_name, False, duration, str(e))
    
    async def test_sensitive_data_sanitization(self):
        """测试敏感数据清理"""
        test_name = "敏感数据清理测试"
        start_time = time.time()
        
        try:
            # 测试敏感数据清理
            sensitive_data = {
                'username': 'testuser',
                'password': 'secret123',
                'api_key': 'sk-1234567890abcdef',
                'token': 'bearer_token_xyz',
                'normal_field': 'normal_value'
            }
            
            self.logger.info("包含敏感数据的日志", metadata={
                'user_data': sensitive_data,
                'request_info': {
                    'authorization': 'Bearer secret_token',
                    'content_type': 'application/json'
                }
            })
            
            duration = time.time() - start_time
            self.record_test_result(test_name, True, duration, "敏感数据清理测试完成")
            
        except Exception as e:
            duration = time.time() - start_time
            self.record_test_result(test_name, False, duration, str(e))
    
    async def test_metrics_collection(self):
        """测试指标收集"""
        test_name = "指标收集测试"
        start_time = time.time()
        
        try:
            # 生成一些日志来测试指标收集
            for i in range(10):
                self.logger.info(f"指标测试日志 {i+1}")
            
            for i in range(3):
                self.logger.warning(f"警告日志 {i+1}")
            
            for i in range(2):
                self.logger.error(f"错误日志 {i+1}")
            
            # 获取指标
            metrics = self.logger.get_metrics()
            
            duration = time.time() - start_time
            self.record_test_result(test_name, True, duration, 
                                  f"指标收集完成，总日志数: {metrics['total_logs']}")
            
        except Exception as e:
            duration = time.time() - start_time
            self.record_test_result(test_name, False, duration, str(e))
    
    async def test_health_check(self):
        """测试健康检查"""
        test_name = "健康检查测试"
        start_time = time.time()
        
        try:
            # 测试单个日志器健康检查
            health = self.logger.health_check()
            
            # 测试全局健康检查
            global_health = log_manager.health_check()
            
            duration = time.time() - start_time
            self.record_test_result(test_name, True, duration, 
                                  f"健康检查完成，状态: {health['status']}")
            
        except Exception as e:
            duration = time.time() - start_time
            self.record_test_result(test_name, False, duration, str(e))
    
    async def test_file_logging(self):
        """测试文件日志记录"""
        test_name = "文件日志记录测试"
        start_time = time.time()
        
        try:
            # 检查日志文件是否创建
            log_dir = Path('test_logs')
            
            # 生成一些日志
            self.logger.info("文件日志测试")
            self.logger.error("文件错误日志测试")
            
            # 等待文件写入
            await asyncio.sleep(0.1)
            
            # 检查文件是否存在
            info_log = log_dir / 'info.log'
            error_log = log_dir / 'error.log'
            
            files_exist = info_log.exists() and error_log.exists()
            
            duration = time.time() - start_time
            self.record_test_result(test_name, files_exist, duration, 
                                  f"日志文件存在: {files_exist}")
            
        except Exception as e:
            duration = time.time() - start_time
            self.record_test_result(test_name, False, duration, str(e))
    
    async def run_all_tests(self):
        """运行所有测试"""
        self.logger.info("开始增强日志系统测试")
        
        test_methods = [
            self.test_basic_logging,
            self.test_structured_logging,
            self.test_context_management,
            self.test_performance_tracking,
            self.test_error_handling,
            self.test_sensitive_data_sanitization,
            self.test_metrics_collection,
            self.test_health_check,
            self.test_file_logging
        ]
        
        for test_method in test_methods:
            try:
                await test_method()
            except Exception as e:
                self.logger.error(f"测试方法 {test_method.__name__} 执行失败", error=e)
                self.record_test_result(test_method.__name__, False, 0, str(e))
        
        self.logger.info("所有测试完成")
    
    def generate_test_report(self):
        """生成测试报告"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        report = {
            'summary': {
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'failed_tests': failed_tests,
                'success_rate': (passed_tests / total_tests * 100) if total_tests > 0 else 0,
                'total_duration': sum(result['duration'] for result in self.test_results)
            },
            'test_results': self.test_results,
            'log_metrics': log_manager.get_all_metrics(),
            'health_status': log_manager.health_check(),
            'generated_at': datetime.now().isoformat()
        }
        
        # 保存报告到文件
        report_file = Path('enhanced_logging_test_report.json')
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        self.logger.info("测试报告已生成", metadata={
            'report_file': str(report_file),
            'total_tests': total_tests,
            'success_rate': report['summary']['success_rate']
        })
        
        return report

async def main():
    """主函数"""
    print("开始增强日志系统测试...")
    
    tester = EnhancedLoggingTester()
    
    try:
        await tester.run_all_tests()
        report = tester.generate_test_report()
        
        print(f"\n测试完成!")
        print(f"总测试数: {report['summary']['total_tests']}")
        print(f"通过测试: {report['summary']['passed_tests']}")
        print(f"失败测试: {report['summary']['failed_tests']}")
        print(f"成功率: {report['summary']['success_rate']:.1f}%")
        print(f"总耗时: {report['summary']['total_duration']:.3f}秒")
        print(f"测试报告已保存到: enhanced_logging_test_report.json")
        
        # 显示失败的测试
        failed_tests = [r for r in report['test_results'] if not r['success']]
        if failed_tests:
            print("\n失败的测试:")
            for test in failed_tests:
                print(f"  - {test['test_name']}: {test['details']}")
        
    except Exception as e:
        print(f"测试执行失败: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())