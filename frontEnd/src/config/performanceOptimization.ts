/**
 * 前端性能优化配置
 */

import { performanceConfig, imageOptimizationConfig, cacheConfig, performanceMonitorConfig } from '../../config/performance';
import { ResourceType, PreloadPriority } from '../utils/resourcePreloader';

/**
 * 关键资源预加载配置
 */
export const criticalResourcesConfig = {
  // 关键CSS文件
  styles: [
    '/assets/css/critical.css',
    '/assets/css/components.css'
  ],
  
  // 关键字体文件
  fonts: [
    '/assets/fonts/PingFang-SC-Regular.woff2',
    '/assets/fonts/PingFang-SC-Medium.woff2'
  ],
  
  // 关键图片资源
  images: [
    '/assets/images/logo.svg',
    '/assets/images/charging-icon.svg',
    '/assets/images/station-placeholder.svg'
  ],
  
  // 关键脚本文件
  scripts: [
    '/assets/js/polyfills.js',
    '/assets/js/vendor.js'
  ]
};

/**
 * 路由预加载策略配置
 */
export const routePreloadConfig = {
  // 立即预加载的路由（高优先级）
  immediate: [
    '/pages/index/index', // 首页
    '/pages/charging/index', // 充电页面
    '/pages/station/list' // 充电站列表
  ],
  
  // 空闲时预加载的路由（中优先级）
  idle: [
    '/pages/user/profile', // 用户资料
    '/pages/order/history', // 订单历史
    '/pages/payment/index' // 支付页面
  ],
  
  // 按需预加载的路由（低优先级）
  onDemand: [
    '/pages/help/index', // 帮助页面
    '/pages/feedback/index', // 反馈页面
    '/pages/about/index' // 关于页面
  ]
};

/**
 * 组件懒加载配置
 */
export const componentLazyLoadConfig = {
  // 启用懒加载的组件
  enabled: [
    'StationList',
    'ChargingMonitor',
    'OrderHistory',
    'PaymentForm',
    'UserProfile'
  ],
  
  // 懒加载阈值配置
  threshold: {
    default: 0.1, // 默认10%可见时加载
    images: 0.05, // 图片5%可见时加载
    components: 0.2 // 组件20%可见时加载
  },
  
  // 根边距配置
  rootMargin: {
    default: '50px',
    images: '100px', // 图片提前100px加载
    components: '200px' // 组件提前200px加载
  }
};

/**
 * 图片优化配置
 */
export const imageOptimizationSettings = {
  ...imageOptimizationConfig,
  
  // 图片压缩质量
  quality: {
    high: 0.9, // 高质量图片
    medium: 0.7, // 中等质量图片
    low: 0.5 // 低质量图片
  },
  
  // 响应式图片断点
  breakpoints: {
    mobile: 375,
    tablet: 768,
    desktop: 1200
  },
  
  // 图片格式优先级
  formatPriority: ['webp', 'avif', 'jpeg', 'png'],
  
  // 预加载策略
  preloadStrategy: {
    critical: 3, // 预加载前3张关键图片
    viewport: 5, // 预加载视口内前5张图片
    total: 10 // 总共预加载10张图片
  }
};

/**
 * 缓存策略配置
 */
export const cacheStrategyConfig = {
  ...cacheConfig,
  
  // 静态资源缓存时间（秒）
  staticAssets: {
    images: 7 * 24 * 60 * 60, // 7天
    fonts: 30 * 24 * 60 * 60, // 30天
    scripts: 7 * 24 * 60 * 60, // 7天
    styles: 7 * 24 * 60 * 60 // 7天
  },
  
  // API缓存时间（秒）
  apiCache: {
    stations: 5 * 60, // 充电站数据缓存5分钟
    user: 10 * 60, // 用户数据缓存10分钟
    orders: 2 * 60, // 订单数据缓存2分钟
    realtime: 30 // 实时数据缓存30秒
  },
  
  // 离线缓存策略
  offline: {
    enabled: true,
    fallbackPages: ['/pages/offline/index'],
    cacheFirst: ['images', 'fonts', 'styles'],
    networkFirst: ['api', 'data']
  }
};

/**
 * 性能监控配置
 */
