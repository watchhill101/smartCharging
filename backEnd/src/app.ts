import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// 路由导入
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import stationRoutes from './routes/station';
import chargingRoutes from './routes/charging';
import paymentRoutes from './routes/payment';
import walletRoutes from './routes/wallet';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://smartcharging.com'] 
    : ['http://localhost:3000'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/charging', chargingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);

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