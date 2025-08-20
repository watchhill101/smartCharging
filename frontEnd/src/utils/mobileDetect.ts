/**
 * 移动端设备检测和兼容性工具
 */

export interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isIOS: boolean
  isAndroid: boolean
  browser: string
  version: string
  screenWidth: number
  screenHeight: number
  pixelRatio: number
  touchSupported: boolean
  orientation: 'portrait' | 'landscape'
}

export class MobileDetect {
  private static userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''

  /**
   * 获取设备信息
   */
  static getDeviceInfo(): DeviceInfo {
    const ua = this.userAgent
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua)
    const isIOS = /iPad|iPhone|iPod/.test(ua)
    const isAndroid = /Android/i.test(ua)
    
    return {
      isMobile,
      isTablet,
      isDesktop: !isMobile,
      isIOS,
      isAndroid,
      browser: this.getBrowser(),
      version: this.getBrowserVersion(),
      screenWidth: typeof window !== 'undefined' ? window.screen.width : 0,
      screenHeight: typeof window !== 'undefined' ? window.screen.height : 0,
      pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      touchSupported: typeof window !== 'undefined' ? 'ontouchstart' in window : false,
      orientation: this.getOrientation()
    }
  }

  /**
   * 获取浏览器类型
   */
  private static getBrowser(): string {
    const ua = this.userAgent
    if (ua.includes('Chrome')) return 'Chrome'
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
    if (ua.includes('Edge')) return 'Edge'
    if (ua.includes('Opera')) return 'Opera'
    return 'Unknown'
  }

  /**
   * 获取浏览器版本
   */
  private static getBrowserVersion(): string {
    const ua = this.userAgent
    const match = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/i)
    return match ? match[2] : 'Unknown'
  }

  /**
   * 获取屏幕方向
   */
  private static getOrientation(): 'portrait' | 'landscape' {
    if (typeof window === 'undefined') return 'portrait'
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  }

  /**
   * 检查是否支持特定功能
   */
  static checkFeatureSupport() {
    if (typeof window === 'undefined') {
      return {
        localStorage: false,
        sessionStorage: false,
        indexedDB: false,
        webWorkers: false,
        serviceWorker: false,
        pushNotifications: false,
        geolocation: false,
        camera: false,
        vibration: false,
        fullscreen: false,
        webGL: false,
        canvas: false
      }
    }

    return {
      localStorage: 'localStorage' in window,
      sessionStorage: 'sessionStorage' in window,
      indexedDB: 'indexedDB' in window,
      webWorkers: 'Worker' in window,
      serviceWorker: 'serviceWorker' in navigator,
      pushNotifications: 'PushManager' in window,
      geolocation: 'geolocation' in navigator,
      camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
      vibration: 'vibrate' in navigator,
      fullscreen: 'requestFullscreen' in document.documentElement,
      webGL: this.checkWebGLSupport(),
      canvas: 'getContext' in document.createElement('canvas')
    }
  }

  /**
   * 检查WebGL支持
   */
  private static checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas')
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    } catch (e) {
      return false
    }
  }

  /**
   * 设置移动端viewport
   */
  static setupMobileViewport() {
    if (typeof document === 'undefined') return

    let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
    
    if (!viewport) {
      viewport = document.createElement('meta')
      viewport.name = 'viewport'
      document.head.appendChild(viewport)
    }

    const deviceInfo = this.getDeviceInfo()
    
    if (deviceInfo.isMobile) {
      // 移动端优化viewport
      viewport.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'
    } else {
      // 桌面端viewport
      viewport.content = 'width=device-width,initial-scale=1'
    }
  }

  /**
   * 优化移动端触摸体验
   */
  static optimizeTouchExperience() {
    if (typeof document === 'undefined') return

    const deviceInfo = this.getDeviceInfo()
    
    if (deviceInfo.touchSupported) {
      // 禁用双击缩放
      document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
          e.preventDefault()
        }
      }, { passive: false })

      // 优化滚动性能
      document.body.style.touchAction = 'pan-y'
      document.body.style.webkitOverflowScrolling = 'touch'
      
      // 移除点击延迟
      document.body.style.touchAction = 'manipulation'
    }
  }

  /**
   * 监听屏幕方向变化
   */
  static onOrientationChange(callback: (orientation: 'portrait' | 'landscape') => void) {
    if (typeof window === 'undefined') return

    const handleOrientationChange = () => {
      setTimeout(() => {
        callback(this.getOrientation())
      }, 100) // 延迟获取正确的尺寸
    }

    if ('orientation' in screen) {
      screen.orientation.addEventListener('change', handleOrientationChange)
    } else {
      window.addEventListener('orientationchange', handleOrientationChange)
    }

    // 也监听resize事件作为备用
    window.addEventListener('resize', handleOrientationChange)
  }

  /**
   * 获取安全区域信息
   */
  static getSafeAreaInsets() {
    if (typeof window === 'undefined') {
      return { top: 0, right: 0, bottom: 0, left: 0 }
    }

    const computedStyle = getComputedStyle(document.documentElement)
    
    return {
      top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
      right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
      bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
      left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0')
    }
  }

  /**
   * 设置CSS自定义属性
   */
  static setupCSSVariables() {
    if (typeof document === 'undefined') return

    const deviceInfo = this.getDeviceInfo()
    const root = document.documentElement

    // 设备信息相关变量
    root.style.setProperty('--device-width', `${deviceInfo.screenWidth}px`)
    root.style.setProperty('--device-height', `${deviceInfo.screenHeight}px`)
    root.style.setProperty('--pixel-ratio', deviceInfo.pixelRatio.toString())
    root.style.setProperty('--is-mobile', deviceInfo.isMobile ? '1' : '0')
    root.style.setProperty('--is-ios', deviceInfo.isIOS ? '1' : '0')
    root.style.setProperty('--is-android', deviceInfo.isAndroid ? '1' : '0')

    // 如果不支持env()，设置fallback值
    if (!CSS.supports('padding-top', 'env(safe-area-inset-top)')) {
      root.style.setProperty('--safe-area-inset-top', deviceInfo.isIOS ? '44px' : '24px')
      root.style.setProperty('--safe-area-inset-bottom', deviceInfo.isIOS ? '34px' : '0px')
      root.style.setProperty('--safe-area-inset-left', '0px')
      root.style.setProperty('--safe-area-inset-right', '0px')
    }
  }

  /**
   * 初始化移动端优化
   */
  static init() {
    const deviceInfo = this.getDeviceInfo()
    const features = this.checkFeatureSupport()

    // 设备信息检测完成

    // 设置viewport
    this.setupMobileViewport()
    
    // 设置CSS变量
    this.setupCSSVariables()
    
    // 优化触摸体验
    this.optimizeTouchExperience()

    // 添加设备类名
    if (typeof document !== 'undefined') {
      document.body.classList.add(
        deviceInfo.isMobile ? 'is-mobile' : 'is-desktop',
        deviceInfo.isIOS ? 'is-ios' : deviceInfo.isAndroid ? 'is-android' : 'is-other',
        deviceInfo.isTablet ? 'is-tablet' : 'is-phone'
      )
    }

    return { deviceInfo, features }
  }

  /**
   * 检查网络状态
   */
  static getNetworkInfo() {
    if (typeof navigator === 'undefined') return null

    const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection

    if (connection) {
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      }
    }

    return null
  }

  /**
   * 触觉反馈
   */
  static vibrate(pattern: number | number[] = 200) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }

  /**
   * 分享功能
   */
  static async share(shareData: ShareData) {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share(shareData)
        return true
      } catch (error) {
        // 分享取消或失败
        return false
      }
    }
    return false
  }
}

export default MobileDetect
