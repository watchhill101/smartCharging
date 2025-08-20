#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
增强的日志系统
提供结构化日志、性能追踪、错误监控和日志分析功能
"""

import asyncio
import json
import logging
import logging.handlers
import os
import sys
import time
import traceback
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass, field, asdict
from contextlib import contextmanager
from collections import defaultdict, deque
import threading
import psutil

# 日志级别枚举
class LogLevel(Enum):
    """日志级别"""
    TRACE = 5
    DEBUG = 10
    INFO = 20
    WARNING = 30
    ERROR = 40
    CRITICAL = 50

# 日志上下文数据类
@dataclass
class LogContext:
    """日志上下文"""
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    component: Optional[str] = None
    operation: Optional[str] = None
    pile_id: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        result = {}
        for key, value in asdict(self).items():
            if value is not None:
                if key == 'extra':
                    result.update(value)
                else:
                    result[key] = value
        return result

# 性能指标数据类
@dataclass
class PerformanceMetrics:
    """性能指标"""
    duration: float = 0.0
    memory_usage: Dict[str, float] = field(default_factory=dict)
    cpu_percent: float = 0.0
    operation: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return asdict(self)

# 日志条目数据类
@dataclass
class LogEntry:
    """日志条目"""
    timestamp: str
    level: str
    level_no: int
    message: str
    logger_name: str
    module: str
    function: str
    line_no: int
    context: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    performance: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        result = asdict(self)
        # 移除None值
        return {k: v for k, v in result.items() if v is not None}

# 日志指标统计
@dataclass
class LogMetrics:
    """日志指标"""
    total_logs: int = 0
    logs_by_level: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    error_rate: float = 0.0
    avg_response_time: float = 0.0
    last_error: Optional[LogEntry] = None
    start_time: datetime = field(default_factory=datetime.now)
    recent_errors: deque = field(default_factory=lambda: deque(maxlen=100))
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'total_logs': self.total_logs,
            'logs_by_level': dict(self.logs_by_level),
            'error_rate': self.error_rate,
            'avg_response_time': self.avg_response_time,
            'uptime_seconds': (datetime.now() - self.start_time).total_seconds(),
            'recent_error_count': len(self.recent_errors)
        }

# 自定义JSON格式化器
class StructuredFormatter(logging.Formatter):
    """结构化JSON格式化器"""
    
    def __init__(self, sensitive_fields: List[str] = None):
        super().__init__()
        self.sensitive_fields = sensitive_fields or [
            'password', 'token', 'secret', 'key', 'authorization', 'api_key'
        ]
    
    def format(self, record: logging.LogRecord) -> str:
        """格式化日志记录"""
        # 创建基础日志条目
        entry = LogEntry(
            timestamp=datetime.fromtimestamp(record.created).isoformat(),
            level=record.levelname,
            level_no=record.levelno,
            message=record.getMessage(),
            logger_name=record.name,
            module=record.module,
            function=record.funcName,
            line_no=record.lineno
        )
        
        # 添加上下文信息
        if hasattr(record, 'context'):
            entry.context = self._sanitize_data(record.context)
        
        # 添加错误信息
        if record.exc_info:
            entry.error = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
                'traceback': self.formatException(record.exc_info)
            }
        
        # 添加性能信息
        if hasattr(record, 'performance'):
            entry.performance = record.performance
        
        # 添加元数据
        if hasattr(record, 'metadata'):
            entry.metadata = self._sanitize_data(record.metadata)
        
        return json.dumps(entry.to_dict(), ensure_ascii=False, default=str)
    
    def _sanitize_data(self, data: Any) -> Any:
        """清理敏感数据"""
        if isinstance(data, dict):
            sanitized = {}
            for key, value in data.items():
                if any(sensitive in key.lower() for sensitive in self.sensitive_fields):
                    sanitized[key] = '[REDACTED]'
                else:
                    sanitized[key] = self._sanitize_data(value)
            return sanitized
        elif isinstance(data, (list, tuple)):
            return [self._sanitize_data(item) for item in data]
        else:
            return data

# 彩色控制台格式化器
class ColoredFormatter(logging.Formatter):
    """彩色控制台格式化器"""
    
    COLORS = {
        'TRACE': '\033[90m',     # 灰色
        'DEBUG': '\033[36m',     # 青色
        'INFO': '\033[32m',      # 绿色
        'WARNING': '\033[33m',   # 黄色
        'ERROR': '\033[31m',     # 红色
        'CRITICAL': '\033[35m',  # 紫色
    }
    RESET = '\033[0m'
    
    def format(self, record: logging.LogRecord) -> str:
        """格式化日志记录"""
        color = self.COLORS.get(record.levelname, '')
        reset = self.RESET
        
        # 格式化时间
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S.%f')[:-3]
        
        # 构建消息
        message = f"{color}[{timestamp}] {record.levelname:8} {record.name}: {record.getMessage()}{reset}"
        
        # 添加上下文信息
        if hasattr(record, 'context') and record.context:
            context_str = json.dumps(record.context, ensure_ascii=False, default=str)
            message += f" {color}[{context_str}]{reset}"
        
        # 添加异常信息
        if record.exc_info:
            message += f"\n{color}{self.formatException(record.exc_info)}{reset}"
        
        return message

# 性能追踪装饰器
class PerformanceTracker:
    """性能追踪器"""
    
    def __init__(self):
        self.timers: Dict[str, float] = {}
        self.process = psutil.Process()
    
    def start_timer(self, name: str) -> None:
        """开始计时"""
        self.timers[name] = time.time()
    
    def end_timer(self, name: str) -> float:
        """结束计时并返回持续时间"""
        if name not in self.timers:
            return 0.0
        
        duration = time.time() - self.timers[name]
        del self.timers[name]
        return duration
    
    def get_performance_metrics(self, operation: str = None) -> PerformanceMetrics:
        """获取性能指标"""
        try:
            memory_info = self.process.memory_info()
            cpu_percent = self.process.cpu_percent()
            
            return PerformanceMetrics(
                memory_usage={
                    'rss': memory_info.rss / 1024 / 1024,  # MB
                    'vms': memory_info.vms / 1024 / 1024,  # MB
                },
                cpu_percent=cpu_percent,
                operation=operation
            )
        except Exception:
            return PerformanceMetrics(operation=operation)

# 增强的日志器
class EnhancedLogger:
    """增强的日志器"""
    
    def __init__(self, name: str, config: Dict[str, Any] = None):
        self.name = name
        self.config = {
            'level': LogLevel.INFO,
            'enable_console': True,
            'enable_file': True,
            'enable_structured': True,
            'enable_performance_tracking': True,
            'log_dir': 'logs',
            'max_file_size': 10 * 1024 * 1024,  # 10MB
            'backup_count': 10,
            'enable_error_tracking': True,
            'enable_metrics': True,
            'sensitive_fields': ['password', 'token', 'secret', 'key', 'authorization'],
            **(config or {})
        }
        
        self.logger = logging.getLogger(name)
        self.logger.setLevel(self.config['level'].value)
        
        self.metrics = LogMetrics()
        self.performance_tracker = PerformanceTracker()
        self.context_stack: List[LogContext] = []
        self.filters: List[Callable[[LogEntry], bool]] = []
        
        self._setup_handlers()
        self._setup_filters()
    
    def _setup_handlers(self):
        """设置日志处理器"""
        # 清除现有处理器
        self.logger.handlers.clear()
        
        # 控制台处理器
        if self.config['enable_console']:
            console_handler = logging.StreamHandler(sys.stdout)
            if self.config['enable_structured']:
                console_handler.setFormatter(StructuredFormatter(self.config['sensitive_fields']))
            else:
                console_handler.setFormatter(ColoredFormatter())
            self.logger.addHandler(console_handler)
        
        # 文件处理器
        if self.config['enable_file']:
            log_dir = Path(self.config['log_dir'])
            log_dir.mkdir(exist_ok=True)
            
            # 按级别分别记录
            for level in ['debug', 'info', 'warning', 'error', 'critical']:
                file_path = log_dir / f"{level}.log"
                file_handler = logging.handlers.RotatingFileHandler(
                    file_path,
                    maxBytes=self.config['max_file_size'],
                    backupCount=self.config['backup_count'],
                    encoding='utf-8'
                )
                file_handler.setLevel(getattr(logging, level.upper()))
                file_handler.setFormatter(StructuredFormatter(self.config['sensitive_fields']))
                self.logger.addHandler(file_handler)
    
    def _setup_filters(self):
        """设置日志过滤器"""
        def level_filter(record):
            return record.levelno >= self.config['level'].value
        
        self.logger.addFilter(level_filter)
    
    def _create_log_record(self, level: int, message: str, 
                          context: LogContext = None, 
                          error: Exception = None,
                          performance: PerformanceMetrics = None,
                          metadata: Dict[str, Any] = None) -> logging.LogRecord:
        """创建日志记录"""
        # 获取调用者信息
        frame = sys._getframe(3)
        
        record = logging.LogRecord(
            name=self.logger.name,
            level=level,
            pathname=frame.f_code.co_filename,
            lineno=frame.f_lineno,
            msg=message,
            args=(),
            exc_info=None
        )
        
        # 添加上下文
        current_context = self.get_current_context()
        if context:
            current_context.extra.update(context.to_dict())
        record.context = current_context.to_dict() if current_context.to_dict() else None
        
        # 添加性能信息
        if performance:
            record.performance = performance.to_dict()
        
        # 添加元数据
        if metadata:
            record.metadata = metadata
        
        # 添加异常信息
        if error:
            record.exc_info = (type(error), error, error.__traceback__)
        
        return record
    
    def _update_metrics(self, level: int, error: Exception = None):
        """更新指标"""
        if not self.config['enable_metrics']:
            return
        
        self.metrics.total_logs += 1
        level_name = logging.getLevelName(level)
        self.metrics.logs_by_level[level_name] += 1
        
        if level >= logging.ERROR:
            if error:
                self.metrics.recent_errors.append({
                    'timestamp': datetime.now().isoformat(),
                    'error': str(error),
                    'type': type(error).__name__
                })
            
            error_count = (self.metrics.logs_by_level['ERROR'] + 
                          self.metrics.logs_by_level['CRITICAL'])
            self.metrics.error_rate = (error_count / self.metrics.total_logs) * 100
    
    def _log(self, level: int, message: str, 
            context: LogContext = None,
            error: Exception = None,
            performance: PerformanceMetrics = None,
            metadata: Dict[str, Any] = None):
        """内部日志方法"""
        if not self.logger.isEnabledFor(level):
            return
        
        record = self._create_log_record(level, message, context, error, performance, metadata)
        
        # 应用过滤器
        if all(f(LogEntry(
            timestamp=datetime.fromtimestamp(record.created).isoformat(),
            level=record.levelname,
            level_no=record.levelno,
            message=record.getMessage(),
            logger_name=record.name,
            module=record.module,
            function=record.funcName,
            line_no=record.lineno,
            context=getattr(record, 'context', None),
            error=getattr(record, 'error', None),
            performance=getattr(record, 'performance', None),
            metadata=getattr(record, 'metadata', None)
        )) for f in self.filters):
            self.logger.handle(record)
            self._update_metrics(level, error)
    
    # 公共日志方法
    def trace(self, message: str, context: LogContext = None, 
             metadata: Dict[str, Any] = None):
        """记录TRACE级别日志"""
        self._log(LogLevel.TRACE.value, message, context, metadata=metadata)
    
    def debug(self, message: str, context: LogContext = None, 
             metadata: Dict[str, Any] = None):
        """记录DEBUG级别日志"""
        self._log(logging.DEBUG, message, context, metadata=metadata)
    
    def info(self, message: str, context: LogContext = None, 
            metadata: Dict[str, Any] = None):
        """记录INFO级别日志"""
        self._log(logging.INFO, message, context, metadata=metadata)
    
    def warning(self, message: str, context: LogContext = None, 
               metadata: Dict[str, Any] = None):
        """记录WARNING级别日志"""
        self._log(logging.WARNING, message, context, metadata=metadata)
    
    def error(self, message: str, context: LogContext = None, 
             error: Exception = None, metadata: Dict[str, Any] = None):
        """记录ERROR级别日志"""
        self._log(logging.ERROR, message, context, error, metadata=metadata)
    
    def critical(self, message: str, context: LogContext = None, 
                error: Exception = None, metadata: Dict[str, Any] = None):
        """记录CRITICAL级别日志"""
        self._log(logging.CRITICAL, message, context, error, metadata=metadata)
    
    # 上下文管理
    def push_context(self, context: LogContext):
        """推入上下文"""
        self.context_stack.append(context)
    
    def pop_context(self) -> Optional[LogContext]:
        """弹出上下文"""
        return self.context_stack.pop() if self.context_stack else None
    
    def get_current_context(self) -> LogContext:
        """获取当前上下文"""
        if not self.context_stack:
            return LogContext()
        
        # 合并所有上下文
        merged = LogContext()
        for ctx in self.context_stack:
            for key, value in asdict(ctx).items():
                if value is not None:
                    if key == 'extra':
                        merged.extra.update(value)
                    else:
                        setattr(merged, key, value)
        
        return merged
    
    @contextmanager
    def context(self, **kwargs):
        """上下文管理器"""
        ctx = LogContext(**kwargs)
        self.push_context(ctx)
        try:
            yield
        finally:
            self.pop_context()
    
    # 性能追踪
    def start_timer(self, name: str):
        """开始性能计时"""
        if self.config['enable_performance_tracking']:
            self.performance_tracker.start_timer(name)
    
    def end_timer(self, name: str, message: str = None, 
                 context: LogContext = None) -> float:
        """结束性能计时"""
        if not self.config['enable_performance_tracking']:
            return 0.0
        
        duration = self.performance_tracker.end_timer(name)
        
        if message:
            # 获取性能指标
            current_metrics = self.performance_tracker.get_performance_metrics(name)
            performance = PerformanceMetrics(
                duration=duration,
                operation=name,
                memory_usage=current_metrics.memory_usage,
                cpu_percent=current_metrics.cpu_percent
            )
            
            self.info(message or f"Timer {name} completed", context, 
                     metadata={'performance': performance.to_dict()})
        
        return duration
    
    @contextmanager
    def timer(self, name: str, message: str = None, context: LogContext = None):
        """性能计时上下文管理器"""
        self.start_timer(name)
        try:
            yield
        finally:
            self.end_timer(name, message, context)
    
    # 过滤器管理
    def add_filter(self, filter_func: Callable[[LogEntry], bool]):
        """添加过滤器"""
        self.filters.append(filter_func)
    
    def remove_filter(self, filter_func: Callable[[LogEntry], bool]):
        """移除过滤器"""
        if filter_func in self.filters:
            self.filters.remove(filter_func)
    
    # 指标获取
    def get_metrics(self) -> Dict[str, Any]:
        """获取日志指标"""
        return self.metrics.to_dict()
    
    # 健康检查
    def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        issues = []
        
        # 检查错误率
        if self.metrics.error_rate > 10:
            issues.append(f"High error rate: {self.metrics.error_rate:.2f}%")
        
        # 检查文件写入
        if self.config['enable_file']:
            try:
                test_file = Path(self.config['log_dir']) / 'health-check.log'
                test_file.write_text('health check\n')
                test_file.unlink()
            except Exception as e:
                issues.append(f"File logging not working: {e}")
        
        status = 'healthy' if not issues else 'degraded'
        
        return {
            'status': status,
            'metrics': self.get_metrics(),
            'issues': issues,
            'timestamp': datetime.now().isoformat()
        }

# 日志管理器
class LogManager:
    """日志管理器"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, '_initialized'):
            return
        
        self.loggers: Dict[str, EnhancedLogger] = {}
        self.global_config = {
            'level': LogLevel.INFO,
            'enable_console': True,
            'enable_file': True,
            'enable_structured': True,
            'enable_performance_tracking': True,
            'log_dir': 'logs',
            'max_file_size': 10 * 1024 * 1024,
            'backup_count': 10,
            'enable_error_tracking': True,
            'enable_metrics': True,
            'sensitive_fields': ['password', 'token', 'secret', 'key', 'authorization']
        }
        self._initialized = True
    
    def get_logger(self, name: str, config: Dict[str, Any] = None) -> EnhancedLogger:
        """获取日志器"""
        if name not in self.loggers:
            merged_config = {**self.global_config, **(config or {})}
            self.loggers[name] = EnhancedLogger(name, merged_config)
        return self.loggers[name]
    
    def configure(self, **config):
        """配置全局日志设置"""
        self.global_config.update(config)
        
        # 重新配置现有日志器
        for logger in self.loggers.values():
            logger.config.update(config)
            logger._setup_handlers()
    
    def get_all_metrics(self) -> Dict[str, Any]:
        """获取所有日志器的指标"""
        return {
            name: logger.get_metrics() 
            for name, logger in self.loggers.items()
        }
    
    def health_check(self) -> Dict[str, Any]:
        """全局健康检查"""
        logger_health = {
            name: logger.health_check() 
            for name, logger in self.loggers.items()
        }
        
        overall_status = 'healthy'
        total_issues = []
        
        for name, health in logger_health.items():
            if health['status'] != 'healthy':
                overall_status = 'degraded'
                total_issues.extend([f"{name}: {issue}" for issue in health['issues']])
        
        return {
            'status': overall_status,
            'loggers': logger_health,
            'total_issues': total_issues,
            'timestamp': datetime.now().isoformat()
        }

# 全局日志管理器实例
log_manager = LogManager()

# 便捷函数
def get_logger(name: str = None, config: Dict[str, Any] = None) -> EnhancedLogger:
    """获取日志器"""
    if name is None:
        # 获取调用者模块名
        frame = sys._getframe(1)
        name = frame.f_globals.get('__name__', 'unknown')
    
    return log_manager.get_logger(name, config)

def configure_logging(**config):
    """配置全局日志设置"""
    log_manager.configure(**config)

# 创建默认日志器
default_logger = get_logger('charging_service')

# 导出便捷方法
trace = default_logger.trace
debug = default_logger.debug
info = default_logger.info
warning = default_logger.warning
error = default_logger.error
critical = default_logger.critical

# 导出上下文和计时器
context = default_logger.context
timer = default_logger.timer
start_timer = default_logger.start_timer
end_timer = default_logger.end_timer