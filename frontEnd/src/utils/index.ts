import Taro from '@tarojs/taro'

/**
 * 格式化时间
 * @param date 日期对象或时间戳
 * @param format 格式字符串，默认 'YYYY-MM-DD HH:mm:ss'
 */
export const formatTime = (date: Date | number, format = 'YYYY-MM-DD HH:mm:ss'): string => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second)
}

/**
 * 格式化持续时间（秒转换为可读格式）
 * @param seconds 秒数
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  } else if (minutes > 0) {
    return `${minutes}分钟${secs}秒`
  } else {
    return `${secs}秒`
  }
}

/**
 * 格式化金额
 * @param amount 金额（分）
 * @param showSymbol 是否显示货币符号
 */
export const formatAmount = (amount: number, showSymbol = true): string => {
  const yuan = (amount / 100).toFixed(2)
  return showSymbol ? `¥${yuan}` : yuan
}

/**
 * 格式化距离
 * @param distance 距离（米）
 */
export const formatDistance = (distance: number): string => {
  if (distance < 1000) {
    return `${Math.round(distance)}m`
  } else {
    return `${(distance / 1000).toFixed(1)}km`
  }
}

/**
 * 防抖函数
 * @param func 要防抖的函数
 * @param wait 等待时间（毫秒）
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * 节流函数
 * @param func 要节流的函数
 * @param wait 等待时间（毫秒）
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null
  let previous = 0
  
  return (...args: Parameters<T>) => {
    const now = Date.now()
    const remaining = wait - (now - previous)
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      func(...args)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now()
        timeout = null
        func(...args)
      }, remaining)
    }
  }
}

/**
 * 深拷贝
 * @param obj 要拷贝的对象
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T
  }
  
  if (typeof obj === 'object') {
    const clonedObj = {} as T
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
  
  return obj
}

/**
 * 生成唯一ID
 */
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * 验证手机号
 * @param phone 手机号
 */
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

/**
 * 验证邮箱
 * @param email 邮箱
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 获取文件扩展名
 * @param filename 文件名
 */
export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2)
}

/**
 * 计算两点间距离（米）
 * @param lat1 纬度1
 * @param lng1 经度1
 * @param lat2 纬度2
 * @param lng2 经度2
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371e3 // 地球半径（米）
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * 显示Toast消息
 * @param title 消息内容
 * @param icon 图标类型
 */
export const showToast = (title: string, icon: 'success' | 'error' | 'loading' | 'none' = 'none') => {
  Taro.showToast({
    title,
    icon,
    duration: 2000
  })
}

/**
 * 显示加载中
 * @param title 加载文本
 */
export const showLoading = (title = '加载中...') => {
  Taro.showLoading({ title })
}

/**
 * 隐藏加载中
 */
export const hideLoading = () => {
  Taro.hideLoading()
}

/**
 * 显示确认对话框
 * @param content 对话框内容
 * @param title 对话框标题
 */
export const showConfirm = (content: string, title = '提示'): Promise<boolean> => {
  return new Promise((resolve) => {
    Taro.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm)
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

export interface GpsLocationResult {
	lng: number
	lat: number
	accuracy?: number
	source: 'amap_geolocation' | 'browser_gps_conv'
}

/**
 * 获取当前设备位置（H5），优先使用高德 JSAPI Geolocation，失败回退浏览器 geolocation 并做坐标转换
 * 需要在调用前在 H5 环境设置 window._AMapSecurityConfig 和 AMapLoader Key（见 map/device.tsx 的示例）
 */
export async function getCurrentGpsByAMap(options?: { timeoutMs?: number }): Promise<GpsLocationResult> {
	const timeout = options?.timeoutMs ?? 20000
	// 确保 AMap 已加载
	if (typeof window !== 'undefined' && (window as any).AMap) {
		try {
			const AMap = (window as any).AMap
			await new Promise<void>((resolve) => setTimeout(resolve, 0))
			return await new Promise<GpsLocationResult>((resolve, reject) => {
				const geo = new AMap.Geolocation({ enableHighAccuracy: true, timeout, showButton: false, showCircle: false })
				geo.getCurrentPosition((status: string, result: any) => {
					if (status === 'complete' && result?.position) {
						resolve({ lng: result.position.lng, lat: result.position.lat, accuracy: result.accuracy, source: 'amap_geolocation' })
					} else {
						reject(new Error('AMap geolocation failed'))
					}
				})
			})
		} catch {}
	}

	// 回退到浏览器定位 + 坐标转换
	if (typeof navigator !== 'undefined' && navigator.geolocation && (window as any).AMap) {
		return await new Promise<GpsLocationResult>((resolve, reject) => {
			const id = navigator.geolocation.getCurrentPosition(
				(pos) => {
					const { longitude, latitude, accuracy } = pos.coords
					;(window as any).AMap.convertFrom([longitude, latitude], 'gps', (status: string, result: any) => {
						if (status === 'complete' && result?.locations?.length) {
							const p = result.locations[0]
							resolve({ lng: p.lng, lat: p.lat, accuracy, source: 'browser_gps_conv' })
						} else {
							reject(new Error('convertFrom failed'))
						}
					})
				},
				(err) => reject(err),
				{ enableHighAccuracy: true, timeout, maximumAge: 0 }
			)
		})
	}

	throw new Error('No geolocation available or AMap not loaded')
}