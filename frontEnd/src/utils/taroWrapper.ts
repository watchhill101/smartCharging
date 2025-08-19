// 全局Taro API包装器 - 确保所有API调用都是安全的
import Taro from '@tarojs/taro'

// 环境检测
const isH5 = process.env.TARO_ENV === 'h5'
const isBrowser = typeof window !== 'undefined'
const isWeapp = typeof wx !== 'undefined'

console.log('🌐 Taro环境检测:', { 
  TARO_ENV: process.env.TARO_ENV, 
  isH5, 
  isBrowser, 
  isWeapp,
  hasTaro: typeof Taro !== 'undefined'
})

// 创建安全的Taro包装器
const createSafeWrapper = () => {
  const wrapper = {} as any

  // 遍历Taro对象的所有属性
  for (const key in Taro) {
    if (typeof Taro[key] === 'function') {
      wrapper[key] = (...args: any[]) => {
        try {
          return Taro[key](...args)
        } catch (error) {
          console.warn(`Taro.${key} 调用失败:`, error)
          
          // 提供一些关键API的降级处理
          switch (key) {
            case 'getStorageSync':
              if (isH5 || isBrowser) {
                try {
                  const value = localStorage.getItem(args[0])
                  return value ? JSON.parse(value) : ''
                } catch {
                  return ''
                }
              }
              return ''
              
            case 'setStorageSync':
              if (isH5 || isBrowser) {
                try {
                  localStorage.setItem(args[0], JSON.stringify(args[1]))
                } catch (e) {
                  console.warn('localStorage.setItem 失败:', e)
                }
              }
              return
              
            case 'removeStorageSync':
              if (isH5 || isBrowser) {
                try {
                  localStorage.removeItem(args[0])
                } catch (e) {
                  console.warn('localStorage.removeItem 失败:', e)
                }
              }
              return
              
            case 'showToast':
              console.log(`Toast: ${args[0]?.title || args[0]}`)
              return
              
            case 'hideToast':
              return
              
            case 'showLoading':
              console.log(`Loading: ${args[0]?.title || '加载中...'}`)
              return
              
            case 'hideLoading':
              return
              
            case 'navigateTo':
            case 'redirectTo':
            case 'switchTab':
              if (isH5 && window.location) {
                const url = args[0]?.url || args[0]
                window.location.hash = url
              }
              return Promise.resolve()
              
            case 'navigateBack':
              if (isH5 && window.history) {
                window.history.back()
              }
              return Promise.resolve()
              
            case 'request':
              if (isH5 || isBrowser) {
                const options = args[0]
                return fetch(options.url, {
                  method: options.method || 'GET',
                  headers: options.header,
                  body: options.data ? JSON.stringify(options.data) : undefined
                }).then(response => response.json()).then(data => ({
                  statusCode: 200,
                  data: data
                }))
              }
              return Promise.reject(new Error('请求API不可用'))
              
            default:
              return Promise.resolve()
          }
        }
      }
    } else {
      wrapper[key] = Taro[key]
    }
  }
  
  return wrapper
}

// 创建安全的Taro实例
export const SafeTaro = createSafeWrapper()

// 导出常用的安全API
export const safeGetStorageSync = (key: string) => SafeTaro.getStorageSync(key)
export const safeSetStorageSync = (key: string, data: any) => SafeTaro.setStorageSync(key, data)
export const safeRemoveStorageSync = (key: string) => SafeTaro.removeStorageSync(key)
export const safeShowToast = (options: any) => SafeTaro.showToast(options)
export const safeHideToast = () => SafeTaro.hideToast()
export const safeNavigateTo = (options: any) => SafeTaro.navigateTo(options)

export default SafeTaro