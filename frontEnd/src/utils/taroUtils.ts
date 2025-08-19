import Taro from '@tarojs/taro'

/**
 * 安全的Toast显示函数
 * @param title 提示内容
 * @param icon 图标类型
 * @param duration 显示时长
 */
export const showSafeToast = (
  title: string, 
  icon: 'success' | 'error' | 'loading' | 'none' = 'none', 
  duration: number = 2000
) => {
  try {
    if (typeof Taro !== 'undefined' && Taro.showToast && typeof Taro.showToast === 'function') {
      Taro.showToast({
        title,
        icon,
        duration
      })
    } else {
      // 降级到console输出
      console.log(`[Toast] ${title}`)
    }
  } catch (error) {
    console.error('显示Toast失败:', error)
    // 降级到console输出
    console.log(`[Toast] ${title}`)
  }
}

/**
 * 安全的导航返回函数
 * @param fallbackUrl 备选返回地址
 */
export const safeNavigateBack = (fallbackUrl: string = '/pages/profile/index') => {
  try {
    if (typeof Taro !== 'undefined' && Taro.navigateBack && typeof Taro.navigateBack === 'function') {
      Taro.navigateBack()
    } else if (typeof Taro !== 'undefined' && Taro.switchTab && typeof Taro.switchTab === 'function') {
      Taro.switchTab({ url: fallbackUrl })
    } else if (typeof window !== 'undefined' && window.history) {
      window.history.back()
    } else {
      showSafeToast('返回功能不可用', 'error')
    }
  } catch (error) {
    console.error('返回失败:', error)
    try {
      if (typeof window !== 'undefined' && window.history) {
        window.history.back()
      } else if (typeof Taro !== 'undefined' && Taro.switchTab && typeof Taro.switchTab === 'function') {
        Taro.switchTab({ url: fallbackUrl })
      } else if (typeof window !== 'undefined' && window.location) {
        window.location.hash = `#${fallbackUrl}`
      } else {
        showSafeToast('返回功能不可用', 'error')
      }
    } catch (fallbackError) {
      console.error('备选返回方案也失败了:', fallbackError)
      showSafeToast('返回功能不可用', 'error')
    }
  }
}

/**
 * 安全的操作菜单显示函数
 * @param itemList 操作列表
 * @param onSuccess 成功回调
 * @param onFail 失败回调
 */
export const showSafeActionSheet = (
  itemList: string[],
  onSuccess?: (res: { tapIndex: number }) => void,
  onFail?: (error: any) => void
) => {
  try {
    if (typeof Taro !== 'undefined' && Taro.showActionSheet && typeof Taro.showActionSheet === 'function') {
      Taro.showActionSheet({
        itemList,
        success: onSuccess || ((res) => {
          console.log('选择了操作:', res.tapIndex)
        }),
        fail: onFail || ((error) => {
          console.error('显示操作菜单失败:', error)
          showSafeToast('操作菜单显示失败', 'error')
        })
      })
    } else {
      // 降级处理：使用浏览器原生API
      const action = prompt(`选择操作: ${itemList.map((item, index) => `${index + 1}-${item}`).join(', ')}`)
      if (action) {
        const actionIndex = parseInt(action) - 1
        if (actionIndex >= 0 && actionIndex < itemList.length) {
          console.log('选择了操作:', itemList[actionIndex])
          if (onSuccess) {
            onSuccess({ tapIndex: actionIndex })
          }
        }
      }
    }
  } catch (error) {
    console.error('显示操作菜单失败:', error)
    showSafeToast('操作菜单显示失败', 'error')
    if (onFail) {
      onFail(error)
    }
  }
}

/**
 * 安全的模态框显示函数
 * @param title 标题
 * @param content 内容
 * @param showCancel 是否显示取消按钮
 * @param onConfirm 确认回调
 * @param onCancel 取消回调
 */
export const showSafeModal = (
  title: string,
  content: string,
  showCancel: boolean = true,
  onConfirm?: () => void,
  onCancel?: () => void
) => {
  try {
    if (typeof Taro !== 'undefined' && Taro.showModal && typeof Taro.showModal === 'function') {
      Taro.showModal({
        title,
        content,
        showCancel,
        success: (res) => {
          if (res.confirm && onConfirm) {
            onConfirm()
          } else if (res.cancel && onCancel) {
            onCancel()
          }
        }
      })
    } else {
      // 降级处理：使用浏览器原生API
      if (showCancel) {
        const result = confirm(`${title}\n\n${content}`)
        if (result && onConfirm) {
          onConfirm()
        } else if (!result && onCancel) {
          onCancel()
        }
      } else {
        alert(`${title}\n\n${content}`)
        if (onConfirm) {
          onConfirm()
        }
      }
    }
  } catch (error) {
    console.error('显示模态框失败:', error)
    showSafeToast('显示模态框失败', 'error')
  }
}

