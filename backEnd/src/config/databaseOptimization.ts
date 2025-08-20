/**
 * 数据库查询优化配置
 */

import mongoose from 'mongoose';
import { logger } from '../utils/logger';

/**
 * 数据库索引优化配置
 */
export const indexOptimizationConfig = {
  // 用户相关索引
  User: [
    { fields: { phone: 1 }, options: { unique: true, sparse: true } },
    { fields: { email: 1 }, options: { unique: true, sparse: true } },
    { fields: { isDeleted: 1, createdAt: -1 }, options: {} },
    { fields: { verificationLevel: 1, isDeleted: 1 }, options: {} },
    { fields: { faceEnabled: 1, isDeleted: 1 }, options: {} },
    { fields: { createdAt: -1 }, options: {} },
    // 复合索引优化
    { fields: { isDeleted: 1, phone: 1 }, options: {} },
    { fields: { isDeleted: 1, email: 1 }, options: {} },
    { fields: { verificationLevel: 1, faceEnabled: 1, isDeleted: 1 }, options: {} }
  ],

  // 充电站相关索引
  ChargingStation: [
    { fields: { stationId: 1 }, options: { unique: true } },
    { fields: { location: '2dsphere' }, options: {} }, // 地理位置索引
    { fields: { status: 1, isVerified: 1 }, options: {} },
    { fields: { 'operator.name': 1 }, options: {} },
    { fields: { city: 1, district: 1 }, options: {} },
    { fields: { 'rating.average': -1, 'rating.count': -1 }, options: {} },
    { fields: { availablePiles: -1, totalPiles: -1 }, options: {} },
    // 复合索引优化
    { fields: { status: 1, city: 1, availablePiles: -1 }, options: {} },
    { fields: { isVerified: 1, status: 1, 'rating.average': -1 }, options: {} },
    { fields: { city: 1, district: 1, status: 1, availablePiles: -1 }, options: {} },
    // 文本搜索索引
    { fields: { name: 'text', address: 'text', 'operator.name': 'text' }, options: {} }
  ],

  // 充电会话相关索引
  ChargingSession: [
    { fields: { sessionId: 1 }, options: { unique: true } },
    { fields: { userId: 1, createdAt: -1 }, options: {} },
    { fields: { stationId: 1, createdAt: -1 }, options: {} },
    { fields: { status: 1, createdAt: -1 }, options: {} },
    { fields: { paymentStatus: 1, status: 1 }, options: {} },
    // 复合索引优化
    { fields: { userId: 1, status: 1, createdAt: -1 }, options: {} },
    { fields: { stationId: 1, status: 1, startTime: -1 }, options: {} },
    { fields: { userId: 1, paymentStatus: 1, totalCost: -1 }, options: {} },
    // 统计查询优化
    { fields: { createdAt: -1, status: 1, energyDelivered: 1 }, options: {} }
  ],

  // 订单相关索引
  Order: [
    { fields: { orderId: 1 }, options: { unique: true } },
    { fields: { userId: 1, createdAt: -1 }, options: {} },
    { fields: { status: 1, createdAt: -1 }, options: {} },
    { fields: { type: 1, status: 1 }, options: {} },
    { fields: { paymentMethod: 1, status: 1 }, options: {} },
    { fields: { thirdPartyOrderId: 1 }, options: { sparse: true } },
    // 复合索引优化
    { fields: { userId: 1, type: 1, status: 1, createdAt: -1 }, options: {} },
    { fields: { userId: 1, paymentMethod: 1, status: 1 }, options: {} },
    { fields: { status: 1, type: 1, amount: -1 }, options: {} }
  ],

  // 钱包相关索引
  Wallet: [
    { fields: { userId: 1 }, options: { unique: true } },
    { fields: { 'transactions.id': 1 }, options: {} },
    { fields: { 'transactions.orderId': 1 }, options: { sparse: true } },
    { fields: { 'transactions.type': 1, 'transactions.createdAt': -1 }, options: {} },
    { fields: { 'transactions.status': 1, 'transactions.createdAt': -1 }, options: {} },
    { fields: { 'invoices.id': 1 }, options: {} },
    { fields: { 'invoices.invoiceNumber': 1 }, options: { unique: true, sparse: true } },
    { fields: { 'invoices.status': 1, 'invoices.appliedAt': -1 }, options: {} }
  ],

  // 优惠券相关索引
  Coupon: [
    { fields: { couponId: 1 }, options: { unique: true } },
    { fields: { validFrom: 1, validTo: 1 }, options: {} },
    { fields: { isActive: 1, validTo: 1 }, options: {} },
    { fields: { isActive: 1, remainingQuantity: 1 }, options: {} },
    { fields: { type: 1, applicableScenarios: 1 }, options: {} },
    { fields: { createdBy: 1, createdAt: -1 }, options: {} },
    // 复合索引优化
    { fields: { isActive: 1, validFrom: 1, validTo: 1, remainingQuantity: 1 }, options: {} }
  ],

  // 用户优惠券相关索引
  UserCoupon: [
    { fields: { couponCode: 1 }, options: { unique: true } },
    { fields: { userId: 1, status: 1 }, options: {} },
    { fields: { userId: 1, expiredAt: 1 }, options: {} },
    { fields: { couponId: 1 }, options: {} },
    { fields: { status: 1, expiredAt: 1 }, options: {} },
    // 复合索引优化
    { fields: { userId: 1, status: 1, expiredAt: 1 }, options: {} }
  ],

  // 通知相关索引
  Notification: [
    { fields: { userId: 1, createdAt: -1 }, options: {} },
    { fields: { userId: 1, isRead: 1 }, options: {} },
    { fields: { type: 1, subType: 1 }, options: {} },
    { fields: { scheduledAt: 1 }, options: { sparse: true } },
    { fields: { expiresAt: 1 }, options: { sparse: true } },
    { fields: { priority: 1, createdAt: -1 }, options: {} },
    // 复合索引优化
    { fields: { userId: 1, isRead: 1, createdAt: -1 }, options: {} },
    { fields: { userId: 1, type: 1, isRead: 1 }, options: {} }
  ],

  // 反馈相关索引
  Feedback: [
    { fields: { ticketId: 1 }, options: { unique: true } },
    { fields: { userId: 1, createdAt: -1 }, options: {} },
    { fields: { status: 1, priority: 1, createdAt: -1 }, options: {} },
    { fields: { type: 1, createdAt: -1 }, options: {} },
    // 复合索引优化
    { fields: { userId: 1, status: 1, createdAt: -1 }, options: {} }
  ],

  // FAQ相关索引
  FAQ: [
    { fields: { category: 1, priority: -1 }, options: {} },
    { fields: { tags: 1 }, options: {} },
    { fields: { isActive: 1, priority: -1 }, options: {} },
    // 文本搜索索引
    { fields: { question: 'text', answer: 'text', tags: 'text' }, options: {} }
  ],

  // 人脸识别相关索引
  FaceProfile: [
    { fields: { faceId: 1 }, options: { unique: true } },
    { fields: { userId: 1, isActive: 1 }, options: {} },
    { fields: { lastUsedAt: -1 }, options: { sparse: true } },
    { fields: { usageCount: -1 }, options: {} }
  ],

  FaceLoginRecord: [
    { fields: { userId: 1, loginAt: -1 }, options: {} },
    { fields: { faceId: 1, loginAt: -1 }, options: {} },
    { fields: { success: 1, loginAt: -1 }, options: {} },
    { fields: { ipAddress: 1, loginAt: -1 }, options: {} },
    // 复合索引优化
    { fields: { userId: 1, success: 1, loginAt: -1 }, options: {} }
  ]
};

