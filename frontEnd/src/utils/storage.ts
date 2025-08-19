// 安全的存储工具
import { TaroSafe } from './taroSafe'

export const storage = {
  // 同步获取
  getSync: (key: string, defaultValue: any = null) => {
    try {
      const value = TaroSafe.getStorageSync(key)
      return value !== '' ? value : defaultValue
    } catch (error) {
      console.warn(`获取存储失败 (${key}):`, error)
      return defaultValue
    }
  },

  // 同步设置
  setSync: (key: string, value: any) => {
    try {
      TaroSafe.setStorageSync(key, value)
      return true
    } catch (error) {
      console.warn(`设置存储失败 (${key}):`, error)
      return false
    }
  },

  // 同步删除
  removeSync: (key: string) => {
    try {
      TaroSafe.removeStorageSync(key)
      return true
    } catch (error) {
      console.warn(`删除存储失败 (${key}):`, error)
      return false
    }
  },

  // 异步获取
  get: async (key: string, defaultValue: any = null) => {
    try {
      const value = await TaroSafe.getStorageSync(key) // 在H5环境下实际上是同步的
      return value !== '' ? value : defaultValue
    } catch (error) {
      console.warn(`异步获取存储失败 (${key}):`, error)
      return defaultValue
    }
  },

  // 异步设置
  set: async (key: string, value: any) => {
    try {
      TaroSafe.setStorageSync(key, value) // 在H5环境下实际上是同步的
      return true
    } catch (error) {
      console.warn(`异步设置存储失败 (${key}):`, error)
      return false
    }
  },

  // 异步删除
  remove: async (key: string) => {
    try {
      TaroSafe.removeStorageSync(key) // 在H5环境下实际上是同步的
      return true
    } catch (error) {
      console.warn(`异步删除存储失败 (${key}):`, error)
      return false
    }
  }
}

export default storage