/**
 * 检查Taro API是否可用
 * @param apiName API名称
 * @returns 是否可用
 */
export const isTaroApiAvailable = (apiName: string): boolean => {
  try {
    return typeof Taro !== 'undefined' && 
           Taro[apiName] && 
           typeof Taro[apiName] === 'function'
  } catch (error) {
    return false
  }
} 

/**
 * 安全的存储访问函数
 * @param key 存储键名
 * @param defaultValue 默认值
 * @returns 存储的值或默认值
 */
export const safeGetStorage = (key: string, defaultValue: any = null): any => {
  try {
    let result: any = null
    
    // 优先使用Taro存储
    if (typeof Taro !== 'undefined' && Taro.getStorageSync && typeof Taro.getStorageSync === 'function') {
      result = Taro.getStorageSync(key)
      if (result !== null && result !== undefined && result !== '') {
        console.log(`✅ Taro存储读取成功 (${key})`)
        return result
      }
    }
    
    // 降级到localStorage
    if (typeof localStorage !== 'undefined') {
      const storedValue = localStorage.getItem(key)
      if (storedValue !== null) {
        try {
          result = JSON.parse(storedValue)
          console.log(`✅ localStorage读取成功 (${key}):`, typeof result)
          return result
        } catch (parseError) {
          console.warn(`⚠️ JSON解析失败 (${key}):`, parseError)
          // 如果解析失败，返回原始字符串
          return storedValue !== '' ? storedValue : defaultValue
        }
      }
    }
    
    // 降级到sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      const storedValue = sessionStorage.getItem(key)
      if (storedValue !== null) {
        try {
          result = JSON.parse(storedValue)
          console.log(`✅ sessionStorage读取成功 (${key}):`, typeof result)
          return result
        } catch (parseError) {
          console.warn(`⚠️ JSON解析失败 (${key}):`, parseError)
          // 如果解析失败，返回原始字符串
          return storedValue !== '' ? storedValue : defaultValue
        }
      }
    }
    
    console.log(`⚠️ 存储中没有找到数据 (${key})，返回默认值`)
    return defaultValue
  } catch (error) {
    console.warn(`⚠️ 存储访问失败 (${key}):`, error)
    return defaultValue
  }
}

/**
 * 安全的存储设置函数
 * @param key 存储键名
 * @param value 要存储的值
 * @returns 是否成功
 */
export const safeSetStorage = (key: string, value: any): boolean => {
  try {
    // 优先使用Taro存储
    if (typeof Taro !== 'undefined' && Taro.setStorageSync && typeof Taro.setStorageSync === 'function') {
      Taro.setStorageSync(key, value)
      console.log(`✅ Taro存储成功 (${key})`)
      return true
    }
    
    // 降级到localStorage
    if (typeof localStorage !== 'undefined') {
      const jsonValue = JSON.stringify(value)
      localStorage.setItem(key, jsonValue)
      console.log(`✅ localStorage存储成功 (${key}):`, jsonValue.length, '字符')
      return true
    }
    
    // 降级到sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      const jsonValue = JSON.stringify(value)
      sessionStorage.setItem(key, jsonValue)
      console.log(`✅ sessionStorage存储成功 (${key}):`, jsonValue.length, '字符')
      return true
    }
    
    console.warn(`⚠️ 没有可用的存储方式 (${key})`)
    return false
  } catch (error) {
    console.warn(`⚠️ 存储设置失败 (${key}):`, error)
    return false
  }
}

/**
 * 安全的存储移除函数
 * @param key 存储键名
 * @returns 是否成功
 */
export const safeRemoveStorage = (key: string): boolean => {
  try {
    // 优先使用Taro存储
    if (typeof Taro !== 'undefined' && Taro.removeStorageSync && typeof Taro.removeStorageSync === 'function') {
      Taro.removeStorageSync(key)
      return true
    }
    
    // 降级到localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
      return true
    }
    
    // 降级到sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(key)
      return true
    }
    
    return false
  } catch (error) {
    console.warn(`⚠️ 存储移除失败 (${key}):`, error)
    return false
  }
} 