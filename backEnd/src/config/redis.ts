import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType;

export const connectRedis = async (): Promise<void> => {
  try {
    const redisURL = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisURL,
      socket: {
        connectTimeout: 5000,
      },
    });

    // 错误处理
    redisClient.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redisClient.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });

    redisClient.on('ready', () => {
      console.log('Redis ready for commands');
    });

    await redisClient.connect();
    
  } catch (error) {
    console.error('Redis connection failed:', error);
    throw error;
  }
};

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisClient) {
      await redisClient.quit();
      console.log('Redis disconnected successfully');
    }
  } catch (error) {
    console.error('Error disconnecting from Redis:', error);
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
      await client.setEx(key, ttl, serializedValue);
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
      console.error('Error parsing cached value:', error);
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