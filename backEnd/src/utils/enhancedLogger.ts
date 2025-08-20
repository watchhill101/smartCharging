import fs from 'fs';
import path from 'path';
import { createWriteStream, WriteStream } from 'fs';
import { performance } from 'perf_hooks';

// 增强的日志级别
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

// 日志上下文接口
export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  component?: string;
  operation?: string;
  [key: string]: any;
}

// 日志条目接口
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  levelName: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number;
    memory: NodeJS.MemoryUsage;
  };
  metadata?: Record<string, any>;
}

// 日志配置接口
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableStructured: boolean;
  enablePerformanceTracking: boolean;
  logDir: string;
  maxFileSize: number;
  maxFiles: number;
  datePattern: string;
  enableErrorTracking: boolean;
  enableMetrics: boolean;
  sensitiveFields: string[];
}

// 日志指标接口
export interface LogMetrics {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  errorRate: number;
  avgResponseTime: number;
  lastError?: LogEntry;
  startTime: Date;
}

// 日志过滤器类型
export type LogFilter = (entry: LogEntry) => boolean;

// 日志格式化器类型
export type LogFormatter = (entry: LogEntry) => string;

// 增强的日志器类
export class EnhancedLogger {
  private config: LoggerConfig;
  private fileStreams: Map<string, WriteStream> = new Map();
  private metrics: LogMetrics;
  private filters: LogFilter[] = [];
  private formatters: Map<string, LogFormatter> = new Map();
  private performanceMarks: Map<string, number> = new Map();
  private contextStack: LogContext[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: true,
      enableStructured: true,
      enablePerformanceTracking: true,
      logDir: path.join(process.cwd(), 'logs'),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      datePattern: 'YYYY-MM-DD',
      enableErrorTracking: true,
      enableMetrics: true,
      sensitiveFields: ['password', 'token', 'secret', 'key', 'authorization'],
      ...config
    };

    this.metrics = {
      totalLogs: 0,
      logsByLevel: {},
      errorRate: 0,
      avgResponseTime: 0,
      startTime: new Date()
    };

