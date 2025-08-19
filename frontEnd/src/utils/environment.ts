// 环境信息工具 - 检测和记录运行环境信息

export interface EnvironmentInfo {
  platform: string
  userAgent: string
  language: string
  timezone: string
  screenResolution: string
  isTouch: boolean
  isMobile: boolean
  taroVersion?: string
  appVersion?: string
}

/**
 * 获取环境信息
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  const info: EnvironmentInfo = {
    platform: 'unknown',
    userAgent: 'unknown',
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
    screenResolution: '0x0',
    isTouch: false,
    isMobile: false
  }

  try {
    // 检测是否在浏览器环境
    if (typeof window !== 'undefined') {
      info.platform = 'web'
      info.userAgent = navigator.userAgent || 'unknown'
      info.language = navigator.language || 'zh-CN'
      info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
      info.screenResolution = `${screen.width}x${screen.height}`
      info.isTouch = 'ontouchstart' in window
      info.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    }

    // 检测是否在小程序环境
    if (typeof wx !== 'undefined') {
      info.platform = 'weapp'
      try {
        const systemInfo = wx.getSystemInfoSync()
        info.userAgent = `${systemInfo.brand} ${systemInfo.model}`
        info.language = systemInfo.language || 'zh-CN'
        info.screenResolution = `${systemInfo.screenWidth}x${systemInfo.screenHeight}`
        info.isTouch = true
        info.isMobile = true
      } catch (error) {
        console.warn('获取小程序系统信息失败:', error)
      }
    }

    // 检测Taro版本
    if (typeof process !== 'undefined' && process.env.TARO_ENV) {
      info.platform = process.env.TARO_ENV
    }

  } catch (error) {
    console.error('获取环境信息失败:', error)
  }

  return info
}

/**
 * 记录环境信息到控制台
 */
export function logEnvironmentInfo(): void {
  const info = getEnvironmentInfo()
  
  console.group('🌍 环境信息')
  console.log('平台:', info.platform)
  console.log('用户代理:', info.userAgent)
  console.log('语言:', info.language)
  console.log('时区:', info.timezone)
  console.log('屏幕分辨率:', info.screenResolution)
  console.log('支持触摸:', info.isTouch)
  console.log('移动设备:', info.isMobile)
  
  if (info.taroVersion) {
    console.log('Taro版本:', info.taroVersion)
  }
  
  if (info.appVersion) {
    console.log('应用版本:', info.appVersion)
  }
  
  console.groupEnd()
}

/**
 * 检测是否为开发环境
 */
export function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV === 'development'
  } catch {
    return false
  }
}

/**
 * 检测是否为生产环境
 */
export function isProduction(): boolean {
  try {
    return process.env.NODE_ENV === 'production'
  } catch {
    return true // 默认为生产环境
  }
}

/**
 * 检测是否为移动端
 */
export function isMobileDevice(): boolean {
  const info = getEnvironmentInfo()
  return info.isMobile
}

/**
 * 检测是否支持触摸
 */
export function isTouchDevice(): boolean {
  const info = getEnvironmentInfo()
  return info.isTouch
}

/**
 * 获取平台类型
 */
export function getPlatform(): string {
  const info = getEnvironmentInfo()
  return info.platform
}

/**
 * 检测是否为微信小程序环境
 */
export function isWeapp(): boolean {
  return getPlatform() === 'weapp'
}

/**
 * 检测是否为H5环境
 */
export function isH5(): boolean {
  return getPlatform() === 'h5' || getPlatform() === 'web'
}

/**
 * 性能监控 - 记录页面加载时间
 */
export function recordPageLoadTime(pageName: string): void {
  try {
    if (typeof performance !== 'undefined' && performance.now) {
      const loadTime = performance.now()
      console.log(`📊 页面 ${pageName} 加载时间: ${loadTime.toFixed(2)}ms`)
    }
  } catch (error) {
    console.warn('记录页面加载时间失败:', error)
  }
}

/**
 * 全局错误处理
 */
export function setupGlobalErrorHandling(): void {
  try {
    // 处理未捕获的Promise拒绝
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        console.error('未处理的Promise拒绝:', event.reason)
        event.preventDefault()
      })

      // 处理全局错误
      window.addEventListener('error', (event) => {
        console.error('全局错误:', event.error)
      })
    }
  } catch (error) {
    console.warn('设置全局错误处理失败:', error)
  }
}

// 自动记录环境信息（仅在开发环境）
if (isDevelopment()) {
  setTimeout(() => {
    logEnvironmentInfo()
  }, 100)
}
