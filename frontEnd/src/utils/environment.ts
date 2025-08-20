/**
 * 环境检测工具
 * 帮助诊断当前运行环境和可用的API
 */

export interface EnvironmentInfo {
  isTaro: boolean
  isWechat: boolean
  isBrowser: boolean
  isNode: boolean
  availableApis: string[]
  storageType: 'taro' | 'localStorage' | 'sessionStorage' | 'none'
}

/**
 * 检测当前运行环境
 */
export const detectEnvironment = (): EnvironmentInfo => {
  const info: EnvironmentInfo = {
    isTaro: false,
    isWechat: false,
    isBrowser: false,
    isNode: false,
    availableApis: [],
    storageType: 'none'
  }

  try {
    // 检测Taro环境
    if (typeof Taro !== 'undefined') {
      info.isTaro = true
      info.availableApis.push('Taro')
      
      // 检测可用的Taro API
      const taroApis = [
        'getStorageSync', 'setStorageSync', 'removeStorageSync',
        'showToast', 'showModal', 'showActionSheet',
        'navigateBack', 'switchTab', 'request'
      ]
      
      taroApis.forEach(api => {
        if (Taro[api] && typeof Taro[api] === 'function') {
          info.availableApis.push(`Taro.${api}`)
        }
      })
      
      // 检测存储类型
      if (Taro.getStorageSync && typeof Taro.getStorageSync === 'function') {
        info.storageType = 'taro'
      }
    }

    // 检测微信环境
    if (typeof wx !== 'undefined') {
      info.isWechat = true
      info.availableApis.push('WeChat')
    }

    // 检测浏览器环境
    if (typeof window !== 'undefined') {
      info.isBrowser = true
      info.availableApis.push('Browser')
      
      // 检测localStorage
      if (typeof localStorage !== 'undefined') {
        info.availableApis.push('localStorage')
        if (info.storageType === 'none') {
          info.storageType = 'localStorage'
        }
      }
      
      // 检测sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        info.availableApis.push('sessionStorage')
        if (info.storageType === 'none') {
          info.storageType = 'sessionStorage'
        }
      }
      
      // 检测fetch API
      if (typeof fetch !== 'undefined') {
        info.availableApis.push('fetch')
      }
    }

    // 检测Node.js环境
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      info.isNode = true
      info.availableApis.push('Node.js')
    }

  } catch (error) {
    console.warn('环境检测失败:', error)
  }

  return info
}

/**
 * 打印环境信息到控制台
 */
export const logEnvironmentInfo = () => {
  const env = detectEnvironment()
  
  console.group('🌍 环境检测结果')
  console.log('Taro环境:', env.isTaro)
  console.log('微信环境:', env.isWechat)
  console.log('浏览器环境:', env.isBrowser)
  console.log('Node.js环境:', env.isNode)
  console.log('存储类型:', env.storageType)
  console.log('可用API:', env.availableApis)
  console.groupEnd()
  
  return env
}

/**
 * 检查特定API是否可用
 */
export const isApiAvailable = (apiName: string): boolean => {
  try {
    const env = detectEnvironment()
    return env.availableApis.includes(apiName)
  } catch (error) {
    return false
  }
}

/**
 * 获取推荐的环境适配策略
 */
export const getEnvironmentStrategy = (): string[] => {
  const env = detectEnvironment()
  const strategies: string[] = []
  
  if (env.isTaro) {
    strategies.push('优先使用Taro原生API')
    if (env.storageType === 'taro') {
      strategies.push('使用Taro存储API')
    }
  }
  
  if (env.isBrowser) {
    if (env.storageType === 'localStorage') {
      strategies.push('降级到localStorage')
    } else if (env.storageType === 'sessionStorage') {
      strategies.push('降级到sessionStorage')
    }
    
    if (env.availableApis.includes('fetch')) {
      strategies.push('使用fetch API进行网络请求')
    }
  }
  
  if (strategies.length === 0) {
    strategies.push('使用模拟数据作为备选方案')
  }
  
  return strategies
} 