    this.initializeLogger();
    this.setupDefaultFormatters();
  }

  private initializeLogger(): void {
    // 确保日志目录存在
    if (this.config.enableFile && !fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }

    // 初始化日志级别计数
    Object.values(LogLevel)
      .filter(v => typeof v === 'string')
      .forEach(level => {
        this.metrics.logsByLevel[level as string] = 0;
      });
  }

  private setupDefaultFormatters(): void {
    // JSON格式化器
    this.formatters.set('json', (entry: LogEntry) => {
      return JSON.stringify(this.sanitizeEntry(entry)) + '\n';
    });

    // 人类可读格式化器
    this.formatters.set('human', (entry: LogEntry) => {
      const timestamp = entry.timestamp;
      const level = entry.levelName.padEnd(5);
      const message = entry.message;
      const context = entry.context ? ` [${JSON.stringify(entry.context)}]` : '';
      const error = entry.error ? ` ERROR: ${entry.error.message}` : '';
      
      return `${timestamp} ${level} ${message}${context}${error}\n`;
    });

    // 开发环境格式化器
    this.formatters.set('dev', (entry: LogEntry) => {
      const colors = {
        [LogLevel.TRACE]: '\x1b[90m', // 灰色
        [LogLevel.DEBUG]: '\x1b[36m', // 青色
        [LogLevel.INFO]: '\x1b[32m',  // 绿色
        [LogLevel.WARN]: '\x1b[33m',  // 黄色
        [LogLevel.ERROR]: '\x1b[31m', // 红色
        [LogLevel.FATAL]: '\x1b[35m'  // 紫色
      };
      
      const reset = '\x1b[0m';
      const color = colors[entry.level] || '';
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      
      return `${color}[${timestamp}] ${entry.levelName}: ${entry.message}${reset}\n`;
    });
  }

  private sanitizeEntry(entry: LogEntry): LogEntry {
    const sanitized = { ...entry };
    
    // 移除敏感字段
    if (sanitized.context) {
      sanitized.context = this.sanitizeObject(sanitized.context);
    }
    
    if (sanitized.metadata) {
      sanitized.metadata = this.sanitizeObject(sanitized.metadata);
    }
    
    return sanitized;
  }

  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized = { ...obj };
    
    for (const field of this.config.sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private getLogFileName(level: LogLevel): string {
    const date = new Date().toISOString().split('T')[0];
    const levelName = LogLevel[level].toLowerCase();
    return path.join(this.config.logDir, `${levelName}-${date}.log`);
  }

  private getFileStream(level: LogLevel): WriteStream {
    const fileName = this.getLogFileName(level);
    
    if (!this.fileStreams.has(fileName)) {
      const stream = createWriteStream(fileName, { flags: 'a' });
      this.fileStreams.set(fileName, stream);
      
      // 检查文件大小并轮转
      this.checkAndRotateFile(fileName);
    }
    
    return this.fileStreams.get(fileName)!;
  }

  private checkAndRotateFile(fileName: string): void {
    try {
      if (fs.existsSync(fileName)) {
        const stats = fs.statSync(fileName);
        if (stats.size > this.config.maxFileSize) {
          this.rotateLogFile(fileName);
        }
      }
    } catch (error) {
      console.error('Failed to check file size:', error);
    }
  }

  private rotateLogFile(fileName: string): void {
    try {
      const ext = path.extname(fileName);
      const baseName = fileName.replace(ext, '');
      
      // 关闭当前文件流
      const stream = this.fileStreams.get(fileName);
      if (stream) {
        stream.end();
        this.fileStreams.delete(fileName);
      }
      
      // 删除最老的日志文件
      const oldestFile = `${baseName}.${this.config.maxFiles}${ext}`;
      if (fs.existsSync(oldestFile)) {
        fs.unlinkSync(oldestFile);
      }
      
      // 轮转现有文件
      for (let i = this.config.maxFiles - 1; i >= 1; i--) {
        const currentFile = i === 1 ? fileName : `${baseName}.${i}${ext}`;
        const nextFile = `${baseName}.${i + 1}${ext}`;
        
        if (fs.existsSync(currentFile)) {
          fs.renameSync(currentFile, nextFile);
        }
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: Record<string, any>
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      levelName: LogLevel[level],
      message,
      context: { ...this.getCurrentContext(), ...context },
      metadata
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    if (this.config.enablePerformanceTracking) {
      entry.performance = {
        duration: 0, // 将在性能追踪中设置
        memory: process.memoryUsage()
      };
    }

    return entry;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private applyFilters(entry: LogEntry): boolean {
    return this.filters.every(filter => filter(entry));
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;
    
    const formatter = this.formatters.get(
      process.env.NODE_ENV === 'development' ? 'dev' : 'human'
    )!;
    
    const output = formatter(entry);
    
    if (entry.level >= LogLevel.ERROR) {
      process.stderr.write(output);
    } else {
      process.stdout.write(output);
    }
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.config.enableFile) return;
    
    try {
      const stream = this.getFileStream(entry.level);
      const formatter = this.formatters.get(
        this.config.enableStructured ? 'json' : 'human'
      )!;
      
      stream.write(formatter(entry));
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private updateMetrics(entry: LogEntry): void {
    if (!this.config.enableMetrics) return;
    
    this.metrics.totalLogs++;
    this.metrics.logsByLevel[entry.levelName]++;
    
    if (entry.level >= LogLevel.ERROR) {
      this.metrics.lastError = entry;
      const errorCount = this.metrics.logsByLevel['ERROR'] + this.metrics.logsByLevel['FATAL'];
      this.metrics.errorRate = (errorCount / this.metrics.totalLogs) * 100;
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: Record<string, any>
  ): void {
    if (!this.shouldLog(level)) return;
    
    const entry = this.createLogEntry(level, message, context, error, metadata);
    
    if (!this.applyFilters(entry)) return;
    
    this.writeToConsole(entry);
    this.writeToFile(entry);
    this.updateMetrics(entry);
  }

  // 公共日志方法
  trace(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(LogLevel.TRACE, message, context, undefined, metadata);
  }

  debug(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context, undefined, metadata);
  }

  info(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context, undefined, metadata);
  }

  warn(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context, undefined, metadata);
  }

  error(message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error, metadata);
  }

  fatal(message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.FATAL, message, context, error, metadata);
  }

  // 上下文管理
  pushContext(context: LogContext): void {
    this.contextStack.push(context);
  }

  popContext(): LogContext | undefined {
    return this.contextStack.pop();
  }

  getCurrentContext(): LogContext {
    return this.contextStack.reduce((acc, ctx) => ({ ...acc, ...ctx }), {});
  }

  withContext<T>(context: LogContext, fn: () => T): T {
    this.pushContext(context);
    try {
      return fn();
    } finally {
      this.popContext();
    }
  }

  // 性能追踪
  startTimer(name: string): void {
    if (this.config.enablePerformanceTracking) {
      this.performanceMarks.set(name, performance.now());
    }
  }

  endTimer(name: string, message?: string, context?: LogContext): number {
    if (!this.config.enablePerformanceTracking) return 0;
    
    const startTime = this.performanceMarks.get(name);
    if (!startTime) return 0;
    
    const duration = performance.now() - startTime;
    this.performanceMarks.delete(name);
    
    if (message) {
      this.info(message || `Timer ${name} completed`, {
        ...context,
        performance: { duration, operation: name }
      });
    }
    
    return duration;
  }

  // 过滤器管理
  addFilter(filter: LogFilter): void {
    this.filters.push(filter);
  }

  removeFilter(filter: LogFilter): void {
    const index = this.filters.indexOf(filter);
    if (index > -1) {
      this.filters.splice(index, 1);
    }
  }

  // 格式化器管理
  addFormatter(name: string, formatter: LogFormatter): void {
    this.formatters.set(name, formatter);
  }

  // 指标获取
  getMetrics(): LogMetrics {
    return { ...this.metrics };
  }

  // 健康检查
  healthCheck(): { status: string; metrics: LogMetrics; issues: string[] } {
    const issues: string[] = [];
    
    // 检查错误率
    if (this.metrics.errorRate > 10) {
      issues.push(`High error rate: ${this.metrics.errorRate.toFixed(2)}%`);
    }
    
    // 检查文件写入
    if (this.config.enableFile) {
      try {
        const testFile = path.join(this.config.logDir, 'health-check.log');
        fs.writeFileSync(testFile, 'health check\n');
        fs.unlinkSync(testFile);
      } catch (error) {
        issues.push('File logging not working');
      }
    }
    
    const status = issues.length === 0 ? 'healthy' : 'degraded';
    
    return {
      status,
      metrics: this.getMetrics(),
      issues
    };
  }

  // 清理资源
  close(): void {
    for (const stream of this.fileStreams.values()) {
      stream.end();
    }
    this.fileStreams.clear();
  }
}

// 创建默认实例
export const enhancedLogger = new EnhancedLogger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableFile: true,
  enableStructured: process.env.NODE_ENV === 'production',
  enablePerformanceTracking: true,
  enableErrorTracking: true,
  enableMetrics: true
});

// 导出便捷方法
export const trace = enhancedLogger.trace.bind(enhancedLogger);
export const debug = enhancedLogger.debug.bind(enhancedLogger);
export const info = enhancedLogger.info.bind(enhancedLogger);
export const warn = enhancedLogger.warn.bind(enhancedLogger);
export const error = enhancedLogger.error.bind(enhancedLogger);
export const fatal = enhancedLogger.fatal.bind(enhancedLogger);

export default enhancedLogger;