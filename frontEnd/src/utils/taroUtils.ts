// Taro工具函数 - 安全的跨平台API调用

import Taro from '@tarojs/taro'

/**
 * 安全显示提示框
 * @param title 提示内容
 * @param icon 图标类型
 * @param duration 显示时长
 */
export function showSafeToast(title: string, icon: 'success' | 'error' | 'loading' | 'none' = 'none', duration: number = 2000) {
  try {
    if (typeof Taro.showToast === 'function') {
      Taro.showToast({
        title,
        icon,
        duration,
        mask: false
      })
    } else {
      // 降级到console输出
      console.log(`Toast: ${title} (${icon})`)
    }
  } catch (error) {
    console.error('显示提示框失败:', error)
    console.log(`Toast: ${title} (${icon})`)
  }
}

/**
 * 安全显示模态框
 * @param title 标题
 * @param content 内容
 * @param showCancel 是否显示取消按钮
 */
export function showSafeModal(
  title: string, 
  content: string, 
  showCancel: boolean = true
): Promise<{ confirm: boolean; cancel: boolean }> {
  return new Promise((resolve) => {
    try {
      if (typeof Taro.showModal === 'function') {
        Taro.showModal({
          title,
          content,
          showCancel,
          success: (res) => {
            resolve({
              confirm: res.confirm,
              cancel: res.cancel
            })
          },
          fail: () => {
            resolve({ confirm: false, cancel: true })
          }
        })
      } else {
        // 降级到confirm
        const result = confirm(`${title}\n${content}`)
        resolve({
          confirm: result,
          cancel: !result
        })
      }
    } catch (error) {
      console.error('显示模态框失败:', error)
      const result = confirm(`${title}\n${content}`)
      resolve({
        confirm: result,
        cancel: !result
      })
    }
  })
}

/**
 * 安全显示操作菜单
 * @param itemList 选项列表
 */
export function showSafeActionSheet(itemList: string[]): Promise<number> {
  return new Promise((resolve) => {
    try {
      if (typeof Taro.showActionSheet === 'function') {
        Taro.showActionSheet({
          itemList,
          success: (res) => {
            resolve(res.tapIndex)
          },
          fail: () => {
            resolve(-1)
          }
        })
      } else {
        // 降级处理
        const choice = prompt(`请选择:\n${itemList.map((item, index) => `${index}: ${item}`).join('\n')}`)
        const index = parseInt(choice || '-1')
        resolve(isNaN(index) ? -1 : index)
      }
    } catch (error) {
      console.error('显示操作菜单失败:', error)
      resolve(-1)
    }
  })
}

/**
 * 安全返回上一页
 * @param delta 返回层数
 */
export function safeNavigateBack(delta: number = 1) {
  try {
    if (typeof Taro.navigateBack === 'function') {
      Taro.navigateBack({
        delta,
        success: () => {
          console.log('返回成功')
        },
        fail: (error) => {
          console.error('返回失败:', error)
          // 降级到历史记录返回
          if (typeof window !== 'undefined' && window.history) {
            window.history.go(-delta)
          }
        }
      })
    } else {
      // 降级到历史记录返回
      if (typeof window !== 'undefined' && window.history) {
        window.history.go(-delta)
      }
    }
  } catch (error) {
    console.error('返回失败:', error)
    // 最后的降级方案
    if (typeof window !== 'undefined' && window.history) {
      window.history.go(-delta)
    }
  }
}

/**
 * 安全页面跳转
 * @param url 目标页面路径
 */
export function safeNavigateTo(url: string) {
  try {
    if (typeof Taro.navigateTo === 'function') {
      Taro.navigateTo({
        url,
        success: () => {
          console.log('跳转成功:', url)
        },
        fail: (error) => {
          console.error('跳转失败:', error)
          // 降级到location跳转
          if (typeof window !== 'undefined') {
            window.location.href = url
          }
        }
      })
    } else {
      // 降级到location跳转
      if (typeof window !== 'undefined') {
        window.location.href = url
      }
    }
  } catch (error) {
    console.error('页面跳转失败:', error)
    if (typeof window !== 'undefined') {
      window.location.href = url
    }
  }
}

/**
 * 安全切换Tab页面
 * @param url Tab页面路径
 */
export function safeSwitchTab(url: string) {
  try {
    if (typeof Taro.switchTab === 'function') {
      Taro.switchTab({
        url,
        success: () => {
          console.log('切换Tab成功:', url)
        },
        fail: (error) => {
          console.error('切换Tab失败:', error)
          // 降级到普通跳转
          safeNavigateTo(url)
        }
      })
    } else {
      // 降级到普通跳转
      safeNavigateTo(url)
    }
  } catch (error) {
    console.error('切换Tab失败:', error)
    safeNavigateTo(url)
  }
}

