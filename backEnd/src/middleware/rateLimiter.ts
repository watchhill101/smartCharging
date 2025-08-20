import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/RedisService';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

export interface RateLimitOptions {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  skipSuccessfulRequests?: boolean; // 是否跳过成功请求
  keyGenerator?: (req: Request) => string; // 自定义key生成器
  message?: string; // 自定义错误消息
  onLimitReached?: (req: Request, key: string) => void; // 达到限制时的回调
}

export class RateLimiter {
  private redis: RedisService;

  constructor() {
    this.redis = new RedisService();
  }

  /**
   * 创建速率限制中间件
   */
  create(options: RateLimitOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.generateKey(req, options.keyGenerator);
        const windowStart = Math.floor(Date.now() / options.windowMs) * options.windowMs;
        const redisKey = `rate_limit:${key}:${windowStart}`;

        // 获取当前请求计数
        const currentCount = await this.redis.get(redisKey);
        const count = currentCount ? parseInt(currentCount) + 1 : 1;

        // 检查是否超过限制
        if (count > options.maxRequests) {
          // 记录限制事件
          logger.warn('Rate limit exceeded', {
            key,
            count,
            maxRequests: options.maxRequests,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
          });

          // 调用回调
          if (options.onLimitReached) {
            options.onLimitReached(req, key);
          }

          throw new AppError(
            options.message || 'Too many requests',
            429,
            'RATE_LIMIT_EXCEEDED'
          );
        }

        // 更新计数
        await this.redis.setex(redisKey, Math.ceil(options.windowMs / 1000), count.toString());

        // 设置响应头
        res.set({
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, options.maxRequests - count).toString(),
          'X-RateLimit-Reset': new Date(windowStart + options.windowMs).toISOString()
        });

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * 生成限制键
   */
  private generateKey(req: Request, keyGenerator?: (req: Request) => string): string {
    if (keyGenerator) {
      return keyGenerator(req);
    }

    // 默认使用IP地址和用户ID（如果已认证）
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?._id?.toString();
    
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  /**
   * 检查是否被限制
   */
  async isLimited(key: string, options: RateLimitOptions): Promise<{
    limited: boolean;
    count: number;
    resetTime: number;
  }> {
    const windowStart = Math.floor(Date.now() / options.windowMs) * options.windowMs;
    const redisKey = `rate_limit:${key}:${windowStart}`;
    
    const currentCount = await this.redis.get(redisKey);
    const count = currentCount ? parseInt(currentCount) : 0;

    return {
      limited: count >= options.maxRequests,
      count,
      resetTime: windowStart + options.windowMs
    };
  }

  /**
   * 重置限制计数
   */
  async reset(key: string): Promise<void> {
    const pattern = `rate_limit:${key}:*`;
    // 注意：在生产环境中应该避免使用KEYS命令，考虑使用SCAN
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// 预定义的限制器
const rateLimiter = new RateLimiter();

// 通用API限制
export const apiRateLimit = rateLimiter.create({
  windowMs: 15 * 60 * 1000, // 15分钟
  maxRequests: 100, // 每15分钟100个请求
  message: '请求过于频繁，请稍后重试'
});

// 登录限制
export const loginRateLimit = rateLimiter.create({
  windowMs: 15 * 60 * 1000, // 15分钟
  maxRequests: 5, // 每15分钟5次登录尝试
  message: '登录尝试过于频繁，请15分钟后重试',
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const phone = req.body.phone;
    return phone ? `login:phone:${phone}` : `login:ip:${ip}`;
  },
  onLimitReached: (req, key) => {
    logger.warn('Login rate limit exceeded', {
      key,
      ip: req.ip,
      phone: req.body.phone,
      userAgent: req.get('User-Agent')
    });
  }
});

// 验证码限制
export const verifyCodeRateLimit = rateLimiter.create({
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 1, // 每分钟1次
  message: '验证码发送过于频繁，请稍后重试',
  keyGenerator: (req) => {
    const phone = req.body.phone;
    return `verify_code:${phone}`;
  }
});

// 短时间内的密集操作限制
export const burstRateLimit = rateLimiter.create({
  windowMs: 1000, // 1秒
  maxRequests: 5, // 每秒5个请求
  message: '请求过于频繁，请稍后重试'
});

// 上传限制
export const uploadRateLimit = rateLimiter.create({
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 10, // 每分钟10次上传
  message: '上传过于频繁，请稍后重试'
});

export default rateLimiter;
