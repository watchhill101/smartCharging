// Taro 浏览器环境兼容层
import Taro from '@tarojs/taro'

// 检测当前运行环境
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
const isWeapp = typeof wx !== 'undefined' && wx.getSystemInfoSync
const isAlipay = typeof my !== 'undefined' && my.getSystemInfoSync

console.log('🌐 运行环境检测:', { isBrowser, isWeapp, isAlipay })

// Storage 兼容实现
export const storage = {
  // 同步获取存储
  getSync: (key: string): string => {
    try {
      if (isBrowser) {
        return localStorage.getItem(key) || ''
      }
      return Taro.getStorageSync(key)
    } catch (error) {
      console.warn(`获取存储失败 (${key}):`, error)
      return ''
    }
  },

  // 同步设置存储
  setSync: (key: string, value: string): void => {
    try {
      if (isBrowser) {
        localStorage.setItem(key, value)
      } else {
        Taro.setStorageSync(key, value)
      }
    } catch (error) {
      console.warn(`设置存储失败 (${key}):`, error)
    }
  },

  // 异步获取存储
  get: async (key: string): Promise<string> => {
    try {
      if (isBrowser) {
        return localStorage.getItem(key) || ''
      }
      return await Taro.getStorage({ key }).then(res => res.data)
    } catch (error) {
      console.warn(`异步获取存储失败 (${key}):`, error)
      return ''
    }
  },

  // 异步设置存储
  set: async (key: string, value: string): Promise<void> => {
    try {
      if (isBrowser) {
        localStorage.setItem(key, value)
      } else {
        await Taro.setStorage({ key, data: value })
      }
    } catch (error) {
      console.warn(`异步设置存储失败 (${key}):`, error)
    }
  },

  // 删除存储
  remove: async (key: string): Promise<void> => {
    try {
      if (isBrowser) {
        localStorage.removeItem(key)
      } else {
        await Taro.removeStorage({ key })
      }
    } catch (error) {
      console.warn(`删除存储失败 (${key}):`, error)
    }
  },

  // 清空存储
  clear: async (): Promise<void> => {
    try {
      if (isBrowser) {
        localStorage.clear()
      } else {
        await Taro.clearStorage()
      }
    } catch (error) {
      console.warn('清空存储失败:', error)
    }
  }
}

// Toast 提示兼容实现
export const toast = {
  show: (options: {
    title: string
    icon?: 'success' | 'error' | 'loading' | 'none'
    duration?: number
    mask?: boolean
  }): void => {
    const { title, icon = 'none', duration = 2000 } = options

    try {
      if (isBrowser) {
        // 浏览器环境使用自定义 Toast
        showBrowserToast(title, icon, duration)
      } else {
        // 小程序环境使用原生 Toast
        Taro.showToast({
          title,
          icon,
          duration
        })
      }
    } catch (error) {
      console.warn('显示Toast失败:', error)
      // 降级到console.log
      console.log(`🍞 Toast: ${title}`)
    }
  },

  hide: (): void => {
    try {
      if (isBrowser) {
        hideBrowserToast()
      } else {
        Taro.hideToast()
      }
    } catch (error) {
      console.warn('隐藏Toast失败:', error)
    }
  },

  loading: (title: string = '加载中...'): void => {
    toast.show({ title, icon: 'loading', duration: 0 })
  },

  success: (title: string, duration?: number): void => {
    toast.show({ title, icon: 'success', duration })
  },

  error: (title: string, duration?: number): void => {
    toast.show({ title, icon: 'error', duration })
  }
}

// 浏览器环境下的 Toast 实现
let toastElement: HTMLElement | null = null
let toastTimer: NodeJS.Timeout | null = null

const showBrowserToast = (title: string, icon: string, duration: number): void => {
  // 如果已有 Toast，先清除
  hideBrowserToast()

  // 确保样式已加载
  injectToastStyles()

  // 创建 Toast 元素
  toastElement = document.createElement('div')
  toastElement.className = `taro-compat-toast ${icon}`
  
  // 设置样式
  Object.assign(toastElement.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: getToastBackgroundColor(icon),
    color: 'white',
    padding: '16px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    zIndex: '10000',
    maxWidth: '300px',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    transition: 'all 0.3s ease',
    opacity: '0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    lineHeight: '1.4',
    backdropFilter: 'blur(10px)'
  })

  // 添加图标
  let iconText = ''
  switch (icon) {
    case 'success':
      iconText = '✅ '
      break
    case 'error':
      iconText = '❌ '
      break
    case 'loading':
      iconText = '🔄 '
      break
    default:
      iconText = ''
  }

  toastElement.textContent = iconText + title
  document.body.appendChild(toastElement)

  // 显示动画
  setTimeout(() => {
    if (toastElement) {
      toastElement.style.opacity = '1'
    }
  }, 10)

  // 自动隐藏
  if (duration > 0) {
    toastTimer = setTimeout(() => {
      hideBrowserToast()
    }, duration)
  }
}

const hideBrowserToast = (): void => {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }

  if (toastElement) {
    toastElement.style.opacity = '0'
    setTimeout(() => {
      if (toastElement && toastElement.parentNode) {
        toastElement.parentNode.removeChild(toastElement)
      }
      toastElement = null
    }, 300)
  }
}