export const performanceMonitorSettings = {
  ...performanceMonitorConfig,
  
  // 监控指标阈值
  thresholds: {
    // Core Web Vitals
    fcp: 1800, // First Contentful Paint < 1.8s
    lcp: 2500, // Largest Contentful Paint < 2.5s
    fid: 100, // First Input Delay < 100ms
    cls: 0.1, // Cumulative Layout Shift < 0.1
    ttfb: 800, // Time to First Byte < 800ms
    
    // 自定义指标
    pageLoad: 3000, // 页面加载时间 < 3s
    apiResponse: 1000, // API响应时间 < 1s
    memoryUsage: 50 * 1024 * 1024, // 内存使用 < 50MB
    bundleSize: 500 * 1024 // 包大小 < 500KB
  },
  
  // 采样率配置
  sampling: {
    production: 0.1, // 生产环境10%采样
    development: 1.0, // 开发环境100%采样
    testing: 0.5 // 测试环境50%采样
  },
  
  // 上报配置
  reporting: {
    endpoint: '/api/performance/report',
    batchSize: 10, // 批量上报大小
    interval: 30000, // 上报间隔30秒
    retryCount: 3 // 重试次数
  }
};

/**
 * 代码分割配置
 */
export const codeSplittingConfig = {
  // 分包策略
  chunks: {
    vendor: {
      test: /[\\/]node_modules[\\/]/,
      name: 'vendor',
      priority: 10,
      reuseExistingChunk: true
    },
    common: {
      name: 'common',
      minChunks: 2,
      priority: 5,
      reuseExistingChunk: true
    },
    pages: {
      test: /[\\/]src[\\/]pages[\\/]/,
      name: 'pages',
      priority: 3
    }
  },
  
  // 预加载配置
  preload: {
    enabled: true,
    crossOrigin: 'anonymous',
    as: {
      script: 'script',
      style: 'style',
      font: 'font'
    }
  },
  
  // 动态导入配置
  dynamicImport: {
    retryCount: 3,
    retryDelay: 1000,
    timeout: 10000,
    fallback: '/pages/error/chunk-load-error'
  }
};

/**
 * 网络优化配置
 */
export const networkOptimizationConfig = {
  // HTTP/2 Server Push 资源
  serverPush: [
    '/assets/css/critical.css',
    '/assets/js/vendor.js',
    '/assets/fonts/PingFang-SC-Regular.woff2'
  ],
  
  // 资源提示
  resourceHints: {
    preconnect: [
      'https://api.smartcharging.com',
      'https://cdn.smartcharging.com'
    ],
    dnsPrefetch: [
      'https://analytics.smartcharging.com',
      'https://maps.googleapis.com'
    ],
    prefetch: [
      '/api/stations/nearby',
      '/api/user/profile'
    ]
  },
  
  // 请求优化
  request: {
    timeout: 10000, // 请求超时10秒
    retryCount: 3, // 重试3次
    retryDelay: 1000, // 重试延迟1秒
    concurrent: 6, // 最大并发请求数
    compression: true // 启用压缩
  }
};

/**
 * 移动端优化配置
 */
export const mobileOptimizationConfig = {
  // 触摸优化
  touch: {
    fastClick: true, // 启用快速点击
    touchAction: 'manipulation', // 触摸操作优化
    tapHighlight: 'transparent' // 点击高亮透明
  },
  
  // 视口优化
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover'
  },
  
  // 滚动优化
  scroll: {
    momentum: true, // 启用惯性滚动
    bounce: false, // 禁用弹性滚动
    overscroll: 'none' // 禁用过度滚动
  },
  
  // 键盘优化
  keyboard: {
    resize: 'none', // 键盘弹出时不调整视口
    scrollIntoView: true // 自动滚动到输入框
  }
};

/**
 * 性能优化总配置
 */
export const performanceOptimizationConfig = {
  criticalResources: criticalResourcesConfig,
  routePreload: routePreloadConfig,
  componentLazyLoad: componentLazyLoadConfig,
  imageOptimization: imageOptimizationSettings,
  cacheStrategy: cacheStrategyConfig,
  performanceMonitor: performanceMonitorSettings,
  codeSplitting: codeSplittingConfig,
  networkOptimization: networkOptimizationConfig,
  mobileOptimization: mobileOptimizationConfig
};

export default performanceOptimizationConfig;