/**
 * 滑块验证配置
 */
export interface SliderVerifyConfig {
  // 基本配置
  enabled: boolean;
  useThirdParty: boolean;
  
  // 验证阈值
  accuracyThreshold: number;
  minDuration: number;
  maxDuration: number;
  minTrackPoints: number;
  
  // 挑战配置
  challengeExpireTime: number;
  maxAttempts: number;
  
  // 第三方服务配置
  thirdParty: {
    provider: 'geetest' | 'tencent' | 'generic';
    apiUrl?: string;
    apiKey?: string;
    timeout: number;
    retries: number;
    fallbackToBuiltin: boolean;
  };
  
  // 安全配置
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  
  // 行为分析配置
  behaviorAnalysis: {
    enabled: boolean;
    smoothnessWeight: number;
    durationWeight: number;
    accuracyWeight: number;
    minScore: number;
  };
}

/**
 * 默认滑块验证配置
 */
export const defaultSliderVerifyConfig: SliderVerifyConfig = {
  enabled: true,
  useThirdParty: process.env.SLIDER_USE_THIRD_PARTY === 'true',
  
  accuracyThreshold: 15,
  minDuration: 300,
  maxDuration: 15000,
  minTrackPoints: 5,
  
  challengeExpireTime: 5 * 60, // 5分钟
  maxAttempts: 3,
  
  thirdParty: {
    provider: (process.env.SLIDER_THIRD_PARTY_PROVIDER as any) || 'generic',
    apiUrl: process.env.SLIDER_VERIFY_API_URL,
    apiKey: process.env.SLIDER_VERIFY_API_KEY,
    timeout: parseInt(process.env.SLIDER_THIRD_PARTY_TIMEOUT || '5000'),
    retries: parseInt(process.env.SLIDER_THIRD_PARTY_RETRIES || '2'),
    fallbackToBuiltin: process.env.SLIDER_FALLBACK_TO_BUILTIN !== 'false'
  },
  
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分钟
    maxRequests: 10 // 每15分钟最多10次验证请求
  },
  
  behaviorAnalysis: {
    enabled: true,
    smoothnessWeight: 0.4,
    durationWeight: 0.3,
    accuracyWeight: 0.3,
    minScore: 0.6
  }
};

/**
 * 获取滑块验证配置
 */
export function getSliderVerifyConfig(): SliderVerifyConfig {
  return {
    ...defaultSliderVerifyConfig,
    // 可以在这里添加动态配置逻辑
    // 例如从数据库或配置中心获取配置
  };
}

/**
 * 验证配置有效性
 */
export function validateSliderVerifyConfig(config: SliderVerifyConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证基本配置
  if (config.accuracyThreshold < 0 || config.accuracyThreshold > 100) {
    errors.push('精度阈值必须在0-100之间');
  }

  if (config.minDuration < 0 || config.minDuration > config.maxDuration) {
    errors.push('最小持续时间配置无效');
  }

  if (config.maxDuration < config.minDuration || config.maxDuration > 60000) {
    errors.push('最大持续时间配置无效');
  }

  if (config.minTrackPoints < 2) {
    errors.push('最小轨迹点数不能少于2');
  }

  if (config.challengeExpireTime < 60 || config.challengeExpireTime > 3600) {
    errors.push('挑战过期时间必须在60-3600秒之间');
  }

  if (config.maxAttempts < 1 || config.maxAttempts > 10) {
    errors.push('最大尝试次数必须在1-10之间');
  }

  // 验证第三方配置
  if (config.useThirdParty) {
    if (!config.thirdParty.apiUrl) {
      errors.push('启用第三方验证时必须提供API URL');
    }

    if (!config.thirdParty.apiKey) {
      errors.push('启用第三方验证时必须提供API Key');
    }

    if (config.thirdParty.timeout < 1000 || config.thirdParty.timeout > 30000) {
      errors.push('第三方服务超时时间必须在1000-30000ms之间');
    }

    if (config.thirdParty.retries < 0 || config.thirdParty.retries > 5) {
      errors.push('第三方服务重试次数必须在0-5之间');
    }
  }

  // 验证限流配置
  if (config.rateLimit.windowMs < 60000 || config.rateLimit.windowMs > 3600000) {
    errors.push('限流时间窗口必须在60000-3600000ms之间');
  }

  if (config.rateLimit.maxRequests < 1 || config.rateLimit.maxRequests > 100) {
    errors.push('限流最大请求数必须在1-100之间');
  }

  // 验证行为分析配置
  if (config.behaviorAnalysis.enabled) {
    const totalWeight = config.behaviorAnalysis.smoothnessWeight + 
                       config.behaviorAnalysis.durationWeight + 
                       config.behaviorAnalysis.accuracyWeight;
    
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      errors.push('行为分析权重总和必须等于1.0');
    }

    if (config.behaviorAnalysis.minScore < 0 || config.behaviorAnalysis.minScore > 1) {
      errors.push('行为分析最小得分必须在0-1之间');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 滑块验证统计配置
 */
export interface SliderVerifyStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number;
  averageAccuracy: number;
  averageDuration: number;
  thirdPartyUsage: number;
  builtinUsage: number;
  lastResetTime: Date;
}

/**
 * 滑块验证错误代码
 */
export enum SliderVerifyErrorCode {
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  CHALLENGE_NOT_FOUND = 'CHALLENGE_NOT_FOUND',
  CHALLENGE_EXPIRED = 'CHALLENGE_EXPIRED',
  MAX_ATTEMPTS_EXCEEDED = 'MAX_ATTEMPTS_EXCEEDED',
  ACCURACY_TOO_LOW = 'ACCURACY_TOO_LOW',
  DURATION_INVALID = 'DURATION_INVALID',
  TRAJECTORY_INVALID = 'TRAJECTORY_INVALID',
  BEHAVIOR_SUSPICIOUS = 'BEHAVIOR_SUSPICIOUS',
  THIRD_PARTY_ERROR = 'THIRD_PARTY_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

/**
 * 滑块验证错误消息映射
 */
export const SliderVerifyErrorMessages: Record<SliderVerifyErrorCode, string> = {
  [SliderVerifyErrorCode.INVALID_PARAMETERS]: '参数格式错误',
  [SliderVerifyErrorCode.CHALLENGE_NOT_FOUND]: '验证挑战不存在',
  [SliderVerifyErrorCode.CHALLENGE_EXPIRED]: '验证挑战已过期',
  [SliderVerifyErrorCode.MAX_ATTEMPTS_EXCEEDED]: '尝试次数过多',
  [SliderVerifyErrorCode.ACCURACY_TOO_LOW]: '滑动精度不够',
  [SliderVerifyErrorCode.DURATION_INVALID]: '滑动时间异常',
  [SliderVerifyErrorCode.TRAJECTORY_INVALID]: '滑动轨迹异常',
  [SliderVerifyErrorCode.BEHAVIOR_SUSPICIOUS]: '行为模式可疑',
  [SliderVerifyErrorCode.THIRD_PARTY_ERROR]: '第三方验证服务错误',
  [SliderVerifyErrorCode.RATE_LIMIT_EXCEEDED]: '请求过于频繁',
  [SliderVerifyErrorCode.INTERNAL_ERROR]: '内部服务错误'
};

export default {
  defaultSliderVerifyConfig,
  getSliderVerifyConfig,
  validateSliderVerifyConfig,
  SliderVerifyErrorCode,
  SliderVerifyErrorMessages
};