/**
 * 查询优化配置
 */
export const queryOptimizationConfig = {
  // 分页查询默认配置
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
    defaultSort: { createdAt: -1 }
  },

  // 聚合查询优化
  aggregation: {
    // 允许磁盘使用（处理大数据集）
    allowDiskUse: true,
    // 批处理大小
    batchSize: 1000,
    // 最大执行时间（毫秒）
    maxTimeMS: 30000
  },

  // 查询超时配置
  timeout: {
    find: 10000,      // 普通查询10秒
    aggregate: 30000, // 聚合查询30秒
    update: 15000,    // 更新操作15秒
    delete: 10000     // 删除操作10秒
  },

  // 读取偏好配置
  readPreference: {
    // 默认从主节点读取
    default: 'primary',
    // 统计查询可以从从节点读取
    analytics: 'secondaryPreferred',
    // 报表查询从从节点读取
    reporting: 'secondary'
  },

  // 写入关注配置
  writeConcern: {
    // 默认写入关注
    default: { w: 'majority', j: true, wtimeout: 10000 },
    // 批量操作写入关注
    bulk: { w: 1, j: false, wtimeout: 5000 },
    // 重要操作写入关注
    critical: { w: 'majority', j: true, wtimeout: 15000 }
  }
};

/**
 * 慢查询监控配置
 */
