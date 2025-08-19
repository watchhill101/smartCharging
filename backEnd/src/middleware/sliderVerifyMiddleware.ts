import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisService } from '../services/RedisService';
import { getSliderVerifyConfig, SliderVerifyErrorCode, SliderVerifyErrorMessages } from '../config/sliderVerify';

/**
 * 滑块验证限流中间件
 */
export const sliderVerifyRateLimit = () => {
  const config = getSliderVerifyConfig();
  
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      success: false,
      errorCode: SliderVerifyErrorCode.RATE_LIMIT_EXCEEDED,
      message: SliderVerifyErrorMessages[SliderVerifyErrorCode.RATE_LIMIT_EXCEEDED],
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    // 使用IP和User-Agent组合作为限流键
    keyGenerator: (req: Request) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      return `${ip}_${Buffer.from(userAgent).toString('base64').slice(0, 20)}`;
    },
    // 自定义存储（使用Redis）
    store: new (class RedisStore {
      private redis: RedisService;
      
      constructor() {
        this.redis = new RedisService();
      }
      
      async increment(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
        const redisKey = `rate_limit:slider_verify:${key}`;
        const windowMs = config.rateLimit.windowMs;
        
        try {
          // 使用Redis管道操作
          const pipeline = this.redis.getClient().pipeline();
          pipeline.incr(redisKey);
          pipeline.expire(redisKey, Math.ceil(windowMs / 1000));
          
          const results = await pipeline.exec();
          const totalHits = results?.[0]?.[1] as number || 1;
          
          return {
            totalHits,
            resetTime: new Date(Date.now() + windowMs)
          };
        } catch (error) {
          console.error('Redis限流存储错误:', error);
          // 如果Redis出错，返回默认值（不限流）
          return { totalHits: 1 };
        }
      }
      
      async decrement(key: string): Promise<void> {
        const redisKey = `rate_limit:slider_verify:${key}`;
        try {
          await this.redis.decr(redisKey);
        } catch (error) {
          console.error('Redis限流递减错误:', error);
        }
      }
      
      async resetKey(key: string): Promise<void> {
        const redisKey = `rate_limit:slider_verify:${key}`;
        try {
          await this.redis.del(redisKey);
        } catch (error) {
          console.error('Redis限流重置错误:', error);
        }
      }
    })(),
    // 跳过成功的请求（只对失败的请求计数）
    skipSuccessfulRequests: true,
    // 自定义跳过逻辑
    skip: (req: Request) => {
      // 如果配置禁用限流，则跳过
      return !config.enabled;
    }
  });
};

/**
 * 滑块验证日志中间件
 */
export const sliderVerifyLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 添加请求ID到请求对象
  (req as any).requestId = requestId;
  
  console.log(`🎯 [${requestId}] 滑块验证请求开始:`, {
    method: req.method,
    url: req.url,
    ip,
    userAgent: userAgent.slice(0, 100), // 截断长User-Agent
    timestamp: new Date().toISOString()
  });

  // 拦截响应
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - startTime;
    const responseData = typeof data === 'string' ? JSON.parse(data) : data;
    
    console.log(`🎯 [${requestId}] 滑块验证请求完成:`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      success: responseData?.success || false,
      verified: responseData?.data?.verified || false,
      errorCode: responseData?.errorCode,
      timestamp: new Date().toISOString()
    });

    // 记录统计信息
    recordSliderVerifyStats(req, res, duration, responseData);

    return originalSend.call(this, data);
  };

  next();
};

/**
 * 滑块验证参数验证中间件
 */
export const sliderVerifyValidator = (req: Request, res: Response, next: NextFunction) => {
  const { slideDistance, puzzleOffset, accuracy, duration, verifyPath, trackData } = req.body;

  const errors: string[] = [];

  // 验证必需参数
  if (typeof slideDistance !== 'number') {
    errors.push('slideDistance必须是数字');
  }

  if (typeof puzzleOffset !== 'number') {
    errors.push('puzzleOffset必须是数字');
  }

  if (typeof accuracy !== 'number') {
    errors.push('accuracy必须是数字');
  }

  if (typeof duration !== 'number') {
    errors.push('duration必须是数字');
  }

  // 验证可选参数
  if (verifyPath && !Array.isArray(verifyPath)) {
    errors.push('verifyPath必须是数组');
  }

  if (trackData && !Array.isArray(trackData)) {
    errors.push('trackData必须是数组');
  }

  // 验证参数范围
  if (typeof slideDistance === 'number' && (slideDistance < 0 || slideDistance > 1000)) {
    errors.push('slideDistance超出有效范围');
  }

  if (typeof puzzleOffset === 'number' && (puzzleOffset < 0 || puzzleOffset > 1000)) {
    errors.push('puzzleOffset超出有效范围');
  }

  if (typeof accuracy === 'number' && (accuracy < 0 || accuracy > 1000)) {
    errors.push('accuracy超出有效范围');
  }

  if (typeof duration === 'number' && (duration < 0 || duration > 60000)) {
    errors.push('duration超出有效范围');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errorCode: SliderVerifyErrorCode.INVALID_PARAMETERS,
      message: SliderVerifyErrorMessages[SliderVerifyErrorCode.INVALID_PARAMETERS],
      details: errors
    });
  }

  next();
};

