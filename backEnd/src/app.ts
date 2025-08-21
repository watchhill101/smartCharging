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
import couponRoutes from './routes/coupons';

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
// 兼容前端v1_0路径格式的路由
app.use('/v1_0/auth/api/auth', authRoutes);
app.use('/v1_0/auth/api/users', userRoutes);

// 标准API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/charging', chargingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/coupons', couponRoutes);

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
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;