export const slowQueryConfig = {
  // 慢查询阈值（毫秒）
  threshold: {
    find: 1000,      // 查询操作1秒
    aggregate: 5000, // 聚合操作5秒
    update: 2000,    // 更新操作2秒
    insert: 1000,    // 插入操作1秒
    delete: 2000     // 删除操作2秒
  },

  // 监控配置
  monitoring: {
    enabled: true,
    logSlowQueries: true,
    profileLevel: 2, // 记录所有慢操作
    sampleRate: 1.0  // 100%采样
  },

  // 报警配置
  alerts: {
    enabled: true,
    thresholds: {
      slowQueryCount: 10,    // 10个慢查询触发报警
      avgExecutionTime: 3000, // 平均执行时间3秒触发报警
      errorRate: 0.05        // 错误率5%触发报警
    }
  }
};

/**
 * 连接池优化配置
 */
export const connectionPoolConfig = {
  // 最大连接数
  maxPoolSize: 20,
  // 最小连接数
  minPoolSize: 5,
  // 连接空闲时间（毫秒）
  maxIdleTimeMS: 30000,
  // 等待连接超时时间（毫秒）
  waitQueueTimeoutMS: 10000,
  // 服务器选择超时时间（毫秒）
  serverSelectionTimeoutMS: 5000,
  // Socket超时时间（毫秒）
  socketTimeoutMS: 45000,
  // 连接超时时间（毫秒）
  connectTimeoutMS: 10000,
  // 心跳频率（毫秒）
  heartbeatFrequencyMS: 10000,
  // 缓冲命令
  bufferCommands: false
};

/**
 * 数据库性能监控配置
 */
export const performanceMonitoringConfig = {
  // 监控指标
  metrics: {
    // 连接池指标
    connectionPool: true,
    // 操作延迟指标
    operationLatency: true,
    // 查询性能指标
    queryPerformance: true,
    // 索引使用指标
    indexUsage: true,
    // 内存使用指标
    memoryUsage: true
  },

  // 采样配置
  sampling: {
    enabled: true,
    rate: 0.1, // 10%采样率
    maxSamples: 1000
  },

  // 报告配置
  reporting: {
    interval: 60000, // 1分钟报告间隔
    enabled: true,
    includeStackTrace: false
  }
};

/**
 * 缓存优化配置
 */
export const cacheOptimizationConfig = {
  // 查询结果缓存
  queryCache: {
    enabled: true,
    ttl: 300, // 5分钟TTL
    maxSize: 1000, // 最大缓存条目数
    // 可缓存的查询类型
    cacheable: [
      'ChargingStation.findNearby',
      'FAQ.findByCategory',
      'Coupon.findActive',
      'User.findById'
    ]
  },

  // 聚合结果缓存
  aggregationCache: {
    enabled: true,
    ttl: 600, // 10分钟TTL
    maxSize: 500,
    // 可缓存的聚合查询
    cacheable: [
      'ChargingSession.getStatistics',
      'Order.getRevenue',
      'User.getAnalytics'
    ]
  },

  // 静态数据缓存
  staticCache: {
    enabled: true,
    ttl: 3600, // 1小时TTL
    // 静态数据类型
    types: [
      'systemConfig',
      'chargingStationOperators',
      'supportedVehicles'
    ]
  }
};