/**
 * 滑块验证安全检查中间件
 */
export const sliderVerifySecurityCheck = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const redis = new RedisService();

  try {
    // 检查IP黑名单
    const isBlacklisted = await redis.sismember('slider_verify:blacklist:ip', ip);
    if (isBlacklisted) {
      console.warn(`🚫 滑块验证阻止黑名单IP: ${ip}`);
      return res.status(403).json({
        success: false,
        errorCode: SliderVerifyErrorCode.RATE_LIMIT_EXCEEDED,
        message: '访问被拒绝'
      });
    }

    // 检查可疑User-Agent
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i
    ];

    const isSuspiciousUA = suspiciousPatterns.some(pattern => pattern.test(userAgent));
    if (isSuspiciousUA) {
      console.warn(`🚫 滑块验证检测到可疑User-Agent: ${userAgent}`);
      
      // 增加可疑行为计数
      const suspiciousKey = `slider_verify:suspicious:${ip}`;
      const suspiciousCount = await redis.incr(suspiciousKey);
      await redis.expire(suspiciousKey, 3600); // 1小时过期

      if (suspiciousCount > 5) {
        // 加入临时黑名单
        await redis.sadd('slider_verify:blacklist:ip', ip);
        await redis.expire('slider_verify:blacklist:ip', 24 * 3600); // 24小时过期
        
        return res.status(403).json({
          success: false,
          errorCode: SliderVerifyErrorCode.RATE_LIMIT_EXCEEDED,
          message: '访问被拒绝'
        });
      }
    }

    next();
  } catch (error) {
    console.error('滑块验证安全检查失败:', error);
    // 安全检查失败时不阻止请求，但记录错误
    next();
  }
};

/**
 * 记录滑块验证统计信息
 */
async function recordSliderVerifyStats(
  req: Request, 
  res: Response, 
  duration: number, 
  responseData: any
): Promise<void> {
  const redis = new RedisService();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const statsKey = `slider_verify:stats:${date}`;

  try {
    const pipeline = redis.getClient().pipeline();
    
    // 总请求数
    pipeline.hincrby(statsKey, 'total_requests', 1);
    
    // 成功/失败计数
    if (responseData?.success && responseData?.data?.verified) {
      pipeline.hincrby(statsKey, 'successful_requests', 1);
      
      // 记录精度和持续时间（用于计算平均值）
      if (req.body.accuracy !== undefined) {
        pipeline.hincrby(statsKey, 'total_accuracy', Math.round(req.body.accuracy * 100));
      }
      if (req.body.duration !== undefined) {
        pipeline.hincrby(statsKey, 'total_duration', req.body.duration);
      }
    } else {
      pipeline.hincrby(statsKey, 'failed_requests', 1);
    }
    
    // 响应时间统计
    pipeline.hincrby(statsKey, 'total_response_time', duration);
    
    // 设置过期时间（保留30天）
    pipeline.expire(statsKey, 30 * 24 * 3600);
    
    await pipeline.exec();
  } catch (error) {
    console.error('记录滑块验证统计失败:', error);
  }
}

/**
 * 获取滑块验证统计信息
 */
export async function getSliderVerifyStats(days: number = 7): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageAccuracy: number;
  averageDuration: number;
  averageResponseTime: number;
}> {
  const redis = new RedisService();
  
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let totalAccuracy = 0;
  let totalDuration = 0;
  let totalResponseTime = 0;

  try {
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const statsKey = `slider_verify:stats:${dateStr}`;
      
      const stats = await redis.hgetall(statsKey);
      
      totalRequests += parseInt(stats.total_requests || '0');
      successfulRequests += parseInt(stats.successful_requests || '0');
      failedRequests += parseInt(stats.failed_requests || '0');
      totalAccuracy += parseInt(stats.total_accuracy || '0');
      totalDuration += parseInt(stats.total_duration || '0');
      totalResponseTime += parseInt(stats.total_response_time || '0');
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
      averageAccuracy: successfulRequests > 0 ? totalAccuracy / (successfulRequests * 100) : 0,
      averageDuration: successfulRequests > 0 ? totalDuration / successfulRequests : 0,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0
    };
  } catch (error) {
    console.error('获取滑块验证统计失败:', error);
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      averageAccuracy: 0,
      averageDuration: 0,
      averageResponseTime: 0
    };
  }
}

export default {
  sliderVerifyRateLimit,
  sliderVerifyLogger,
  sliderVerifyValidator,
  sliderVerifySecurityCheck,
  getSliderVerifyStats
};