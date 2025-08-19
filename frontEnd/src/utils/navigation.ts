// 安全的导航工具
import { TaroSafe } from './taroSafe'

export const navigation = {
  // 跳转到新页面
  navigateTo: (url: string) => {
    try {
      return TaroSafe.navigateTo({ url })
    } catch (error) {
      console.warn('页面跳转失败:', error)
      return Promise.resolve()
    }
  },

  // 重定向到新页面
  redirectTo: (url: string) => {
    try {
      return TaroSafe.redirectTo({ url })
    } catch (error) {
      console.warn('页面重定向失败:', error)
      return Promise.resolve()
    }
  },

  // 切换到Tab页面
  switchTab: (url: string) => {
    try {
      return TaroSafe.switchTab({ url })
    } catch (error) {
      console.warn('Tab切换失败:', error)
      return Promise.resolve()
    }
  },

  // 返回上一页
  navigateBack: (delta: number = 1) => {
    try {
      if (TaroSafe.ENV.isH5 && window.history) {
        window.history.go(-delta)
        return Promise.resolve()
      }
      return TaroSafe.safeCall('navigateBack', { delta })
    } catch (error) {
      console.warn('页面返回失败:', error)
      return Promise.resolve()
    }
  }
}

export default navigation