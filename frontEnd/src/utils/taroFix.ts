/**
 * Taro 初始化修复工具
 * 解决 Taro API 未正确加载的问题
 */

// 尝试多种方式导入Taro
let Taro: any = null

// 方法1: 标准ES6导入
try {
  Taro = require('@tarojs/taro')
  console.log('✅ 方法1: require导入成功')
} catch (error) {
  console.log('❌ 方法1: require导入失败:', error)
}

// 方法2: 动态导入
if (!Taro) {
  try {
    import('@tarojs/taro').then(module => {
      Taro = module.default || module
      console.log('✅ 方法2: 动态导入成功')
    }).catch(error => {
      console.log('❌ 方法2: 动态导入失败:', error)
    })
  } catch (error) {
    console.log('❌ 方法2: 动态导入异常:', error)
  }
}

// 方法3: 检查全局变量
if (!Taro && typeof window !== 'undefined') {
  Taro = (window as any).Taro
  if (Taro) {
    console.log('✅ 方法3: 全局变量导入成功')
  } else {
    console.log('❌ 方法3: 全局变量不存在')
  }
}

// 方法4: 检查Taro环境变量
if (!Taro) {
  try {
    // 检查是否在Taro环境中
    if (typeof __TARO_ENV__ !== 'undefined') {
      console.log('✅ 检测到Taro环境变量:', __TARO_ENV__)
      
      // 根据环境重新尝试导入
      switch (__TARO_ENV__) {
        case 'weapp':
          Taro = require('@tarojs/taro')
          break
        case 'h5':
          Taro = require('@tarojs/taro')
          break
        case 'rn':
          Taro = require('@tarojs/taro')
          break
        default:
          console.log('未知的Taro环境:', __TARO_ENV__)
      }
    } else {
      console.log('❌ 未检测到Taro环境变量')
    }
  } catch (error) {
    console.log('❌ 环境变量检查失败:', error)
  }
}

/**
 * 获取Taro实例
 */
export const getTaro = () => {
  if (!Taro) {
    console.error('❌ Taro实例未初始化')
    return null
  }
  return Taro
}

/**
 * 检查Taro API可用性
 */
export const checkTaroAPI = (apiName: string) => {
  const taro = getTaro()
  if (!taro) return false
  
  const api = taro[apiName]
  const available = typeof api === 'function'
  
  console.log(`🔍 ${apiName}: ${available ? '✅ 可用' : '❌ 不可用'}`)
  return available
}

/**
 * 创建Taro API包装器
 */
export const createTaroWrapper = () => {
  const taro = getTaro()
  if (!taro) {
    console.error('无法创建Taro包装器，Taro未初始化')
    return null
  }

  return {
    // 定位相关
    getLocation: (options: any) => {
      if (checkTaroAPI('getLocation')) {
        return taro.getLocation(options)
      }
      console.error('getLocation API不可用')
      return Promise.reject(new Error('getLocation API不可用'))
    },

    // 提示相关
    showToast: (options: any) => {
      if (checkTaroAPI('showToast')) {
        return taro.showToast(options)
      }
      console.error('showToast API不可用')
      // 降级到浏览器原生alert
      if (typeof window !== 'undefined') {
        alert(options.title || '提示')
      }
    },

    // 网络请求
    request: (options: any) => {
      if (checkTaroAPI('request')) {
        return taro.request(options)
      }
      console.error('request API不可用')
      // 降级到fetch
      if (typeof fetch !== 'undefined') {
        return fetch(options.url, {
          method: options.method || 'GET',
          headers: options.header || {},
          body: options.data ? JSON.stringify(options.data) : undefined
        }).then(response => response.json())
      }
      return Promise.reject(new Error('request API不可用且无降级方案'))
    },

    // 系统信息
    getSystemInfoSync: () => {
      if (checkTaroAPI('getSystemInfoSync')) {
        return taro.getSystemInfoSync()
      }
      console.error('getSystemInfoSync API不可用')
      // 返回默认信息
      return {
        platform: 'unknown',
        environment: 'unknown',
        system: 'unknown'
      }
    },

    // 权限相关
    getSetting: (options: any) => {
      if (checkTaroAPI('getSetting')) {
        return taro.getSetting(options)
      }
      console.error('getSetting API不可用')
      // 模拟权限检查
      if (options && options.success) {
        options.success({
          authSetting: {
            'scope.userLocation': true // 假设有权限
          }
        })
      }
    },

    // 打开设置
    openSetting: (options: any) => {
      if (checkTaroAPI('openSetting')) {
        return taro.openSetting(options)
      }
      console.error('openSetting API不可用')
      // 提示用户手动开启权限
      if (typeof window !== 'undefined') {
        alert('请在浏览器设置中开启定位权限')
      }
    }
  }
}

/**
 * 初始化Taro环境
 */
export const initTaro = async () => {
  console.log('🚀 开始初始化Taro环境...')
  
  // 等待一段时间确保模块加载完成
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const taro = getTaro()
  if (taro) {
    console.log('✅ Taro初始化成功')
    return true
  } else {
    console.error('❌ Taro初始化失败')
    return false
  }
}

/**
 * 强制重新加载Taro
 */
export const reloadTaro = async () => {
  console.log('🔄 强制重新加载Taro...')
  
  try {
    // 清除缓存
    if (typeof window !== 'undefined' && (window as any).__webpack_require__) {
      delete (window as any).__webpack_require__.c['@tarojs/taro']
    }
    
    // 重新导入
    const module = await import('@tarojs/taro')
    Taro = module.default || module
    console.log('✅ Taro重新加载成功')
    return true
  } catch (error) {
    console.error('❌ Taro重新加载失败:', error)
    return false
  }
}

export default {
  getTaro,
  checkTaroAPI,
  createTaroWrapper,
  initTaro,
  reloadTaro
} 