/**
 * 安全重定向
 * @param url 目标页面路径
 */
export function safeRedirectTo(url: string) {
  try {
    if (typeof Taro.redirectTo === 'function') {
      Taro.redirectTo({
        url,
        success: () => {
          console.log('重定向成功:', url)
        },
        fail: (error) => {
          console.error('重定向失败:', error)
          // 降级到location替换
          if (typeof window !== 'undefined') {
            window.location.replace(url)
          }
        }
      })
    } else {
      // 降级到location替换
      if (typeof window !== 'undefined') {
        window.location.replace(url)
      }
    }
  } catch (error) {
    console.error('重定向失败:', error)
    if (typeof window !== 'undefined') {
      window.location.replace(url)
    }
  }
}

/**
 * 安全获取存储数据
 * @param key 存储键名
 * @param defaultValue 默认值
 */
export function safeGetStorage<T = any>(key: string, defaultValue: T | null = null): T | null {
  try {
    if (typeof Taro.getStorageSync === 'function') {
      const value = Taro.getStorageSync(key)
      return value !== undefined ? value : defaultValue
    } else if (typeof localStorage !== 'undefined') {
      const value = localStorage.getItem(key)
      return value ? JSON.parse(value) : defaultValue
    }
    return defaultValue
  } catch (error) {
    console.error('获取存储数据失败:', error)
    return defaultValue
  }
}

/**
 * 安全设置存储数据
 * @param key 存储键名
 * @param value 存储值
 */
export function safeSetStorage(key: string, value: any): boolean {
  try {
    if (typeof Taro.setStorageSync === 'function') {
      Taro.setStorageSync(key, value)
      return true
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    }
    return false
  } catch (error) {
    console.error('设置存储数据失败:', error)
    return false
  }
}

/**
 * 安全删除存储数据
 * @param key 存储键名
 */
export function safeRemoveStorage(key: string): boolean {
  try {
    if (typeof Taro.removeStorageSync === 'function') {
      Taro.removeStorageSync(key)
      return true
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
      return true
    }
    return false
  } catch (error) {
    console.error('删除存储数据失败:', error)
    return false
  }
}

/**
 * 安全显示加载中
 * @param title 加载提示文本
 */
export function safeShowLoading(title: string = '加载中...') {
  try {
    if (typeof Taro.showLoading === 'function') {
      Taro.showLoading({
        title,
        mask: true
      })
    } else {
      console.log(`Loading: ${title}`)
    }
  } catch (error) {
    console.error('显示加载中失败:', error)
  }
}

/**
 * 安全隐藏加载中
 */
export function safeHideLoading() {
  try {
    if (typeof Taro.hideLoading === 'function') {
      Taro.hideLoading()
    }
  } catch (error) {
    console.error('隐藏加载中失败:', error)
  }
}

/**
 * 安全获取系统信息
 */
export function safeGetSystemInfo(): Promise<any> {
  return new Promise((resolve) => {
    try {
      if (typeof Taro.getSystemInfo === 'function') {
        Taro.getSystemInfo({
          success: (res) => {
            resolve(res)
          },
          fail: () => {
            resolve(getWebSystemInfo())
          }
        })
      } else {
        resolve(getWebSystemInfo())
      }
    } catch (error) {
      console.error('获取系统信息失败:', error)
      resolve(getWebSystemInfo())
    }
  })
}

/**
 * 获取Web环境的系统信息
 */
function getWebSystemInfo() {
  try {
    return {
      brand: 'Web',
      model: navigator.userAgent,
      language: navigator.language,
      screenWidth: screen.width,
      screenHeight: screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      platform: 'web'
    }
  } catch {
    return {
      brand: 'Unknown',
      model: 'Unknown',
      language: 'zh-CN',
      screenWidth: 375,
      screenHeight: 667,
      windowWidth: 375,
      windowHeight: 667,
      platform: 'web'
    }
  }
}

/**
 * 防抖函数
 * @param func 要执行的函数
 * @param wait 等待时间
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 * @param func 要执行的函数
 * @param limit 限制时间
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 安全执行异步函数
 * @param asyncFunc 异步函数
 * @param errorHandler 错误处理函数
 */
export async function safeAsync<T>(
  asyncFunc: () => Promise<T>,
  errorHandler?: (error: any) => T | void
): Promise<T | void> {
  try {
    return await asyncFunc()
  } catch (error) {
    console.error('异步函数执行失败:', error)
    if (errorHandler) {
      return errorHandler(error)
    }
  }
}
