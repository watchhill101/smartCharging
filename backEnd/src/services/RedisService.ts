import Redis from 'ioredis';
import { logger } from '../utils/logger';

export class RedisService {
  private client: Redis;
  private static instance: RedisService;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }
    
    this.client = new Redis(redisUrl, {
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY_ON_FAILOVER || '100'),
      enableReadyCheck: process.env.REDIS_ENABLE_READY_CHECK !== 'false',
      maxRetriesPerRequest: process.env.REDIS_MAX_RETRIES_PER_REQUEST ? parseInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST) : null,
      lazyConnect: process.env.REDIS_LAZY_CONNECT !== 'false',
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
      // 连接池配置
      family: parseInt(process.env.REDIS_FAMILY || '4'),
      keepAlive: process.env.REDIS_KEEP_ALIVE !== 'false',
      // 重连配置
      retryDelayOnClusterDown: parseInt(process.env.REDIS_RETRY_DELAY_ON_CLUSTER_DOWN || '300'),
      enableOfflineQueue: process.env.REDIS_ENABLE_OFFLINE_QUEUE === 'true'
    });

    // 连接事件监听
    this.client.on('connect', () => {
      console.log('✅ Redis连接成功');
    });

    this.client.on('ready', () => {
      console.log('🚀 Redis准备就绪');
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message }, error.stack);
    });

    this.client.on('close', () => {
      console.log('🔌 Redis连接关闭');
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis重新连接中...');
    });
  }

  /**
   * 获取单例实例
   */
  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * 设置键值对
   */
  async set(key: string, value: string): Promise<'OK' | null> {
    try {
      return await this.client.set(key, value);
    } catch (error) {
      logger.error('Redis SET operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 设置键值对并指定过期时间（秒）
   */
  async setex(key: string, seconds: number, value: string): Promise<'OK' | null> {
    try {
      return await this.client.setex(key, seconds, value);
    } catch (error) {
      logger.error('Redis SETEX operation failed', { key, seconds, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 获取值
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 删除键
   */
  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<number> {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error('Redis EXISTS operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 设置键的过期时间
   */
  async expire(key: string, seconds: number): Promise<number> {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error('Redis EXPIRE operation failed', { key, seconds, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 获取键的剩余生存时间
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Redis TTL operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 原子性递增
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error('Redis INCR operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 原子性递减
   */
  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      logger.error('Redis DECR operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 哈希表操作 - 设置字段
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.client.hset(key, field, value);
    } catch (error) {
      logger.error('Redis HSET operation failed', { key, field, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 哈希表操作 - 获取字段
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      logger.error('Redis HGET operation failed', { key, field, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 哈希表操作 - 获取所有字段
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      logger.error('Redis HGETALL operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 哈希表操作 - 删除字段
   */
  async hdel(key: string, field: string): Promise<number> {
    try {
      return await this.client.hdel(key, field);
    } catch (error) {
      logger.error('Redis HDEL operation failed', { key, field, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 列表操作 - 左侧推入
   */
  async lpush(key: string, value: string): Promise<number> {
    try {
      return await this.client.lpush(key, value);
    } catch (error) {
      logger.error('Redis LPUSH operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 列表操作 - 右侧推入
   */
  async rpush(key: string, value: string): Promise<number> {
    try {
      return await this.client.rpush(key, value);
    } catch (error) {
      logger.error('Redis RPUSH operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 列表操作 - 左侧弹出
   */
  async lpop(key: string): Promise<string | null> {
    try {
      return await this.client.lpop(key);
    } catch (error) {
      logger.error('Redis LPOP operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 列表操作 - 右侧弹出
   */
  async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rpop(key);
    } catch (error) {
      logger.error('Redis RPOP operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 列表操作 - 获取长度
   */
  async llen(key: string): Promise<number> {
    try {
      return await this.client.llen(key);
    } catch (error) {
      logger.error('Redis LLEN operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 集合操作 - 添加成员
   */
  async sadd(key: string, member: string): Promise<number> {
    try {
      return await this.client.sadd(key, member);
    } catch (error) {
      logger.error('Redis SADD operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 集合操作 - 移除成员
   */
  async srem(key: string, member: string): Promise<number> {
    try {
      return await this.client.srem(key, member);
    } catch (error) {
      logger.error('Redis SREM operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 集合操作 - 检查成员是否存在
   */
  async sismember(key: string, member: string): Promise<number> {
    try {
      return await this.client.sismember(key, member);
    } catch (error) {
      logger.error('Redis SISMEMBER operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 集合操作 - 获取所有成员
   */
  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      logger.error('Redis SMEMBERS operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 有序集合操作 - 添加成员
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.client.zadd(key, score, member);
    } catch (error) {
      logger.error('Redis ZADD operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 有序集合操作 - 获取范围内的成员
   */
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.zrange(key, start, stop);
    } catch (error) {
      logger.error('Redis ZRANGE operation failed', { key, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 模糊匹配键
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS operation failed', { pattern, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 清空当前数据库
   */
  async flushdb(): Promise<'OK'> {
    try {
      return await this.client.flushdb();
    } catch (error) {
      logger.error('Redis FLUSHDB operation failed', { error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 获取Redis信息
   */
  async info(section?: string): Promise<string> {
    try {
      return await this.client.info(section);
    } catch (error) {
      logger.error('Redis INFO operation failed', { section, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 测试连接
   */
  async ping(): Promise<'PONG'> {
    try {
      return await this.client.ping();
    } catch (error) {
      logger.error('Redis PING operation failed', { error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 关闭连接
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      console.log('🔌 Redis连接已关闭');
    } catch (error) {
      logger.error('Redis disconnect failed', { error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 获取原始Redis客户端（用于高级操作）
   */
  getClient(): Redis {
    return this.client;
  }
}

export default RedisService;