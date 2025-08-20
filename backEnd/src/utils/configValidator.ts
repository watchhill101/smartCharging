// 配置验证工具
import dotenv from "dotenv";
import path from "path";

// 加载环境变量 - 从项目根目录加载
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

// 必需的环境变量
const requiredEnvVars = [
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "QR_SECRET_KEY",
  "MONGODB_URI",
  "REDIS_URL",
  "API_BASE_URL",
  "FRONTEND_URL",
];

// 可选的环境变量及其默认值
const optionalEnvVars = {
  NODE_ENV: "development",
  PORT: "8080",
  LOG_LEVEL: "info",
  RATE_LIMIT_WINDOW_MS: "900000",
  RATE_LIMIT_MAX_REQUESTS: "100",
  SESSION_SECRET: "your-session-secret",
  BCRYPT_SALT_ROUNDS: "12",
  JWT_EXPIRES_IN: "7d",
  JWT_REFRESH_EXPIRES_IN: "7d",
  JWT_ACCESS_TOKEN_EXPIRE: "15m",
  JWT_REFRESH_TOKEN_EXPIRE: "7d",
  ALIPAY_APP_ID: "",
  ALIPAY_PRIVATE_KEY: "",
  ALIPAY_PUBLIC_KEY: "",
  ALIPAY_SANDBOX_APP_ID: "",
  ALIPAY_SANDBOX_PRIVATE_KEY: "",
  ALIPAY_SANDBOX_PUBLIC_KEY: "",
  ALIPAY_GATEWAY: "",
  ALIPAY_SANDBOX_GATEWAY: "",
  ALIPAY_SIGN_TYPE: "RSA2",
  ALIPAY_CHARSET: "utf-8",
  ALIPAY_VERSION: "1.0",
  ALIPAY_FORMAT: "json",
  ALIPAY_TIMEOUT: "30000",
  SMS_ACCESS_KEY_ID: "",
  SMS_ACCESS_KEY_SECRET: "",
  FACE_RECOGNITION_API_URL: "",
  FACE_RECOGNITION_API_KEY: "",
  ALLOWED_ORIGINS: "",
  CORS_METHODS: "GET,POST",
  CORS_CREDENTIALS: "true",
  WEBSOCKET_PING_TIMEOUT: "60000",
  WEBSOCKET_PING_INTERVAL: "25000",
  WEBSOCKET_HEARTBEAT_INTERVAL: "30000",
  SLIDER_USE_THIRD_PARTY: "false",
  SLIDER_THIRD_PARTY_PROVIDER: "generic",
  SLIDER_VERIFY_API_URL: "",
  SLIDER_VERIFY_API_KEY: "",
  SLIDER_CHALLENGE_EXPIRE_TIME: "300",
  SLIDER_MAX_ATTEMPTS: "3",
  SLIDER_ACCURACY_THRESHOLD: "15",
  SLIDER_MIN_DURATION: "300",
  SLIDER_MAX_DURATION: "15000",
  SLIDER_MIN_TRACK_POINTS: "5",
  GEETEST_API_URL: "",
  GEETEST_TIMEOUT: "5000",
  GEETEST_RETRIES: "3",
  TENCENT_CAPTCHA_API_URL: "",
  TENCENT_CAPTCHA_TIMEOUT: "8000",
  TENCENT_CAPTCHA_RETRIES: "2",
};

// 验证配置
export const validateConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 检查必需的环境变量
  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      errors.push(`缺少必需的环境变量: ${varName}`);
    }
  });

  // 验证特定格式
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push("JWT_SECRET 长度应至少为32个字符");
  }

  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
    errors.push("JWT_REFRESH_SECRET 长度应至少为32个字符");
  }

  if (process.env.QR_SECRET_KEY && process.env.QR_SECRET_KEY.length < 16) {
    errors.push("QR_SECRET_KEY 长度应至少为16个字符");
  }

  if (
    process.env.MONGODB_URI &&
    !process.env.MONGODB_URI.startsWith("mongodb://") &&
    !process.env.MONGODB_URI.startsWith("mongodb+srv://")
  ) {
    errors.push(
      "MONGODB_URI 格式不正确，应以 mongodb:// 或 mongodb+srv:// 开头"
    );
  }

  if (
    process.env.REDIS_URL &&
    !process.env.REDIS_URL.startsWith("redis://") &&
    !process.env.REDIS_URL.startsWith("rediss://")
  ) {
    errors.push("REDIS_URL 格式不正确，应以 redis:// 或 rediss:// 开头");
  }

  if (
    process.env.API_BASE_URL &&
    !process.env.API_BASE_URL.startsWith("http")
  ) {
    errors.push("API_BASE_URL 格式不正确，应以 http:// 或 https:// 开头");
  }

  if (
    process.env.FRONTEND_URL &&
    !process.env.FRONTEND_URL.startsWith("http")
  ) {
    errors.push("FRONTEND_URL 格式不正确，应以 http:// 或 https:// 开头");
  }

  // 验证端口号
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push("PORT 必须是1-65535之间的有效数字");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
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
    PORT: parseInt(process.env.PORT || "8080"),
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    MONGODB_URI: process.env.MONGODB_URI,
    REDIS_URL: process.env.REDIS_URL,
    API_BASE_URL: process.env.API_BASE_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    ALIPAY_APP_ID: process.env.ALIPAY_APP_ID,
    ALIPAY_PRIVATE_KEY: process.env.ALIPAY_PRIVATE_KEY,
    ALIPAY_PUBLIC_KEY: process.env.ALIPAY_PUBLIC_KEY,
  };
};

// 打印配置摘要（隐藏敏感信息）
export const printConfigSummary = (): void => {
  const config = getConfig();

  console.log("\n📋 配置摘要:");
  console.log(`   环境: ${config.NODE_ENV}`);
  console.log(`   端口: ${config.PORT}`);
  console.log(
    `   数据库: ${
      config.MONGODB_URI?.replace(/\/\/.*@/, "//***:***@") || "未配置"
    }`
  );
  console.log(
    `   缓存: ${config.REDIS_URL?.replace(/\/\/.*@/, "//***:***@") || "未配置"}`
  );
  console.log(`   API地址: ${config.API_BASE_URL || "未配置"}`);
  console.log(`   前端地址: ${config.FRONTEND_URL || "未配置"}`);
  console.log(`   JWT有效期: ${config.JWT_EXPIRES_IN}`);
  console.log(`   支付宝配置: ${config.ALIPAY_APP_ID ? "已配置" : "未配置"}`);
  console.log("");
};
