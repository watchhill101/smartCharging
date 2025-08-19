import { AlipaySdk } from "alipay-sdk";

// 验证必要的环境变量
const requiredEnvVars = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`警告: 缺少支付宝配置环境变量: ${missingVars.join(', ')}`);
  console.warn('将使用默认的沙箱配置，仅用于开发测试');
}

const alipayConfig = {
  appId: process.env.ALIPAY_APP_ID || "9021000151623353",
  privateKey: process.env.ALIPAY_PRIVATE_KEY || 
    "MIIEpQIBAAKCAQEAvCMDi9tplsT637Dzh6ZgfkkVcP6ZP3MdQPaMBqVjgXBgVS0HDIjHhUcq4tQUCZvVMxNSZLcG45KJRHWIhiwa6PQDc0xFOk9dVn+XebdlMRrwHLFkZTAvpLpz1+gaOkJ47eQb9yn/cX9J4THIlz9y33oAwb7Bfl0biOeaca06sdQvShZgtRcK32FmiSWN0gARsvzjmhY+dO3KTuJBxAL/pR0wUmwGdf7M/Y4QTQzEAvo7/+CUvSMJvvWoyEKNlUzrtQ2zrLda0lykotOsoCsvtUXHFflUaKPUYdwQM5xTX/m2KpzHwy/xyEQwOl3QnP550H3TZG/aemnFQPL5kCBNXQIDAQABAoIBAGPhTtusI7V4ZBvnzJJioO3KjQiNEfzed1Rqz9Ijcd1hNLNjkU91Oj+mlb0QjIbBZYGVK3Puu0iMHjXrFAzvU2YDTeWjQ0l+ovXuDRQAakeUno8NGliiKVkR57hjL7FoYt0g8jvY3xV5V1an4G9zrt+33Lj/NaiJc7nOA2+AYR3Qt05G5KclsKnfgSOT6tTktEJUmtEvhMVtHkJ02b15EW/JPzy+LyMDjaCcZjrTxo/Nk+yPSEXgLBsP/KguhsW1EsnG+2cDq+K2Sh5GihAzEnFHEQTtdOOqtHuSBw0q61gd2mENqgFjOrxYNuI3hKOi9Co1eMTMyTcR7pgsLqLK5wECgYEA78ogf6FTnhEVSDxlKQzx7L/8bpKLY58KpNARzlQF/DFtevacuKgqxIgi3POYYbyrt0e4C7slKBR1RWZucIq8AN62OZw8L1+E3xb4ruDvFnHoqoXIHU765FrUC8MJvH/nCoE6DRT3bBmk5A7ijMS8LTcK/RydNutprAJPRXGW4B0CgYEAyNr3uBvRUWTWM79IXOBP3PPv7jEiMqES5L/1nR31Jg6E13oRvun/Bv5GD0AZf1kxcyP8Q7fbzODlpfnzJEHvRwn6/sqy/n1XVcq3NSzdcXViuxKKINWpfuY0VCy/pQ+Ur8Z+KJ7VeljNHOZwtwmRDR13BhbtFw/7SB7XN4tmHkECgYEA5sy+ixpUyYfX3DeFhwWWtjH0XtleoPyr2gcLnHTzbdKFdh14q6PxxkjihZlRyoE3Jqo5U9FF6lYGqk31bw2Z95xl+P2QUGi4E6KgqnKGrivlrnwmKU+j3bgu8UNBU9YoI8xOe9j6bWohdAF/vc5+8WZRhV7NU9czVwTCGC1E82ECgYEAn52reKramBVLSEo9hllX/h340NBI/fUVH6YQ2PBCriChnt9KFO69lWAiauIkoRhPfNHfGi2VReZ/eXv9phWjwk+DIFITFryi1/HF0EM8I3sGn+Wm0VsaXFcyxKXfEpwkK9/QyBUZTyYcslfKwRqgI80DllpHxakUpwajP2fPGkECgYEAlW+wsWJ9KTA4IK/rCMKbTBphFrzNy3Wh7nqQXk6zyx7T+60FZ2XIQGD16lxQXvi2yK75Pfal2qS1H2krTo9THBiP0aeZqgZJY/zrJII3ZXx+USScLagemEFEdJp7ThOtAHNeeUKmGKhqXkiP5fkTrnO5KEoYhUksFHwhc0Z1NF4=",
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY ||
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAhZHbI6fgQnOHUxUbjq42bf6eNUHANx0Hl1p092OMzPARvMwAX1HzNnuZiYQKRMx86kL90+6MNVPG+vMqt2uNBXQB2BMZEkIX0129MV5X+rR7rJS66bEcTjmEA23SWVmquY8I/47TkxCA3d/28+CpkOOwFdelLRmxo68n7h3acnm2pZW3U4oXLYVhzl/6OOIdyWgAp7V5r4rDumisxe0v05pwwilo8/nYikOgNvT4V5cyOgauLnYWil/tTKQNcB9kKtcDKSZyLTyiwjrvAInCwbUd7F2Ont4vF+qVwffl6pC1kSLMM9P1gArQHhulhnayxd1hIZalB5ML1E771AeMmwIDAQAB",
  // 沙箱环境网关地址
  gateway: process.env.NODE_ENV === "production"
    ? "https://openapi.alipay.com/gateway.do"  // 生产环境
    : "https://openapi-sandbox.dl.alipaydev.com/gateway.do", // 沙箱环境
  // 签名类型
  signType: 'RSA2' as const,
  // 字符编码
  charset: 'utf-8' as const,
  // 版本号
  version: '1.0' as const,
  // 返回格式
  format: 'json' as const,
  // 超时时间
  timeout: 30000
};

