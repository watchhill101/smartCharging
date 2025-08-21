import { RedisService } from '../services/RedisService';
import { logger } from '../utils/logger';

let redisService: RedisService;

export const connectRedis = async (): Promise<void> => {
  try {
    redisService = new RedisService();
    
    // 测试连接
    await redisService.ping();
    logger.info('✅ Redis连接成功');
    
  } catch (error) {
    const err = error as Error;
    logger.error('Redis connection failed', { error: err.message }, err.stack);
    throw error;
  }
};

export const getRedisClient = (): RedisService => {
  if (!redisService) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisService;
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisService) {
      await redisService.disconnect();
      logger.info('✅ Redis断开连接成功');
    }
  } catch (error) {
    const err = error as Error;
    logger.error('Error disconnecting from Redis', { error: err.message }, err.stack);
    throw error;
  }
};

// Redis缓存工具函数
export const cacheUtils = {
  // 设置缓存
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const client = getRedisClient();
    const serializedValue = JSON.stringify(value);
    
    if (ttl) {
      await client.setex(key, ttl, serializedValue);
    } else {
      await client.set(key, serializedValue);
    }
  },

  // 获取缓存
  async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    const value = await client.get(key);
    
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      const err = error as Error;
      logger.error('Error parsing cached value', { key, error: err.message }, err.stack);
      return null;
    }
  },

  // 删除缓存
  async del(key: string): Promise<void> {
    const client = getRedisClient();
    await client.del(key);
  },

  // 检查键是否存在
  async exists(key: string): Promise<boolean> {
    const client = getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  },

  // 设置过期时间
  async expire(key: string, ttl: number): Promise<void> {
    const client = getRedisClient();
    await client.expire(key, ttl);
  },

  // 获取剩余过期时间
  async ttl(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.ttl(key);
  }
};