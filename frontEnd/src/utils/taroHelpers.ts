// Taro API 安全调用工具类
import Taro from '@tarojs/taro'
import { TIME_CONSTANTS } from './constants'

// 常量定义
export const CONSTANTS = {
  // 消息长度限制
  MAX_MESSAGE_LENGTH: 500,
  
  // 重试次数限制
  MAX_RETRY_COUNT: 3,
  
  // 分页配置
  QUESTIONS_PER_PAGE: 5,
  
  // 超时配置
  SCROLL_DELAY: 100,
  
  // 客服电话
  CUSTOMER_SERVICE_PHONE: '400-123-4567',
  
  // 时间常量
  ONE_DAY_MS: TIME_CONSTANTS.ONE_DAY,
  TWO_DAYS_MS: TIME_CONSTANTS.TWO_DAYS,
}

// 错误消息常量
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接异常，请检查网络后重试 🌐',
  API_ERROR: 'AI服务暂时不可用，请稍后再试 🤖',
  TIMEOUT_ERROR: '请求超时，请重新发送消息 ⏰',
  UNKNOWN_ERROR: '发生未知错误，如需帮助请联系人工客服 📞',
  MESSAGE_TOO_LONG: '消息过长，请精简后发送',
  RETRY_LIMIT_EXCEEDED: '重试次数过多，请稍后再试',
}

// Taro API 安全调用封装
export class TaroHelper {
  /**
   * 安全显示Toast
   */
  static showToast(options: Taro.showToast.Option): void {
    try {
      if (this.isApiAvailable('showToast')) {
        Taro.showToast(options)
      } else {
        console.log('Toast:', options.title)
      }
    } catch (error) {
      console.log('Toast:', options.title)
    }
  }

  /**
   * 安全隐藏Toast
   */
  static hideToast(): void {
    try {
      if (this.isApiAvailable('hideToast')) {
        Taro.hideToast()
      } else {
        console.log('隐藏Toast')
      }
    } catch (error) {
      console.log('隐藏Toast失败')
    }
  }

  /**
   * 安全显示Modal
   */
  static showModal(options: Taro.showModal.Option): void {
    try {
      if (this.isApiAvailable('showModal')) {
        Taro.showModal(options)
      } else {
        const result = window.confirm(`${options.title}\n${options.content}`)
        options.success?.({ confirm: result, cancel: !result } as any)
      }
    } catch (error) {
      const result = window.confirm(`${options.title}\n${options.content}`)
      options.success?.({ confirm: result, cancel: !result } as any)
    }
  }

  /**
   * 安全拨打电话
   */
  static makePhoneCall(phoneNumber: string): void {
    try {
      if (this.isApiAvailable('makePhoneCall')) {
        Taro.makePhoneCall({
          phoneNumber,
          success: () => console.log('拨打电话成功'),
          fail: (err) => console.error('拨打电话失败:', err)
        })
      } else {
        window.open(`tel:${phoneNumber}`)
      }
    } catch (error) {
      console.error('拨打电话失败:', error)
      window.open(`tel:${phoneNumber}`)
    }
  }

  /**
   * 检查API是否可用
   */
  private static isApiAvailable(apiName: string): boolean {
    return Taro[apiName] && typeof Taro[apiName] === 'function'
  }
}

// 错误处理工具
export class ErrorHandler {
  /**
   * 获取错误消息
   */
  static getErrorMessage(error: any): string {
    if (this.isNetworkError(error)) {
      return ERROR_MESSAGES.NETWORK_ERROR
    }
    if (this.isTimeoutError(error)) {
      return ERROR_MESSAGES.TIMEOUT_ERROR
    }
    if (this.isAuthError(error)) {
      return ERROR_MESSAGES.API_ERROR
    }
    return ERROR_MESSAGES.UNKNOWN_ERROR + '\n\n📞 人工客服：' + CONSTANTS.CUSTOMER_SERVICE_PHONE
  }

  /**
   * 判断是否为网络错误
   */
  private static isNetworkError(error: any): boolean {
    return error.name === 'TypeError' || error.message?.includes('fetch')
  }

  /**
   * 判断是否为超时错误
   */
  private static isTimeoutError(error: any): boolean {
    return error.message?.includes('timeout')
  }

  /**
   * 判断是否为认证错误
   */
  private static isAuthError(error: any): boolean {
    return error.message?.includes('401') || error.message?.includes('403')
  }
}

// 时间格式化工具
export class TimeFormatter {
  /**
   * 格式化时间戳为可读时间
   */
  static formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - timestamp
    
    // 如果是今天
    if (diff < CONSTANTS.ONE_DAY_MS) {
      return this.formatTimeOnly(date)
    }
    
    // 如果是昨天
    if (diff < CONSTANTS.TWO_DAYS_MS) {
      return `昨天 ${this.formatTimeOnly(date)}`
    }
    
    // 更早的日期
    return `${date.getMonth() + 1}/${date.getDate()} ${this.formatTimeOnly(date)}`
  }

  /**
   * 格式化时间部分
   */
  private static formatTimeOnly(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }
}

// 工具函数
export const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 验证工具
export class Validator {
  /**
   * 验证消息长度
   */
  static isMessageTooLong(message: string): boolean {
    return message.length > CONSTANTS.MAX_MESSAGE_LENGTH
  }

  /**
   * 验证重试次数
   */
  static canRetry(retryCount: number): boolean {
    return retryCount < CONSTANTS.MAX_RETRY_COUNT
  }
}