// Loading 加载提示兼容实现
let loadingElement: HTMLElement | null = null

export const loading = {
  show: (options: {
    title?: string
    mask?: boolean
  } = {}): void => {
    const { title = '加载中...', mask = true } = options

    try {
      if (isBrowser) {
        // 浏览器环境使用自定义 Loading
        showBrowserLoading(title, mask)
      } else {
        // 小程序环境使用原生 Loading
        Taro.showLoading({
          title,
          mask
        })
      }
    } catch (error) {
      console.warn('显示Loading失败:', error)
      // 降级到console.log
      console.log(`⏳ Loading: ${title}`)
    }
  },

  hide: (): void => {
    try {
      if (isBrowser) {
        hideBrowserLoading()
      } else {
        Taro.hideLoading()
      }
    } catch (error) {
      console.warn('隐藏Loading失败:', error)
    }
  }
}

// 浏览器环境下的 Loading 实现
const showBrowserLoading = (title: string, mask: boolean): void => {
  // 如果已有 Loading，先清除
  hideBrowserLoading()

  // 确保样式已加载
  injectLoadingStyles()

  // 创建遮罩层
  if (mask) {
    const maskElement = document.createElement('div')
    maskElement.className = 'taro-compat-loading-mask'
    maskElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `
    document.body.appendChild(maskElement)
    loadingElement = maskElement
  }

  // 创建 Loading 容器
  const container = mask ? loadingElement! : document.body
  const spinner = document.createElement('div')
  spinner.className = 'taro-compat-loading-spinner'
  
  spinner.style.cssText = `
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    font-size: 14px;
    z-index: 10000;
    ${!mask ? 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);' : ''}
    min-width: 120px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif;
  `

  // 添加旋转器
  const rotator = document.createElement('div')
  rotator.className = 'taro-compat-loading-rotator'
  rotator.style.cssText = `
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    margin: 0 auto 10px;
    animation: taro-loading-spin 1s linear infinite;
  `

  // 添加文字
  const text = document.createElement('div')
  text.textContent = title
  text.style.cssText = 'color: white; font-size: 14px; line-height: 1.4;'

  spinner.appendChild(rotator)
  spinner.appendChild(text)
  container.appendChild(spinner)

  if (!mask) {
    loadingElement = spinner
  }
}

const hideBrowserLoading = (): void => {
  if (loadingElement) {
    if (loadingElement.parentNode) {
      loadingElement.parentNode.removeChild(loadingElement)
    }
    loadingElement = null
  }
}

// 注入 Loading 样式
const injectLoadingStyles = (): void => {
  if (stylesInjected || !isBrowser) return
  injectToastStyles() // 复用样式注入逻辑
}

// Request 请求兼容实现
export const request = async (options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
}): Promise<any> => {
  const { url, method = 'GET', data, header = {} } = options

  try {
    if (isBrowser) {
      // 浏览器环境使用 fetch
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...header
        }
      }

      if (data && method !== 'GET') {
        fetchOptions.body = JSON.stringify(data)
      }

      const response = await fetch(url, fetchOptions)
      const result = await response.json()

      return {
        data: result,
        statusCode: response.status,
        header: response.headers
      }
    } else {
      // 小程序环境使用 Taro.request
      return await Taro.request({
        url,
        method,
        data,
        header
      })
    }
  } catch (error) {
    console.error('请求失败:', error)
    throw error
  }
}

// 导出兼容的 Taro 对象
export const TaroCompat = {
  ...Taro,
  getStorageSync: storage.getSync,
  setStorageSync: storage.setSync,
  getStorage: storage.get,
  setStorage: storage.set,
  removeStorage: storage.remove,
  clearStorage: storage.clear,
  showToast: toast.show,
  hideToast: toast.hide,
  showLoading: loading.show,
  hideLoading: loading.hide,
  request,
  
  // 环境检测
  ENV: {
    isBrowser,
    isWeapp,
    isAlipay
  }
}

// 获取 Toast 背景颜色
const getToastBackgroundColor = (icon: string): string => {
  switch (icon) {
    case 'success':
      return 'rgba(16, 185, 129, 0.95)'
    case 'error':
      return 'rgba(239, 68, 68, 0.95)'
    case 'loading':
      return 'rgba(59, 130, 246, 0.95)'
    default:
      return 'rgba(0, 0, 0, 0.8)'
  }
}

// 注入 Toast 样式
let stylesInjected = false
const injectToastStyles = (): void => {
  if (stylesInjected || !isBrowser) return

  const style = document.createElement('style')
  style.textContent = `
    .taro-compat-toast {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      white-space: pre-wrap;
      word-break: break-word;
      animation: taro-toast-fade-in 0.3s ease-out;
    }

    @keyframes taro-toast-fade-in {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    .taro-compat-toast.loading::after {
      content: '';
      display: inline-block;
      width: 12px;
      height: 12px;
      margin-left: 8px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: taro-loading-spin 1s linear infinite;
    }

    @keyframes taro-loading-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .taro-compat-toast {
        max-width: 280px !important;
        font-size: 13px !important;
        padding: 14px 20px !important;
      }
    }
  `

  document.head.appendChild(style)
  stylesInjected = true
}

export default TaroCompat
