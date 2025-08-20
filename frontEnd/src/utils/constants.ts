// 应用常量配置

// 时间常量 (毫秒)
export const TIME_CONSTANTS = {
  ONE_SECOND: 1000,
  TWO_SECONDS: 2000,
  THREE_SECONDS: 3000,
  FIVE_SECONDS: 5000,
  TEN_SECONDS: 10000,
  FIFTEEN_SECONDS: 15000,
  TWENTY_SECONDS: 20000,
  THIRTY_SECONDS: 30000,
  ONE_MINUTE: 60000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  TWO_DAYS: 48 * 60 * 60 * 1000
}

// 距离常量 (米)
export const DISTANCE_CONSTANTS = {
  ONE_KM: 1000,
  TWO_KM: 2000,
  THREE_KM: 3000,
  FIVE_KM: 5000,
  TEN_KM: 10000,
  FIFTEEN_KM: 15000,
  TWENTY_KM: 20000
}

// UI层级常量
export const Z_INDEX_CONSTANTS = {
  MODAL: 1000,
  TOAST: 10000,
  LOADING: 9999
}

// 文件大小常量 (字节)
export const FILE_SIZE_CONSTANTS = {
  MIN_AUDIO_SIZE: 5000, // 5KB
  MAX_IMAGE_SIZE: 10485760, // 10MB
  MAX_FILE_SIZE: 52428800 // 50MB
}

// WebSocket常量
export const WEBSOCKET_CONSTANTS = {
  RECONNECT_INTERVAL: 3000,
  HEARTBEAT_INTERVAL: 30000,
  CLOSE_CODE_NORMAL: 1000,
  MAX_RECONNECT_ATTEMPTS: 5
}

// AI模型常量
export const AI_MODEL_CONSTANTS = {
  DEFAULT_MAX_TOKENS: 800,
  BACKUP_MAX_TOKENS: 600,
  FALLBACK_MAX_TOKENS: 500,
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_TIMEOUT: 30000,
  BACKUP_TIMEOUT: 25000,
  FALLBACK_TIMEOUT: 20000
}

// API 基础配置
export const API_CONFIG = {
  BASE_URL: process.env.NODE_ENV === 'development'
    ? (process.env.TARO_APP_API_BASE_URL_DEV || 'http://localhost:8080/api')  // 修复：设置正确的开发环境URL
    : (process.env.TARO_APP_API_BASE_URL || 'https://api.smartcharging.com/api'),
  TIMEOUT: parseInt(process.env.TARO_APP_API_TIMEOUT || '10000'),
  RETRY_COUNT: parseInt(process.env.TARO_APP_API_RETRY_COUNT || '3'),
  FETCH_TIMEOUT: parseInt(process.env.TARO_APP_FETCH_TIMEOUT || '10000'),
  WS_URL: process.env.NODE_ENV === 'development'
    ? (process.env.TARO_APP_WS_URL_DEV || 'ws://localhost:8080/ws')
    : (process.env.TARO_APP_WS_URL || 'wss://api.smartcharging.com/ws')
}

// 存储键名
export const STORAGE_KEYS = {
  USER_TOKEN: 'user_token',
  USER_REFRESH_TOKEN: 'user_refresh_token',
  TOKEN_EXPIRES_AT: 'token_expires_at',
  USER_INFO: 'user_info',
  LOCATION_PERMISSION: 'location_permission',
  THEME_MODE: 'theme_mode',
  REMEMBERED_USERNAME: 'remembered_username'
}

// 充电桩状态
export const CHARGER_STATUS = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline'
} as const

// 充电桩类型
export const CHARGER_TYPE = {
  FAST: 'fast',
  SLOW: 'slow'
} as const

// 订单状态
export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
} as const

// 充电会话状态
export const CHARGING_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ERROR: 'error'
} as const

// 支付方式
export const PAYMENT_METHOD = {
  BALANCE: 'balance',
  ALIPAY: 'alipay'
} as const

// 验证等级
export const VERIFICATION_LEVEL = {
  BASIC: 'basic'
} as const

// 错误码
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  QR_CODE_INVALID: 'QR_CODE_INVALID',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  CHARGING_FAILED: 'CHARGING_FAILED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED'
} as const

// 页面路径
export const PAGE_PATHS = {
  INDEX: '/pages/index/index',
  MAP: '/pages/map/index',
  CHARGING: '/pages/charging/index',
  PROFILE: '/pages/profile/index'
} as const

// 地图配置
export const MAP_CONFIG = {
  DEFAULT_ZOOM: parseInt(process.env.TARO_APP_MAP_DEFAULT_ZOOM || '15'),
  MIN_ZOOM: parseInt(process.env.TARO_APP_MAP_MIN_ZOOM || '10'),
  MAX_ZOOM: parseInt(process.env.TARO_APP_MAP_MAX_ZOOM || '18'),
  SEARCH_RADIUS: parseInt(process.env.TARO_APP_MAP_SEARCH_RADIUS || '5000'), // 米
  LOCATION_TIMEOUT: parseInt(process.env.TARO_APP_MAP_LOCATION_TIMEOUT || '10000') // 毫秒
}

// 充电配置
export const CHARGING_CONFIG = {
  MIN_CHARGING_TIME: parseInt(process.env.TARO_APP_CHARGING_MIN_TIME || '300'), // 5分钟
  MAX_CHARGING_TIME: parseInt(process.env.TARO_APP_CHARGING_MAX_TIME || '28800'), // 8小时
  STATUS_UPDATE_INTERVAL: parseInt(process.env.TARO_APP_CHARGING_STATUS_INTERVAL || '5000'), // 5秒
  HEARTBEAT_INTERVAL: parseInt(process.env.TARO_APP_CHARGING_HEARTBEAT_INTERVAL || '30000') // 30秒
}

// 文件上传配置
export const UPLOAD_CONFIG = {
  MAX_SIZE: parseInt(process.env.TARO_APP_UPLOAD_MAX_SIZE || '10485760'), // 10MB
  ALLOWED_TYPES: (process.env.TARO_APP_UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/gif').split(','),
  QUALITY: parseFloat(process.env.TARO_APP_UPLOAD_QUALITY || '0.8')
}

// 高德地图API配置
export const AMAP_CONFIG = {
  // 高德地图API密钥
  // 申请地址：https://lbs.amap.com/dev/key/app
  API_KEY: process.env.TARO_APP_AMAP_API_KEY || (() => {
    throw new Error('高德地图API密钥未配置，请设置环境变量 TARO_APP_AMAP_API_KEY');
  })()
}