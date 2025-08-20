import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../utils/logger';

// 自定义错误类
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errorCode = errorCode;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 错误处理中间件
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorCode = 'INTERNAL_ERROR';

  // 处理自定义错误
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errorCode = error.errorCode || 'APP_ERROR';
  }
  // 处理MongoDB错误
  else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errorCode = 'VALIDATION_ERROR';
  }
  else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    errorCode = 'INVALID_ID';
  }
  else if (error.name === 'MongoServerError' && (error as any).code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value';
    errorCode = 'DUPLICATE_FIELD';
  }
  // 处理JWT错误
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorCode = 'INVALID_TOKEN';
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorCode = 'TOKEN_EXPIRED';
  }
  // 处理请求体过大错误
  else if (error.name === 'PayloadTooLargeError' || error.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request payload too large';
    errorCode = 'PAYLOAD_TOO_LARGE';
  }
  // 处理请求超时错误
  else if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
    statusCode = 408;
    message = 'Request timeout';
    errorCode = 'REQUEST_TIMEOUT';
  }
  // 处理网络连接错误
  else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    statusCode = 503;
    message = 'Service temporarily unavailable';
    errorCode = 'SERVICE_UNAVAILABLE';
  }
  // 处理语法错误（JSON解析等）
  else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    message = 'Invalid JSON format';
    errorCode = 'INVALID_JSON';
  }
  // 处理权限错误
  else if (error.name === 'UnauthorizedError') {
    statusCode = 403;
    message = 'Access denied';
    errorCode = 'ACCESS_DENIED';
  }

  // 记录错误日志
  logger.error('Request error occurred', {
    message: error.message,
    statusCode,
    errorCode,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id'] || 'unknown'
  }, error.stack);

  // 返回错误响应
  res.status(statusCode).json({
    success: false,
    errorCode,
    message,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

// 异步错误处理包装器
export const asyncHandler = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};