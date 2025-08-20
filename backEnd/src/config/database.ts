import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_charging';
    
    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('MongoDB connected successfully');
    
    // 监听连接事件
    mongoose.connection.on('error', (error) => {
    logger.error('MongoDB connection error', { error: error.message }, error.stack);
  });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

  } catch (error) {
    const err = error as Error;
    logger.error('MongoDB connection failed', { error: err.message }, err.stack);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected successfully');
  } catch (error) {
    const err = error as Error;
    logger.error('Error disconnecting from MongoDB', { error: err.message }, err.stack);
    throw error;
  }
};