import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { validateConfig, setDefaults, printConfigSummary } from './utils/configValidator';

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
import notificationTestRoutes from './routes/notificationTest';
import smsRoutes from './routes/sms';
import smsTestRoutes from './routes/smsTest';

// 验证和设置配置
setDefaults();
const configValidation = validateConfig();

if (!configValidation.isValid) {
  console.error('❌ 配置验证失败:');
  configValidation.errors.forEach(error => {
    console.error(`   - ${error}`);
  });
  console.error('\n请检查您的环境变量配置。');
  process.exit(1);
}

// 打印配置摘要
printConfigSummary();

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
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
    ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
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
    const mongoose = require('mongoose');
    healthCheck.services.database = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch (error) {
    healthCheck.services.database = 'error';
  }

  try {
    // 检查Redis连接
    const { getRedisClient } = require('./config/redis');
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
app.use('/api/notification-test', notificationTestRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/sms-test', smsTestRoutes);

// 错误处理中间件
app.use(notFound);
app.use(errorHandler);

// 启动服务器
async function startServer() {
  try {
    // 连接数据库
    await connectDB();
    console.log('✅ MongoDB connected successfully');

    // 连接Redis
    await connectRedis();
    console.log('✅ Redis connected successfully');

    // 启动HTTP服务器
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    });

    // 初始化WebSocket和通知服务
    const { getRedisClient } = require('./config/redis');
    const { WebSocketService } = require('./services/WebSocketService');
    const { NotificationService } = require('./services/NotificationService');
    const { SmsService } = require('./services/SmsService');
    const { SmsNotificationService } = require('./services/SmsNotificationService');
    const { RedisService } = require('./services/RedisService');

    const redisService = new RedisService({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    });

    // 初始化WebSocket服务
    const webSocketService = new WebSocketService(server, redisService);
    console.log('📡 WebSocket service initialized');

    // 初始化通知服务
    const notificationService = new NotificationService(redisService, webSocketService);
    notificationService.startScheduledTasks();
    console.log('🔔 Notification service initialized');

    // 初始化短信服务
    const smsService = new SmsService({
      provider: (process.env.SMS_PROVIDER as 'aliyun' | 'tencent' | 'mock') || 'mock',
      accessKeyId: process.env.SMS_ACCESS_KEY_ID,
      accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
      signName: process.env.SMS_SIGN_NAME || '智能充电',
      endpoint: process.env.SMS_ENDPOINT
    });
    console.log('📱 SMS service initialized');

    // 初始化短信通知服务
    const smsNotificationService = new SmsNotificationService(smsService, notificationService);
    console.log('📲 SMS notification service initialized');

    // 初始化短信集成
    const { createSmsIntegration } = require('./utils/smsIntegration');
    const smsIntegration = createSmsIntegration(notificationService, smsNotificationService);
    console.log('🔗 SMS integration initialized');

    // 将服务实例附加到app，供其他模块使用
    app.locals.webSocketService = webSocketService;
    app.locals.notificationService = notificationService;
    app.locals.smsService = smsService;
    app.locals.smsNotificationService = smsNotificationService;
    app.locals.smsIntegration = smsIntegration;

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;