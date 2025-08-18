import Taro from '@tarojs/taro'

/**
 * 深度检查Taro对象状态
 */
export const deepCheckTaro = () => {
  console.log('=== Taro 深度检查开始 ===')
  
  // 检查Taro对象本身
  console.log('1. Taro对象检查:')
  console.log('   Taro存在:', !!Taro)
  console.log('   Taro类型:', typeof Taro)
  console.log('   Taro构造函数:', Taro?.constructor?.name)
  console.log('   Taro原型链:', Object.getPrototypeOf(Taro))
  
  // 检查Taro的所有属性
  console.log('2. Taro属性检查:')
  const taroKeys = Object.keys(Taro || {})
  console.log('   Taro属性数量:', taroKeys.length)
  console.log('   Taro属性列表:', taroKeys)
  
  // 检查关键API方法
  console.log('3. 关键API检查:')
  const criticalAPIs = [
    'getLocation', 'showToast', 'request', 'getSystemInfoSync',
    'getSystemInfo', 'getUserInfo', 'setStorage', 'getStorage'
  ]
  
  criticalAPIs.forEach(api => {
    const method = (Taro as any)?.[api]
    console.log(`   ${api}:`, {
      '存在': !!method,
      '类型': typeof method,
      '可调用': typeof method === 'function'
    })
  })
  
  // 检查环境信息
  console.log('4. 环境信息检查:')
  try {
    if (typeof window !== 'undefined') {
      console.log('   运行环境: 浏览器')
      console.log('   User Agent:', navigator.userAgent)
      console.log('   地理位置支持:', 'geolocation' in navigator)
    } else if (typeof global !== 'undefined') {
      console.log('   运行环境: Node.js')
    } else {
      console.log('   运行环境: 未知')
    }
  } catch (error) {
    console.log('   环境检测失败:', error)
  }
  
  // 检查Taro版本信息
  console.log('5. 版本信息检查:')
  try {
    const version = (Taro as any)?.VERSION || '未知'
    console.log('   Taro版本:', version)
  } catch (error) {
    console.log('   版本检测失败:', error)
  }
  
  console.log('=== Taro 深度检查结束 ===')
}

/**
 * 测试Taro API可用性
 */
export const testTaroAPI = () => {
  console.log('=== Taro API 测试开始 ===')
  
  // 深度检查
  deepCheckTaro()
  
  // 检查Taro对象
  if (!Taro) {
    console.error('❌ Taro对象不存在')
    return false
  }
  
  // 检查getLocation方法
  if (Taro && typeof Taro.getLocation === 'function') {
    console.log('✅ Taro.getLocation 可用')
  } else {
    console.error('❌ Taro.getLocation 不可用')
  }
  
  // 检查其他常用方法
  const methods = ['showToast', 'request', 'getSystemInfo', 'getUserInfo']
  methods.forEach(method => {
    if (Taro && typeof (Taro as any)[method] === 'function') {
      console.log(`✅ Taro.${method} 可用`)
    } else {
      console.error(`❌ Taro.${method} 不可用`)
    }
  })
  
  // 检查环境信息
  try {
    if (typeof (Taro as any).getSystemInfoSync === 'function') {
      const systemInfo = (Taro as any).getSystemInfoSync()
      console.log('✅ 系统信息获取成功:', systemInfo)
      console.log('   平台:', systemInfo.platform)
      console.log('   环境:', systemInfo.environment)
    } else {
      console.error('❌ getSystemInfoSync 不可用')
    }
  } catch (error) {
    console.error('❌ 获取系统信息失败:', error)
  }
  
  console.log('=== Taro API 测试结束 ===')
  return true
}

/**
 * 测试定位功能
 */
