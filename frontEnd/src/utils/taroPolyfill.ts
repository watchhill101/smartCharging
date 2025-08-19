// Taro API Polyfill - 为H5环境提供缺失的API
import Taro from '@tarojs/taro'

const isH5 = process.env.TARO_ENV === 'h5'
const isBrowser = typeof window !== 'undefined'

if (isH5 || isBrowser) {
  console.log('🔧 正在为H5环境添加Taro API Polyfill...')
  
  // 存储API Polyfill
  if (!Taro.getStorageSync) {
    Taro.getStorageSync = (key: string) => {
      try {
        const value = localStorage.getItem(key)
        return value ? JSON.parse(value) : ''
      } catch {
        return ''
      }
    }
  }
  
  if (!Taro.setStorageSync) {
    Taro.setStorageSync = (key: string, data: any) => {
      try {
        localStorage.setItem(key, JSON.stringify(data))
      } catch (e) {
        console.warn('setStorageSync polyfill 失败:', e)
      }
    }
  }
  
  if (!Taro.removeStorageSync) {
    Taro.removeStorageSync = (key: string) => {
      try {
        localStorage.removeItem(key)
      } catch (e) {
        console.warn('removeStorageSync polyfill 失败:', e)
      }
    }
  }
  
  // Toast API Polyfill
  if (!Taro.showToast) {
    Taro.showToast = (options: any) => {
      const title = typeof options === 'string' ? options : options?.title
      console.log(`Toast: ${title}`)
    }
  }
  
  if (!Taro.hideToast) {
    Taro.hideToast = () => {
      // 空实现
    }
  }
  
  // Loading API Polyfill
  if (!Taro.showLoading) {
    Taro.showLoading = (options: any) => {
      const title = typeof options === 'string' ? options : options?.title || '加载中...'
      console.log(`Loading: ${title}`)
    }
  }
  
  if (!Taro.hideLoading) {
    Taro.hideLoading = () => {
      // 空实现
    }
  }
  
  // 导航API Polyfill
  if (!Taro.navigateTo) {
    Taro.navigateTo = (options: any) => {
      const url = options?.url || options
      if (window.location) {
        window.location.hash = url
      }
      return Promise.resolve()
    }
  }
  
  if (!Taro.redirectTo) {
    Taro.redirectTo = (options: any) => {
      const url = options?.url || options
      if (window.location) {
        window.location.hash = url
      }
      return Promise.resolve()
    }
  }
  
  if (!Taro.switchTab) {
    Taro.switchTab = (options: any) => {
      const url = options?.url || options
      if (window.location) {
        window.location.hash = url
      }
      return Promise.resolve()
    }
  }
  
  if (!Taro.navigateBack) {
    Taro.navigateBack = (options: any) => {
      const delta = options?.delta || 1
      if (window.history) {
        window.history.go(-delta)
      }
      return Promise.resolve()
    }
  }
  
  // 生命周期API Polyfill
  if (!Taro.onAppShow) {
    Taro.onAppShow = (callback: () => void) => {
      if (document) {
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            callback()
          }
        })
      }
    }
  }
  
  if (!Taro.onAppHide) {
    Taro.onAppHide = (callback: () => void) => {
      if (document) {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            callback()
          }
        })
      }
    }
  }
  
  if (!Taro.offAppShow) {
    Taro.offAppShow = (callback: () => void) => {
      // 空实现，因为我们无法精确移除特定的监听器
    }
  }
  
  if (!Taro.offAppHide) {
    Taro.offAppHide = (callback: () => void) => {
      // 空实现，因为我们无法精确移除特定的监听器
    }
  }
  
  // 请求API Polyfill
  if (!Taro.request) {
    Taro.request = async (options: any) => {
      try {
        const response = await fetch(options.url, {
          method: options.method || 'GET',
          headers: options.header,
          body: options.data ? JSON.stringify(options.data) : undefined
        })
        
        const data = await response.json()
        
        return {
          statusCode: response.status,
          data: data,
          header: response.headers
        }
      } catch (error) {
        throw error
      }
    }
  }
  
  console.log('✅ Taro API Polyfill 加载完成')
}

export default Taro