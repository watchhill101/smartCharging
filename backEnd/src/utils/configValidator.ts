// 配置验证工具
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 必需的环境变量
const requiredEnvVars = [
  'JWT_SECRET',
  'MONGODB_URI',
  'REDIS_URL',
  'API_BASE_URL',
  'FRONTEND_URL'
];

// 可选的环境变量及其默认值
const optionalEnvVars = {
  NODE_ENV: 'development',
  PORT: '8080',
  JWT_EXPIRES_IN: '7d',
  ALIPAY_APP_ID: '',
  ALIPAY_PRIVATE_KEY: '',
  ALIPAY_PUBLIC_KEY: ''
};

// 验证配置
export const validateConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 检查必需的环境变量
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`缺少必需的环境变量: ${varName}`);
    }
  });

  // 验证特定格式
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET 长度应至少为32个字符');
  }

  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.startsWith('mongodb://') && !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    errors.push('MONGODB_URI 格式不正确，应以 mongodb:// 或 mongodb+srv:// 开头');
  }

  if (process.env.REDIS_URL && !process.env.REDIS_URL.startsWith('redis://') && !process.env.REDIS_URL.startsWith('rediss://')) {
    errors.push('REDIS_URL 格式不正确，应以 redis:// 或 rediss:// 开头');
  }

  if (process.env.API_BASE_URL && !process.env.API_BASE_URL.startsWith('http')) {
    errors.push('API_BASE_URL 格式不正确，应以 http:// 或 https:// 开头');
  }

  if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.startsWith('http')) {
    errors.push('FRONTEND_URL 格式不正确，应以 http:// 或 https:// 开头');
  }

  // 验证端口号
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('PORT 必须是1-65535之间的有效数字');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// 设置默认值
export const setDefaults = (): void => {
  Object.entries(optionalEnvVars).forEach(([key, defaultValue]) => {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
    }
  });
};

// 获取配置信息
export const getConfig = () => {
  return {
    NODE_ENV: process.env.NODE_ENV,
    PORT: parseInt(process.env.PORT || '8080'),
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    MONGODB_URI: process.env.MONGODB_URI,
    REDIS_URL: process.env.REDIS_URL,
    API_BASE_URL: process.env.API_BASE_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    ALIPAY_APP_ID: process.env.ALIPAY_APP_ID,
    ALIPAY_PRIVATE_KEY: process.env.ALIPAY_PRIVATE_KEY,
    ALIPAY_PUBLIC_KEY: process.env.ALIPAY_PUBLIC_KEY
  };
};

// 打印配置摘要（隐藏敏感信息）
export const printConfigSummary = (): void => {
  const config = getConfig();
  
  console.log('\n📋 配置摘要:');
  console.log(`   环境: ${config.NODE_ENV}`);
  console.log(`   端口: ${config.PORT}`);
  console.log(`   数据库: ${config.MONGODB_URI?.replace(/\/\/.*@/, '//***:***@') || '未配置'}`);
  console.log(`   缓存: ${config.REDIS_URL?.replace(/\/\/.*@/, '//***:***@') || '未配置'}`);
  console.log(`   API地址: ${config.API_BASE_URL || '未配置'}`);
  console.log(`   前端地址: ${config.FRONTEND_URL || '未配置'}`);
  console.log(`   JWT有效期: ${config.JWT_EXPIRES_IN}`);
  console.log(`   支付宝配置: ${config.ALIPAY_APP_ID ? '已配置' : '未配置'}`);
  console.log('');
};
