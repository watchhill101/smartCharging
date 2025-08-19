// Taro API 安全包装器
import Taro from '@tarojs/taro'
// 移除循环导入

// 检测环境
const isH5 = process.env.TARO_ENV === 'h5'
const isBrowser = typeof window !== 'undefined'

// 安全的API调用包装器
export const TaroSafe = {
  // 存储相关API
  getStorageSync: (key: string): any => {
    try {
      if (isH5 || isBrowser) {
        const value = localStorage.getItem(key)
        return value ? JSON.parse(value) : ''
      }
      if (typeof Taro.getStorageSync === 'function') {
        return TaroSafe.getStorageSync(key)
      }
      return ''
    } catch (error) {
      console.warn(`getStorageSync(${key}) 失败:`, error)
      return ''
    }
  },

  setStorageSync: (key: string, data: any): void => {
    try {
      if (isH5 || isBrowser) {
        localStorage.setItem(key, JSON.stringify(data))
        return
      }
      if (typeof Taro.setStorageSync === 'function') {
        TaroSafe.setStorageSync(key, data)
        return
      }
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.warn(`setStorageSync(${key}) 失败:`, error)
    }
  },

  removeStorageSync: (key: string): void => {
    try {
      if (isH5 || isBrowser) {
        localStorage.removeItem(key)
        return
      }
      if (typeof Taro.removeStorageSync === 'function') {
        TaroSafe.removeStorageSync(key)
        return
      }
      localStorage.removeItem(key)
    } catch (error) {
      console.warn(`removeStorageSync(${key}) 失败:`, error)
    }
  },

  // Toast相关API
  showToast: (options: {
    title: string
    icon?: 'success' | 'error' | 'loading' | 'none'
    duration?: number
  }): void => {
    try {
      if (typeof Taro.showToast === 'function') {
        showToast(options)
      } else {
        console.log(`Toast: ${options.title}`)
      }
    } catch (error) {
      console.warn('showToast 失败:', error)
      console.log(`Toast: ${options.title}`)
    }
  },

  hideToast: (): void => {
    try {
      if (typeof Taro.hideToast === 'function') {
        Taro.hideToast()
      }
    } catch (error) {
      console.warn('hideToast 失败:', error)
    }
  },

  // 导航相关API
  navigateTo: (options: { url: string }): Promise<any> => {
    try {
      if (typeof Taro.navigateTo === 'function') {
        return Taro.navigateTo(options)
      }
      // H5环境下的降级处理
      if (isH5 && window.location) {
        window.location.hash = options.url
        return Promise.resolve()
      }
      return Promise.resolve()
    } catch (error) {
      console.warn('navigateTo 失败:', error)
      return Promise.resolve()
    }
  },

  redirectTo: (options: { url: string }): Promise<any> => {
    try {
      if (typeof Taro.redirectTo === 'function') {
        return Taro.redirectTo(options)
      }
      // H5环境下的降级处理
      if (isH5 && window.location) {
        window.location.hash = options.url
        return Promise.resolve()
      }
      return Promise.resolve()
    } catch (error) {
      console.warn('redirectTo 失败:', error)
      return Promise.resolve()
    }
  },

  switchTab: (options: { url: string }): Promise<any> => {
    try {
      if (typeof Taro.switchTab === 'function') {
        return Taro.switchTab(options)
      }
      // H5环境下的降级处理
      if (isH5 && window.location) {
        window.location.hash = options.url
        return Promise.resolve()
      }
      return Promise.resolve()
    } catch (error) {
      console.warn('switchTab 失败:', error)
      return Promise.resolve()
    }
  },

  // 生命周期相关API (这些在H5环境可能不存在)
  onAppShow: (callback: () => void): void => {
    try {
      if (typeof Taro.onAppShow === 'function') {
        Taro.onAppShow(callback)
      } else if (isH5) {
        // H5环境下监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            callback()
          }
        })
      }
    } catch (error) {
      console.warn('onAppShow 失败:', error)
    }
  },

  onAppHide: (callback: () => void): void => {
    try {
      if (typeof Taro.onAppHide === 'function') {
        Taro.onAppHide(callback)
      } else if (isH5) {
        // H5环境下监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            callback()
          }
        })
      }
    } catch (error) {
      console.warn('onAppHide 失败:', error)
    }
  },

  // 通用的安全调用方法
  safeCall: (apiName: string, ...args: any[]): any => {
    try {
      if (Taro[apiName] && typeof Taro[apiName] === 'function') {
        return Taro[apiName](...args)
      } else {
        console.warn(`Taro.${apiName} 不可用`)
        return Promise.resolve()
      }
    } catch (error) {
      console.warn(`调用 Taro.${apiName} 失败:`, error)
      return Promise.resolve()
    }
  },

  // 环境信息
  ENV: {
    isH5,
    isBrowser,
    isWeapp: typeof wx !== 'undefined',
    isAlipay: typeof my !== 'undefined'
  }
}

export default TaroSafe