export const testLocation = () => {
  console.log('=== 定位功能测试开始 ===')
  
  if (!Taro || typeof (Taro as any).getLocation !== 'function') {
    console.error('❌ 定位API不可用')
    
    // 尝试使用浏览器原生API
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      console.log('🔄 尝试使用浏览器原生定位API')
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ 浏览器定位成功:', position)
        },
        (error) => {
          console.error('❌ 浏览器定位失败:', error)
        }
      )
    }
    return
  }
  
  // 测试定位权限
  try {
    (Taro as any).getSetting({
      success: (res: any) => {
        console.log('✅ 权限设置获取成功:', res)
        const locationAuth = res.authSetting['scope.userLocation']
        console.log('   定位权限状态:', locationAuth)
        
        if (locationAuth === false) {
          console.log('需要引导用户开启定位权限')
          (Taro as any).openSetting({
            success: (settingRes: any) => {
              console.log('设置页面结果:', settingRes)
            }
          })
        }
      },
      fail: (error: any) => {
        console.error('❌ 获取权限设置失败:', error)
      }
    })
  } catch (error) {
    console.error('❌ 权限检查失败:', error)
  }
  
  // 测试定位功能
  try {
    (Taro as any).getLocation({
      type: 'gcj02',
      success: (res: any) => {
        console.log('✅ 定位成功:', res)
        console.log('   纬度:', res.latitude)
        console.log('   经度:', res.longitude)
        console.log('   精度:', res.accuracy)
      },
      fail: (error: any) => {
        console.error('❌ 定位失败:', error)
        console.error('   错误信息:', error.errMsg)
        
        // 根据错误类型提供建议
        if (error.errMsg) {
          if (error.errMsg.includes('auth deny')) {
            console.log('建议: 引导用户开启定位权限')
          } else if (error.errMsg.includes('timeout')) {
            console.log('建议: 检查GPS信号或网络连接')
          } else if (error.errMsg.includes('unsupported')) {
            console.log('建议: 当前环境不支持定位功能')
          }
        }
      }
    })
  } catch (error) {
    console.error('❌ 定位调用失败:', error)
  }
  
  console.log('=== 定位功能测试结束 ===')
}

/**
 * 测试网络请求
 */
export const testNetwork = () => {
  console.log('=== 网络请求测试开始 ===')
  
  if (!Taro || typeof (Taro as any).request !== 'function') {
    console.error('❌ 网络请求API不可用')
    
    // 尝试使用浏览器原生fetch
    if (typeof fetch !== 'undefined') {
      console.log('🔄 尝试使用浏览器原生fetch API')
      fetch('https://httpbin.org/get')
        .then(response => response.json())
        .then(data => {
          console.log('✅ fetch请求成功:', data)
        })
        .catch(error => {
          console.error('❌ fetch请求失败:', error)
        })
    }
    return
  }
  
  // 测试高德地图API
  try {
    (Taro as any).request({
      url: 'https://restapi.amap.com/v3/geocode/regeo',
      data: {
        key: 'test_key',
        location: '116.397428,39.90923',
        output: 'json'
      },
      success: (res: any) => {
        console.log('✅ 网络请求成功:', res.statusCode)
        if (res.data && res.data.info) {
          console.log('   API响应信息:', res.data.info)
        }
      },
      fail: (error: any) => {
        console.error('❌ 网络请求失败:', error)
      }
    })
  } catch (error) {
    console.error('❌ 网络请求调用失败:', error)
  }
  
  console.log('=== 网络请求测试结束 ===')
}

/**
 * 检查Taro初始化问题
 */
export const diagnoseTaroInit = () => {
  console.log('=== Taro 初始化问题诊断 ===')
  
  // 检查导入路径
  console.log('1. 导入检查:')
  try {
    const taroModule = require('@tarojs/taro')
    console.log('   require导入成功:', !!taroModule)
    console.log('   require导入内容:', Object.keys(taroModule || {}))
  } catch (error) {
    console.error('   require导入失败:', error)
  }
  
  // 检查ES6导入
  console.log('2. ES6导入检查:')
  console.log('   import Taro成功:', !!Taro)
  console.log('   Taro默认导出:', Taro?.default)
  console.log('   Taro命名导出:', Taro?.Taro)
  
  // 检查环境变量
  console.log('3. 环境变量检查:')
  console.log('   NODE_ENV:', process.env.NODE_ENV)
  console.log('   TARO_ENV:', process.env.TARO_ENV)
  
  // 检查构建配置
  console.log('4. 构建配置检查:')
  try {
    if (typeof __TARO_ENV__ !== 'undefined') {
      console.log('   __TARO_ENV__:', __TARO_ENV__)
    } else {
      console.log('   __TARO_ENV__: 未定义')
    }
  } catch (error) {
    console.log('   __TARO_ENV__: 检查失败')
  }
  
  console.log('=== Taro 初始化问题诊断结束 ===')
}

/**
 * 运行所有测试
 */
export const runAllTests = () => {
  console.log('🚀 开始运行Taro功能测试...')
  
  // 首先诊断初始化问题
  diagnoseTaroInit()
  
  // 然后运行功能测试
  testTaroAPI()
  
  // 延迟执行其他测试，确保API初始化完成
  setTimeout(() => {
    testLocation()
    testNetwork()
  }, 1000)
}

export default {
  deepCheckTaro,
  testTaroAPI,
  testLocation,
  testNetwork,
  diagnoseTaroInit,
  runAllTests
} 