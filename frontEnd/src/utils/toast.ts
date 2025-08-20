// 安全的Toast工具 - 避免循环导入
import Taro from '@tarojs/taro'

export interface ToastOptions {
  title: string
  icon?: 'success' | 'error' | 'loading' | 'none'
  duration?: number
  mask?: boolean
}

// 检测环境
const isH5 = process.env.TARO_ENV === 'h5'
const isBrowser = typeof window !== 'undefined'

export const showToast = (options: ToastOptions | string) => {
  try {
    const opts = typeof options === 'string' ? { title: options } : options
    
    if (typeof Taro.showToast === 'function') {
      Taro.showToast(opts)
    } else {
      // 降级处理
      // Toast显示
    }
  } catch (error) {
    console.warn('Toast显示失败:', error)
    const title = typeof options === 'string' ? options : options.title
    // Toast显示
  }
}

export const hideToast = () => {
  try {
    if (typeof Taro.hideToast === 'function') {
      Taro.hideToast()
    }
  } catch (error) {
    console.warn('Toast隐藏失败:', error)
  }
}

export const showSuccess = (title: string, duration?: number) => {
  showToast({ title, icon: 'success', duration })
}

export const showError = (title: string, duration?: number) => {
  showToast({ title, icon: 'error', duration })
}

export const showLoading = (title: string = '加载中...') => {
  showToast({ title, icon: 'loading', duration: 0 })
}

export default {
  show: showToast,
  hide: hideToast,
  success: showSuccess,
  error: showError,
  loading: showLoading
}