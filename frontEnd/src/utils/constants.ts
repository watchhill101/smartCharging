// 应用常量配置

// API 基础配置
export const API_CONFIG = {
  BASE_URL: process.env.NODE_ENV === 'development'
    ? ''  // 开发环境直接使用相对路径
    : 'https://api.smartcharging.com',
  TIMEOUT: 10000,
  RETRY_COUNT: 3
}

// 存储键名
export const STORAGE_KEYS = {
  USER_TOKEN: 'user_token',
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
  DEFAULT_ZOOM: 15,
  MIN_ZOOM: 10,
  MAX_ZOOM: 18,
  SEARCH_RADIUS: 5000, // 米
  LOCATION_TIMEOUT: 10000 // 毫秒
}

// 充电配置
export const CHARGING_CONFIG = {
  MIN_CHARGING_TIME: 300, // 5分钟
  MAX_CHARGING_TIME: 28800, // 8小时
  STATUS_UPDATE_INTERVAL: 5000, // 5秒
  HEARTBEAT_INTERVAL: 30000 // 30秒
}

// 文件上传配置
export const UPLOAD_CONFIG = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  QUALITY: 0.8
}