import fs from 'fs';
import path from 'path';

// 日志级别
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

// 日志接口
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: any;
  stack?: string;
}

class Logger {
  private logDir: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFiles = 5;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatLogEntry(level: LogLevel, message: string, meta?: any, stack?: string): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta && { meta }),
      ...(stack && { stack })
    };

    return JSON.stringify(entry) + '\n';
  }

  private getLogFileName(level: LogLevel): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${level.toLowerCase()}-${date}.log`);
  }

  private writeToFile(level: LogLevel, content: string): void {
    try {
      const fileName = this.getLogFileName(level);
      
      // 检查文件大小，如果超过限制则轮转
      if (fs.existsSync(fileName)) {
        const stats = fs.statSync(fileName);
        if (stats.size > this.maxFileSize) {
          this.rotateLogFile(fileName);
        }
      }

      fs.appendFileSync(fileName, content);
    } catch (error) {
      // 如果文件写入失败，至少输出到控制台
      console.error('Failed to write to log file:', error);
      console.error('Original log:', content);
    }
  }

  private rotateLogFile(fileName: string): void {
    try {
      const ext = path.extname(fileName);
      const baseName = fileName.replace(ext, '');
      
      // 删除最老的日志文件
      const oldestFile = `${baseName}.${this.maxFiles}${ext}`;
      if (fs.existsSync(oldestFile)) {
        fs.unlinkSync(oldestFile);
      }

      // 轮转现有文件
      for (let i = this.maxFiles - 1; i >= 1; i--) {
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

  private log(level: LogLevel, message: string, meta?: any, stack?: string): void {
    const logEntry = this.formatLogEntry(level, message, meta, stack);
    
    // 写入文件
    this.writeToFile(level, logEntry);
    
    // 在开发环境下也输出到控制台
    if (process.env.NODE_ENV === 'development') {
      const consoleMessage = `[${new Date().toISOString()}] ${level}: ${message}`;
      
      switch (level) {
        case LogLevel.ERROR:
          console.error(consoleMessage, meta || '', stack || '');
          break;
        case LogLevel.WARN:
          console.warn(consoleMessage, meta || '');
          break;
        case LogLevel.INFO:
          console.info(consoleMessage, meta || '');
          break;
        case LogLevel.DEBUG:
          console.debug(consoleMessage, meta || '');
          break;
      }
    }
  }

  error(message: string, meta?: any, stack?: string): void {
    this.log(LogLevel.ERROR, message, meta, stack);
  }

  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, message, meta);
  }

  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, message, meta);
  }

  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, message, meta);
  }
}

// 导出单例实例
export const logger = new Logger();
export default logger;