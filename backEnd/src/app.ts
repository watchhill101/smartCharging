import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { validateConfig, setDefaults, printConfigSummary } from './utils/configValidator';
import { initDatabaseOptimization, cleanupDatabaseOptimization } from './config/databaseOptimization';

// 路由导入
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import stationRoutes from './routes/station';
import chargingRoutes from './routes/charging';
import paymentRoutes from './routes/payment';
import walletRoutes from './routes/wallet';
import faceRoutes from './routes/face';
import helpRoutes from './routes/help';
import couponRoutes from './routes/coupon';
import notificationRoutes from './routes/notification';
import notificationsRoutes from './routes/notifications';
import notificationTestRoutes from './routes/notificationTest';
import smsRoutes from './routes/sms';
import smsTestRoutes from './routes/smsTest';
import adminRoutes from './routes/admin';
import mongoose from 'mongoose';
import { disconnectDB } from './config/database';
import { getRedisClient, disconnectRedis } from './config/redis';
import { WebSocketService } from './services/WebSocketService';
import { NotificationService } from './services/NotificationService';
import { SmsService } from './services/SmsService';
import { SmsNotificationService } from './services/SmsNotificationService';
import { RedisService } from './services/RedisService';
import { createSmsIntegration } from './utils/smsIntegration';

// 导入所有模型以确保它们被注册到Mongoose
import './models';

// 验证和设置配置
setDefaults();
const configValidation = validateConfig();

if (!configValidation.isValid) {
  logger.error('Configuration validation failed', { errors: configValidation.errors });
    configValidation.errors.forEach(error => {
      logger.error('Configuration error', { error });
    });
  process.exit(1);
}

// 打印配置摘要
printConfigSummary();

const app = express();
const PORT = process.env.PORT || 8080;

// 安全中间件配置
app.use(helmet({
  // 内容安全策略 - 生产环境启用
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  } : false,
  
  // 跨域嵌入策略 - 开发环境禁用
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  
  // 强制HTTPS传输安全
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1年
    includeSubDomains: true,
    preload: true
  } : false,
  
  // 禁用X-Powered-By头
  hidePoweredBy: true,
  
  // 防止点击劫持
  frameguard: { action: 'deny' },
  
  // 防止MIME类型嗅探
  noSniff: true,
  
  // 启用XSS过滤器
  xssFilter: true,
  
  // 引用策略
  referrerPolicy: { policy: 'same-origin' }
}));
// CORS配置
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',')
  : process.env.NODE_ENV === 'production'
    ? ['https://smartcharging.com']
    : [
        'http://localhost:3000',
        'http://localhost:8000',
        'http://localhost:8001',
        'http://localhost:8002',
        'http://127.0.0.1:8000',
        'http://127.0.0.1:8001',
        'http://127.0.0.1:8002',
        'http://localhost:10086', // Taro开发服务器端口
        'http://127.0.0.1:10086',
        'https://localhost:8000', // 添加HTTPS支持
        'https://127.0.0.1:8000',
        'https://localhost:8001',
        'https://127.0.0.1:8001'
      ];

app.use(cors({
  origin: (origin, callback) => {
    // 允许没有origin的请求（如移动应用、Postman等）
    if (!origin) return callback(null, true);
    
    // 检查origin是否在允许列表中
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // 生产环境严格检查，开发环境宽松处理
    if (process.env.NODE_ENV === 'production') {
      return callback(new Error('Not allowed by CORS'), false);
    } else {
      logger.warn(`CORS: Origin ${origin} not in whitelist, but allowing in development`);
      return callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'X-Request-ID'
  ],
  exposedHeaders: ['Content-Length', 'X-Request-ID'],
  optionsSuccessStatus: 200, // 处理旧版本IE
  preflightContinue: false
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      database: 'unknown',
      redis: 'unknown'
    }
  };

  try {
    // 检查MongoDB连接
    healthCheck.services.database = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch (error) {
    healthCheck.services.database = 'error';
  }

  try {
    // 检查Redis连接
    const redisClient = getRedisClient();
    await redisClient.ping();
    healthCheck.services.redis = 'connected';
  } catch (error) {
    healthCheck.services.redis = 'disconnected';
  }

  // 如果任何关键服务不可用，返回503状态
  const isHealthy = healthCheck.services.database === 'connected' && 
                   healthCheck.services.redis === 'connected';

  res.status(isHealthy ? 200 : 503).json(healthCheck);
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/charging', chargingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/coupon', couponRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/notification-test', notificationTestRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/sms-test', smsTestRoutes);
app.use('/api/admin', adminRoutes);

// 错误处理中间件
app.use(notFound);
app.use(errorHandler);

// 启动服务器
async function startServer() {
  try {
    // 连接数据库
    await connectDB();
    // MongoDB连接成功

    // 初始化数据库优化
    await initDatabaseOptimization();
    // 数据库优化初始化完成

    // 连接Redis
    await connectRedis();
    // Redis连接成功

    // 启动HTTP服务器
    const server = app.listen(PORT, () => {
      // 服务器启动成功
    });

    // 初始化WebSocket和通知服务
    const redisService = new RedisService({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    });

    // 初始化WebSocket服务
    const webSocketService = new WebSocketService(server, redisService);
    // WebSocket服务初始化

    // 初始化通知服务
    const notificationService = new NotificationService(redisService, webSocketService);
    notificationService.startScheduledTasks();
    // 通知服务初始化

    // 初始化短信服务
    const smsService = new SmsService({
      provider: (process.env.SMS_PROVIDER as 'aliyun' | 'tencent' | 'mock') || 'mock',
      accessKeyId: process.env.SMS_ACCESS_KEY_ID,
      accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
      signName: process.env.SMS_SIGN_NAME || '智能充电',
      endpoint: process.env.SMS_ENDPOINT
    });
    // 短信服务初始化

    // 初始化短信通知服务
    const smsNotificationService = new SmsNotificationService(smsService, notificationService);
    // 短信通知服务初始化

    // 初始化短信集成
    const smsIntegration = createSmsIntegration(notificationService, smsNotificationService);
    // 短信集成初始化

    // 将服务实例附加到app，供其他模块使用
    app.locals.webSocketService = webSocketService;
    app.locals.notificationService = notificationService;
    app.locals.smsService = smsService;
    app.locals.smsNotificationService = smsNotificationService;
    app.locals.smsIntegration = smsIntegration;

    logger.info('All services initialized successfully');

    // 全局异常处理
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      // 优雅关闭服务器
      server.close(() => {
        process.exit(1);
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // 优雅关闭服务器
      server.close(() => {
        process.exit(1);
      });
    });

    // 优雅关闭处理
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed.');
        
        try {
          // 清理数据库优化
          cleanupDatabaseOptimization();
          logger.info('Database optimization cleaned up.');
          
          // 关闭数据库连接
          await disconnectDB();
          logger.info('Database disconnected.');
          
          // 关闭Redis连接
          await disconnectRedis();
          logger.info('Redis disconnected.');
          
          logger.info('Graceful shutdown completed.');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    };

    // 监听关闭信号
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    const err = error as Error;
    logger.error('Failed to start server', { error: err.message }, err.stack);
    process.exit(1);
  }
}

startServer();

export default app;