/**
 * 数据库优化管理器
 */
export class DatabaseOptimizationManager {
  private static instance: DatabaseOptimizationManager;
  private isInitialized = false;
  private performanceMetrics: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): DatabaseOptimizationManager {
    if (!DatabaseOptimizationManager.instance) {
      DatabaseOptimizationManager.instance = new DatabaseOptimizationManager();
    }
    return DatabaseOptimizationManager.instance;
  }

  /**
   * 初始化数据库优化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Database optimization already initialized');
      return;
    }

    try {
      logger.info('🔧 Initializing database optimization...');

      // 1. 创建索引
      await this.createOptimizedIndexes();

      // 2. 配置慢查询监控
      await this.setupSlowQueryMonitoring();

      // 3. 启用性能监控
      await this.enablePerformanceMonitoring();

      // 4. 配置连接池
      this.configureConnectionPool();

      // 5. 设置查询优化
      this.setupQueryOptimization();

      this.isInitialized = true;
      logger.info('✅ Database optimization initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize database optimization:', error);
      throw error;
    }
  }

  /**
   * 创建优化索引
   */
  private async createOptimizedIndexes(): Promise<void> {
    logger.info('📊 Creating optimized indexes...');

    for (const [modelName, indexes] of Object.entries(indexOptimizationConfig)) {
      try {
        const model = mongoose.model(modelName);
        
        for (const indexConfig of indexes) {
          try {
            await model.collection.createIndex(indexConfig.fields as any, indexConfig.options);
            logger.debug(`✅ Created index for ${modelName}:`, indexConfig.fields);
          } catch (error: any) {
            if (error.code === 85) {
              // 索引已存在，跳过
              logger.debug(`⚠️ Index already exists for ${modelName}:`, indexConfig.fields);
            } else if (error.code === 86) {
              // 索引键规格冲突，尝试删除现有索引后重新创建
              logger.warn(`⚠️ Index key specs conflict for ${modelName}, attempting to recreate:`, indexConfig.fields);
              try {
                // 获取现有索引名称
                const indexName = Object.keys(indexConfig.fields).join('_') + '_1';
                await model.collection.dropIndex(indexName);
                logger.debug(`🗑️ Dropped conflicting index ${indexName} for ${modelName}`);
                
                // 重新创建索引
                await model.collection.createIndex(indexConfig.fields as any, indexConfig.options);
                logger.debug(`✅ Recreated index for ${modelName}:`, indexConfig.fields);
              } catch (recreateError: any) {
                logger.error(`❌ Failed to recreate index for ${modelName}:`, recreateError);
              }
            } else {
              logger.error(`❌ Failed to create index for ${modelName}:`, error);
            }
          }
        }
      } catch (error) {
        logger.error(`❌ Failed to process indexes for ${modelName}:`, error);
      }
    }

    logger.info('✅ Optimized indexes created');
  }

  /**
   * 设置慢查询监控
   */
  private async setupSlowQueryMonitoring(): Promise<void> {
    if (!slowQueryConfig.monitoring.enabled) {
      return;
    }

    logger.info('🐌 Setting up slow query monitoring...');

    try {
      // 设置慢查询日志级别
      await mongoose.connection.db.admin().command({
        profile: slowQueryConfig.monitoring.profileLevel,
        slowms: Math.min(...Object.values(slowQueryConfig.threshold)),
        sampleRate: slowQueryConfig.monitoring.sampleRate
      });

      // 监听慢查询事件
      mongoose.connection.on('commandStarted', (event) => {
        this.trackQueryStart(event);
      });

      mongoose.connection.on('commandSucceeded', (event) => {
        this.trackQueryEnd(event, 'success');
      });

      mongoose.connection.on('commandFailed', (event) => {
        this.trackQueryEnd(event, 'failed');
      });

      logger.info('✅ Slow query monitoring enabled');
    } catch (error) {
      logger.error('❌ Failed to setup slow query monitoring:', error);
    }
  }

  /**
   * 启用性能监控
   */
  private async enablePerformanceMonitoring(): Promise<void> {
    if (!performanceMonitoringConfig.reporting.enabled) {
      return;
    }

    logger.info('📈 Enabling performance monitoring...');

    // 定期收集性能指标
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, performanceMonitoringConfig.reporting.interval);

    logger.info('✅ Performance monitoring enabled');
  }

  /**
   * 配置连接池
   */
  private configureConnectionPool(): void {
    logger.info('🏊 Configuring connection pool...');

    // 连接池配置已在 database.ts 中设置
    // 这里可以添加额外的连接池监控

    mongoose.connection.on('connected', () => {
      logger.info('📊 Database connection pool ready');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ Database connection pool disconnected');
    });

    logger.info('✅ Connection pool configured');
  }

  /**
   * 设置查询优化
   */
  private setupQueryOptimization(): void {
    logger.info('⚡ Setting up query optimization...');

    // 设置默认查询选项
    mongoose.set('maxTimeMS', queryOptimizationConfig.timeout.find);
    mongoose.set('bufferCommands', false);
    // bufferMaxEntries 选项在新版本Mongoose中已移除

    logger.info('✅ Query optimization configured');
  }

  /**
   * 跟踪查询开始
   */
  private trackQueryStart(event: any): void {
    const startTime = Date.now();
    this.performanceMetrics.set(event.requestId, {
      command: event.commandName,
      collection: event.command[event.commandName],
      startTime,
      query: event.command
    });
  }

  /**
   * 跟踪查询结束
   */
  private trackQueryEnd(event: any, status: 'success' | 'failed'): void {
    const metric = this.performanceMetrics.get(event.requestId);
    if (!metric) return;

    const duration = Date.now() - metric.startTime;
    const threshold = slowQueryConfig.threshold[metric.command as keyof typeof slowQueryConfig.threshold] || 1000;

    if (duration > threshold) {
      logger.warn('🐌 Slow query detected:', {
        command: metric.command,
        collection: metric.collection,
        duration: `${duration}ms`,
        status,
        query: JSON.stringify(metric.query, null, 2)
      });

      // 触发慢查询报警
      if (slowQueryConfig.alerts.enabled) {
        this.triggerSlowQueryAlert(metric, duration, status);
      }
    }

    this.performanceMetrics.delete(event.requestId);
  }

  /**
   * 触发慢查询报警
   */
  private triggerSlowQueryAlert(metric: any, duration: number, status: string): void {
    // 这里可以集成报警系统
    logger.error('🚨 Slow query alert:', {
      command: metric.command,
      collection: metric.collection,
      duration: `${duration}ms`,
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 收集性能指标
   */
  private async collectPerformanceMetrics(): Promise<void> {
    try {
      const db = mongoose.connection.db;
      
      // 获取数据库统计信息
      const dbStats = await db.stats();
      
      // 获取连接池状态
      const connectionStatus = {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      };

      // 记录性能指标
      logger.debug('📊 Database performance metrics:', {
        dbStats: {
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          indexSize: dbStats.indexSize,
          storageSize: dbStats.storageSize
        },
        connectionStatus,
        activeQueries: this.performanceMetrics.size
      });

    } catch (error) {
      logger.error('❌ Failed to collect performance metrics:', error);
    }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): any {
    return {
      isInitialized: this.isInitialized,
      activeQueries: this.performanceMetrics.size,
      connectionState: mongoose.connection.readyState,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.performanceMetrics.clear();
    this.isInitialized = false;
    logger.info('🧹 Database optimization cleaned up');
  }
}

// 导出单例实例
export const databaseOptimizationManager = DatabaseOptimizationManager.getInstance();

/**
 * 初始化数据库优化
 */
export const initDatabaseOptimization = async (): Promise<void> => {
  try {
    await databaseOptimizationManager.initialize();
  } catch (error) {
    logger.error('Failed to initialize database optimization:', error);
    throw error;
  }
};

/**
 * 获取数据库性能报告
 */
export const getDatabasePerformanceReport = (): any => {
  return databaseOptimizationManager.getPerformanceReport();
};

/**
 * 清理数据库优化
 */
export const cleanupDatabaseOptimization = (): void => {
  databaseOptimizationManager.cleanup();
};

export default databaseOptimizationManager;