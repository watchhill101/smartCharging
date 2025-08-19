import Redis from 'ioredis';

export class RedisService {
  private client: Redis;
  private static instance: RedisService;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      // 连接池配置
      family: 4,
      keepAlive: true,
      // 重连配置
      retryDelayOnClusterDown: 300,
      enableOfflineQueue: false
    });

    // 连接事件监听
    this.client.on('connect', () => {
      console.log('✅ Redis连接成功');
    });

    this.client.on('ready', () => {
      console.log('🚀 Redis准备就绪');
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis连接错误:', error);
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
      console.error(`Redis SET 操作失败 [${key}]:`, error);
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
      console.error(`Redis SETEX 操作失败 [${key}]:`, error);
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
      console.error(`Redis GET 操作失败 [${key}]:`, error);
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
      console.error(`Redis DEL 操作失败 [${key}]:`, error);
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
      console.error(`Redis EXISTS 操作失败 [${key}]:`, error);
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
      console.error(`Redis EXPIRE 操作失败 [${key}]:`, error);
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
      console.error(`Redis TTL 操作失败 [${key}]:`, error);
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
      console.error(`Redis INCR 操作失败 [${key}]:`, error);
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
      console.error(`Redis DECR 操作失败 [${key}]:`, error);
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
      console.error(`Redis HSET 操作失败 [${key}.${field}]:`, error);
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
      console.error(`Redis HGET 操作失败 [${key}.${field}]:`, error);
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
      console.error(`Redis HGETALL 操作失败 [${key}]:`, error);
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
      console.error(`Redis HDEL 操作失败 [${key}.${field}]:`, error);
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
      console.error(`Redis LPUSH 操作失败 [${key}]:`, error);
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
      console.error(`Redis RPUSH 操作失败 [${key}]:`, error);
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
      console.error(`Redis LPOP 操作失败 [${key}]:`, error);
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
      console.error(`Redis RPOP 操作失败 [${key}]:`, error);
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
      console.error(`Redis LLEN 操作失败 [${key}]:`, error);
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
      console.error(`Redis SADD 操作失败 [${key}]:`, error);
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
      console.error(`Redis SREM 操作失败 [${key}]:`, error);
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
      console.error(`Redis SISMEMBER 操作失败 [${key}]:`, error);
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
      console.error(`Redis SMEMBERS 操作失败 [${key}]:`, error);
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
      console.error(`Redis ZADD 操作失败 [${key}]:`, error);
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
      console.error(`Redis ZRANGE 操作失败 [${key}]:`, error);
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
      console.error(`Redis KEYS 操作失败 [${pattern}]:`, error);
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
      console.error('Redis FLUSHDB 操作失败:', error);
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
      console.error('Redis INFO 操作失败:', error);
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
      console.error('Redis PING 操作失败:', error);
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
      console.error('Redis断开连接失败:', error);
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