// 创建支付宝SDK实例
export const alipaySdk = new AlipaySdk(alipayConfig);

// 验证SDK配置
try {
  // 测试SDK配置是否正确
  console.log('支付宝SDK配置完成:', {
    appId: alipayConfig.appId,
    gateway: alipayConfig.gateway,
    environment: process.env.NODE_ENV || 'development'
  });
} catch (error) {
  console.error('支付宝SDK配置错误:', error);
}

/**
 * 生成订单号
 * @param type 订单类型
 * @param userId 用户ID
 * @returns 唯一订单号
 */
export const generateOrderNo = (
  type: "CHARGE" | "RECHARGE",
  userId: string
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const userSuffix = userId.slice(-4);
  return `${type}_${timestamp}_${userSuffix}_${random}`;
};

/**
 * 验证订单号格式
 * @param orderId 订单号
 * @returns 是否有效
 */
export const validateOrderNo = (orderId: string): boolean => {
  const pattern = /^(CHARGE|RECHARGE)_\d{13}_[A-Z0-9]{4}_[A-Z0-9]{4}$/;
  return pattern.test(orderId);
};

/**
 * 解析订单号信息
 * @param orderId 订单号
 * @returns 订单信息
 */
export const parseOrderNo = (orderId: string): {
  type: string;
  timestamp: number;
  userSuffix: string;
  random: string;
} | null => {
  if (!validateOrderNo(orderId)) {
    return null;
  }

  const parts = orderId.split('_');
  return {
    type: parts[0],
    timestamp: parseInt(parts[1]),
    userSuffix: parts[2],
    random: parts[3]
  };
};

/**
 * 支付宝沙箱环境配置常量
 */
export const ALIPAY_SANDBOX_CONFIG = {
  // 沙箱应用信息
  SANDBOX_APP_ID: "9021000151623353",
  // 沙箱网关
  SANDBOX_GATEWAY: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
  // 支持的支付产品
  SUPPORTED_PRODUCTS: {
    WEB_PAY: "FAST_INSTANT_TRADE_PAY",      // 电脑网站支付
    WAP_PAY: "QUICK_WAP_WAY",               // 手机网站支付
    APP_PAY: "QUICK_MSECURITY_PAY"          // APP支付
  },
  // 订单超时时间配置
  TIMEOUT_EXPRESS: {
    DEFAULT: "30m",    // 默认30分钟
    RECHARGE: "15m",   // 充值15分钟
    CHARGING: "2h"     // 充电支付2小时
  }
};

/**
 * 获取支付产品码
 * @param paymentType 支付类型
 * @returns 产品码
 */
export const getProductCode = (paymentType: 'web' | 'wap' | 'app' = 'web'): string => {
  switch (paymentType) {
    case 'web':
      return ALIPAY_SANDBOX_CONFIG.SUPPORTED_PRODUCTS.WEB_PAY;
    case 'wap':
      return ALIPAY_SANDBOX_CONFIG.SUPPORTED_PRODUCTS.WAP_PAY;
    case 'app':
      return ALIPAY_SANDBOX_CONFIG.SUPPORTED_PRODUCTS.APP_PAY;
    default:
      return ALIPAY_SANDBOX_CONFIG.SUPPORTED_PRODUCTS.WEB_PAY;
  }
};

/**
 * 获取订单超时时间
 * @param orderType 订单类型
 * @returns 超时时间字符串
 */
export const getTimeoutExpress = (orderType: 'charging' | 'recharge'): string => {
  return orderType === 'charging' 
    ? ALIPAY_SANDBOX_CONFIG.TIMEOUT_EXPRESS.CHARGING
    : ALIPAY_SANDBOX_CONFIG.TIMEOUT_EXPRESS.RECHARGE;
};
