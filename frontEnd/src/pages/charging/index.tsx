import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Button, Input } from '@tarojs/components'
import TaroCompat from '../../utils/taroCompat'
import './index.scss'
import { WalletInfo, Transaction } from '../../utils/walletService'
import MobileDetect from '../../utils/mobileDetect'
import dataJson from './data.json'
import dataManager from '../../utils/dataManager'

// 优惠券接口
interface Coupon {
  id: string
  title: string
  discount: string
  description: string
  status: 'active' | 'used' | 'expired'
  expiryDate: string
  usedDate?: string
  minAmount: number
}

// 电池状态接口
interface BatteryStatus {
  level: number // 0-1
  charging: boolean
  chargingTime: number
  dischargingTime: number
  isSupported: boolean
}

// 充电样式级别
type ChargingStyleLevel = 'low' | 'medium' | 'high' | 'critical'

// 电池主题接口
interface BatteryTheme {
  name: 'high' | 'medium' | 'low' | 'critical' | 'charging'
  level: number // 0-100
  charging: boolean
  gradient: string
  shadowColor: string
  textColor: string
}

export default function Charging() {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'balance' | 'coupons'>('balance')
  const [selectedAmount, setSelectedAmount] = useState<string>('')
  const [customAmount, setCustomAmount] = useState<string>('')
  // 支付方式固定为支付宝，无需选择状态
  const [showRechargeModal, setShowRechargeModal] = useState(false)
  // 交易详情弹窗状态
  const [showTransactionDetail, setShowTransactionDetail] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  // 优惠券选择状态
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
  const [showCouponSelector, setShowCouponSelector] = useState(false)

  // 电量变化状态集 - 用于存储2分钟内的电量变化数据
  const [batteryChangeHistory, setBatteryChangeHistory] = useState<Array<{
    level: number
    timestamp: number
    charging: boolean
  }>>([])

  // 智能预测状态管理
  const [smartPrediction, setSmartPrediction] = useState<string>('🤖 等待电量数据收集完成...')
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [lastPredictionTime, setLastPredictionTime] = useState<number>(0)
  const [lastPredictionResult, setLastPredictionResult] = useState<string>('')
  const [lastClickTime, setLastClickTime] = useState<number>(0)
  
  // 电池状态管理
  const [batteryStatus, setBatteryStatus] = useState<BatteryStatus | null>(null)
  const [batteryInitialized, setBatteryInitialized] = useState(false)
  const [batteryTheme, setBatteryTheme] = useState<BatteryTheme | null>(null)
  const [showBatteryInfo, setShowBatteryInfo] = useState(false)

  // 初始化电池 API（带重试机制）
  const initBatteryAPI = useCallback(async (retryCount = 0) => {
    const maxRetries = 3
    const retryDelay = 1000 * (retryCount + 1) // 递增延迟：1s, 2s, 3s
    
    try {
      // 检查浏览器是否支持 Battery Status API
      if ('getBattery' in navigator) {
        console.log(`🔋 Battery Status API 初始化尝试 ${retryCount + 1}/${maxRetries + 1}...`)
        
        // 添加延迟，确保 API 准备就绪
        if (retryCount > 0) {
          console.log(`⏳ 等待 ${retryDelay}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
        
        const battery = await (navigator as any).getBattery()
        
        // 验证电池对象是否有效
        if (!battery || typeof battery.level !== 'number') {
          throw new Error('Battery object is invalid')
        }
        
        // 更新电池状态
        const updateBatteryStatus = () => {
          // 验证电池数据的有效性
          if (typeof battery.level !== 'number' || battery.level < 0 || battery.level > 1) {
            console.warn('⚠️ 电池数据无效，跳过更新')
            return
          }
          
          const newStatus: BatteryStatus = {
            level: battery.level,
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime,
            isSupported: true
          }
          
          // 防止重复设置相同的状态
          setBatteryStatus(prevStatus => {
            if (prevStatus && 
                Math.abs(prevStatus.level - newStatus.level) < 0.01 && 
                prevStatus.charging === newStatus.charging) {
              return prevStatus // 返回之前的状态，避免不必要的更新
            }
            return newStatus
          })
          
          updateBatteryTheme(newStatus)
          
          // 只在第一次成功时设置为已初始化
          if (!batteryInitialized) {
            setBatteryInitialized(true)
          }
          
          console.log('🔋 电池状态更新成功:', {
            level: Math.round(battery.level * 100) + '%',
            charging: battery.charging ? '充电中' : '未充电',
            chargingTime: battery.chargingTime === Infinity ? '未知' : `${Math.round(battery.chargingTime / 60)}分钟`,
            dischargingTime: battery.dischargingTime === Infinity ? '未知' : `${Math.round(battery.dischargingTime / 3600)}小时`
          })
        }
        
        // 初始状态更新
        updateBatteryStatus()
        
        // 监听电池状态变化
        battery.addEventListener('levelchange', updateBatteryStatus)
        battery.addEventListener('chargingchange', updateBatteryStatus)
        battery.addEventListener('chargingtimechange', updateBatteryStatus)
        battery.addEventListener('dischargingtimechange', updateBatteryStatus)
        
        // 成功提示
        TaroCompat.showToast({
          title: `🔋 电池主题已激活 ${Math.round(battery.level * 100)}%`,
          icon: 'success',
          duration: 2000
        })
        
        return // 成功初始化，退出函数
        
      } else {
        console.warn('⚠️ 当前浏览器不支持 Battery Status API')
        
        // 使用基于时间的智能推测作为降级方案
        const hour = new Date().getHours()
        let estimatedLevel = 0.75 // 默认75%
        
        // 基于时间智能推测电量
        if (hour >= 6 && hour <= 9) {
          // 早上：通常电量较高
          estimatedLevel = 0.8 + Math.random() * 0.2 // 80-100%
        } else if (hour >= 10 && hour <= 18) {
          // 白天：中等电量
          estimatedLevel = 0.4 + Math.random() * 0.4 // 40-80%
        } else if (hour >= 19 && hour <= 23) {
          // 晚上：电量较低
          estimatedLevel = 0.2 + Math.random() * 0.4 // 20-60%
        } else {
          // 深夜：电量很低或在充电
          estimatedLevel = 0.1 + Math.random() * 0.3 // 10-40%
        }
        
        const fallbackStatus: BatteryStatus = {
          level: estimatedLevel,
          charging: false,
          chargingTime: Infinity,
          dischargingTime: Infinity,
          isSupported: false
        }
        setBatteryStatus(fallbackStatus)
        updateBatteryTheme(fallbackStatus)
        setBatteryInitialized(true)
        
        TaroCompat.showToast({
          title: `⚠️ 模拟电量 ${Math.round(estimatedLevel * 100)}%`,
          icon: 'none',
          duration: 2000
        })
        return
      }
    } catch (error) {
      console.error(`❌ Battery API 初始化失败 (尝试 ${retryCount + 1}):`, error)
      
      // 如果还有重试次数，则重试
      if (retryCount < maxRetries) {
        console.log(`🔄 ${retryDelay}ms 后进行第 ${retryCount + 2} 次尝试...`)
        setTimeout(() => {
          initBatteryAPI(retryCount + 1)
        }, retryDelay)
        return
      }
      
      // 所有重试都失败了，使用智能默认值
      console.error('💥 所有重试都失败，使用智能默认值')
      
      // 基于时间的智能推测
      const hour = new Date().getHours()
      let fallbackLevel = 0.6 // 基础60%
      
      if (hour >= 7 && hour <= 10) fallbackLevel = 0.85  // 早上高电量
      else if (hour >= 11 && hour <= 17) fallbackLevel = 0.65  // 白天中等
      else if (hour >= 18 && hour <= 22) fallbackLevel = 0.35  // 晚上较低
      else fallbackLevel = 0.25  // 深夜低电量
      
      const errorStatus: BatteryStatus = {
        level: fallbackLevel,
        charging: false,
        chargingTime: Infinity,
        dischargingTime: Infinity,
        isSupported: false
      }
      setBatteryStatus(errorStatus)
      updateBatteryTheme(errorStatus)
      setBatteryInitialized(true)
      
      TaroCompat.showToast({
        title: `🤖 智能推测 ${Math.round(fallbackLevel * 100)}%`,
        icon: 'none',
        duration: 2000
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 获取充电样式级别
  const getChargingStyleLevel = (level: number): ChargingStyleLevel => {
    if (level >= 80) return 'high'
    if (level >= 50) return 'medium'
    if (level >= 20) return 'low'
    return 'critical'
  }

  // 智能预测时间函数
  const getSmartPredictionTime = useCallback(async (): Promise<string> => {
    if (!batteryTheme || !batteryInitialized) {
      return '⏳ 计算中...'
    }

    const currentLevel = batteryTheme.level
    const isCharging = batteryTheme.charging
    const currentTime = Date.now()
    
    // 更新电量变化历史
    setBatteryChangeHistory(prevHistory => {
      const newHistory = [
        ...prevHistory,
        {
          level: currentLevel,
          timestamp: currentTime,
          charging: isCharging
        }
      ]
      
      // 只保留最近2分钟的数据
      const twoMinutesAgo = currentTime - 2 * 60 * 1000
      return newHistory.filter(item => item.timestamp > twoMinutesAgo)
    })

    // 获取当前的电量变化历史
    const currentHistory = batteryChangeHistory
    
    // 检查是否有足够的数据进行预测（需要2分钟的数据）
    const hasEnoughData = currentHistory.length >= 2 && 
      (currentTime - currentHistory[0].timestamp) >= 2 * 60 * 1000
    
    if (!hasEnoughData) {
      const remainingTime = Math.max(0, 2 * 60 * 1000 - (currentTime - (currentHistory[0]?.timestamp || currentTime)))
      const remainingSeconds = Math.ceil(remainingTime / 1000)
      return `🤖 正在收集电量数据中... (还需${remainingSeconds}秒)`
    }
    
    // 检查长时间预测频率限制（每4分钟只能预测一次，但只在短时间内重复点击时检查）
    const timeSinceLastPrediction = currentTime - lastPredictionTime
    const timeSinceLastClick = currentTime - lastClickTime
    if (lastClickTime > 0 && timeSinceLastClick < 2 * 60 * 1000 && timeSinceLastPrediction < 4 * 60 * 1000) {
      const remainingTime = 4 * 60 * 1000 - timeSinceLastPrediction
      const remainingMinutes = Math.ceil(remainingTime / 60)
      return `⏳ 预测冷却中... (${remainingMinutes}分钟后可再次预测)`
    }
    
    try {
      // 构建智能预测请求，包含电量变化历史
      const predictionPrompt = `基于以下电池状态信息和电量变化历史，请智能预测并返回简洁的充电/续航时间：

当前电量: ${currentLevel}%
充电状态: ${isCharging ? '正在充电' : '未充电'}
当前时间: ${new Date().toLocaleString('zh-CN')}

电量变化历史（最近2分钟）:
${currentHistory.length > 0 ? 
  currentHistory.map((item, index) => 
    `${index + 1}. ${new Date(item.timestamp).toLocaleTimeString()}: ${item.level}% ${item.charging ? '充电中' : '使用中'}`
  ).join('\n') : 
  '暂无历史数据'
}

电量变化趋势分析:
${currentHistory.length >= 2 ? 
  (() => {
    const first = currentHistory[0]
    const last = currentHistory[currentHistory.length - 1]
    const timeDiff = (last.timestamp - first.timestamp) / 1000 / 60 // 分钟
    const levelDiff = last.level - first.level
    const changeRate = levelDiff / timeDiff // 每分钟变化率
    
    if (isCharging) {
      return `充电速度: ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}%/分钟`
      } else {
      return `耗电速度: ${changeRate < 0 ? '' : '-'}${Math.abs(changeRate).toFixed(2)}%/分钟`
    }
  })() : 
  '需要更多数据进行分析'
}

请根据以上信息，结合电池特性、使用习惯、时间段等因素，返回一个准确的预测结果。
格式要求：
- 充电状态：返回"⚡ X小时Y分钟后充满"或"⚡ X分钟后充满"
- 使用状态：返回"🔋 X小时后耗尽"或"🔋 X天后耗尽"
- 保持简洁，避免过长描述
- 只返回预测结果，不要其他解释

请直接返回预测结果：`

      // 调用 GPT-3.5-turbo API (使用您的免费代理服务)
      const response = await fetch('https://free.v36.cm/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-jcqcc71pkFwLcp2r0e2aBc6174834417B7F32d148c786773'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: predictionPrompt
            }
          ],
          max_tokens: 80,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`AI API 调用失败: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const prediction = data.choices?.[0]?.message?.content?.trim()
      
      if (prediction) {
        console.log('🤖 AI 智能预测结果:', prediction)
        console.log('📊 电量变化历史:', currentHistory)
        // 更新最后预测时间和结果
        setLastPredictionTime(currentTime)
        setLastPredictionResult(prediction)
        return prediction
        } else {
        throw new Error('AI 返回结果为空')
      }

    } catch (error) {
      console.warn('AI 智能预测失败，使用基于历史数据的备用方案:', error)
      console.log('错误详情:', error)
      
      // 基于历史数据的备用方案
      if (currentHistory.length >= 2) {
        const first = currentHistory[0]
        const last = currentHistory[currentHistory.length - 1]
        const timeDiff = (last.timestamp - first.timestamp) / 1000 / 60 // 分钟
        const levelDiff = last.level - first.level
        const changeRate = levelDiff / timeDiff // 每分钟变化率
        
        // 更新最后预测时间和结果（备用方案也算作一次预测）
        setLastPredictionTime(currentTime)
        
        // 基于历史数据生成备用预测结果
        if (isCharging) {
          // 基于实际充电速度计算
          if (changeRate > 0) {
            const remainingLevel = 100 - currentLevel
            const estimatedMinutes = Math.round(remainingLevel / changeRate)
            
            if (estimatedMinutes < 60) {
              return `⚡ ${estimatedMinutes}分钟后充满 (基于实际充电速度)`
            } else {
              const hours = Math.floor(estimatedMinutes / 60)
              const minutes = estimatedMinutes % 60
              return `⚡ ${hours}小时${minutes}分钟后充满 (基于实际充电速度)`
            }
          } else {
            // 充电速度异常，使用备用方案
            return `⚡ 充电速度异常，请检查充电器`
          }
        } else {
          // 基于实际耗电速度计算
          if (changeRate < 0) {
            const estimatedMinutes = Math.round(currentLevel / Math.abs(changeRate))
            
            if (estimatedMinutes < 60) {
              return `🔋 ${estimatedMinutes}分钟后耗尽 (基于实际耗电速度)`
            } else if (estimatedMinutes >= 1440) { // 24小时 = 1440分钟
              const days = Math.floor(estimatedMinutes / 1440)
              return `🔋 ${days}天后耗尽 (基于实际耗电速度)`
            } else {
              const hours = Math.floor(estimatedMinutes / 60)
              return `🔋 ${hours}小时后耗尽 (基于实际耗电速度)`
            }
          } else {
            // 耗电速度异常，使用备用方案
            return `🔋 耗电速度异常，请检查应用使用情况`
          }
        }
      }
      
      // 如果没有足够的历史数据，使用原生电池API或简化估算
      if (isCharging && batteryStatus?.isSupported && batteryStatus.chargingTime !== Infinity) {
        const chargingMinutes = Math.round(batteryStatus.chargingTime / 60)
        if (chargingMinutes < 60) {
          return `⚡ ${chargingMinutes}分钟后充满 (原生API)`
        } else {
          const hours = Math.floor(chargingMinutes / 60)
          const minutes = chargingMinutes % 60
          return `⚡ ${hours}小时${minutes}分钟后充满 (原生API)`
        }
      } else if (!isCharging && batteryStatus?.isSupported && batteryStatus.dischargingTime !== Infinity) {
        const dischargingHours = Math.round(batteryStatus.dischargingTime / 3600)
        if (dischargingHours < 1) {
          const minutes = Math.round(batteryStatus.dischargingTime / 60)
          return `🔋 ${minutes}分钟后耗尽 (原生API)`
        } else if (dischargingHours >= 24) {
          const days = Math.floor(dischargingHours / 24)
          return `🔋 ${days}天后耗尽 (原生API)`
        } else {
          return `🔋 ${dischargingHours}小时后耗尽`
        }
      } else {
        // 最后的备用方案：基于电量的简单估算
        if (isCharging) {
          const remainingLevel = 100 - currentLevel
          const estimatedHours = Math.max(0.5, remainingLevel / 20) // 简单估算
          if (estimatedHours < 1) {
            return `⚡ ${Math.round(estimatedHours * 60)}分钟后充满 (估算)`
          } else {
            return `⚡ ${estimatedHours.toFixed(1)}小时后充满 (估算)`
          }
        } else {
          const estimatedHours = Math.max(0.5, currentLevel / 10) // 简单估算
          if (estimatedHours < 1) {
            return `🔋 ${Math.round(estimatedHours * 60)}分钟后耗尽 (估算)`
          } else if (estimatedHours >= 24) {
            const days = Math.floor(estimatedHours / 24)
            return `🔋 ${days}天后耗尽 (估算)`
          } else {
            return `🔋 ${estimatedHours.toFixed(1)}小时后耗尽 (估算)`
          }
        }
      }
    }
    
    // 如果以上所有条件都不满足，返回默认值
    return '⏳ 计算中...'
  }, [batteryTheme, batteryStatus, batteryInitialized, batteryChangeHistory, lastClickTime, lastPredictionTime])

  // 更新智能预测
  const updateSmartPrediction = useCallback(async () => {
    if (!batteryTheme || !batteryInitialized) return
    
    // 更新最后点击时间
    setLastClickTime(Date.now())
    
    setPredictionLoading(true)
    try {
      const prediction = await getSmartPredictionTime()
      setSmartPrediction(prediction)
    } catch (error) {
      console.error('智能预测更新失败:', error)
      setSmartPrediction('❌ 预测失败，点击重试')
    } finally {
      setPredictionLoading(false)
    }
  }, [getSmartPredictionTime, batteryTheme, batteryInitialized])

  // 当电池状态变化时更新预测
  useEffect(() => {
    if (batteryInitialized) {
      // 延迟一下再更新，避免页面加载时立即调用API
      const timer = setTimeout(() => {
        updateSmartPrediction()
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [batteryInitialized, updateSmartPrediction])

  // 定期收集电量变化数据（每10秒收集一次）
  useEffect(() => {
    if (!batteryInitialized || !batteryTheme) return
    
    const interval = setInterval(() => {
      // 只收集数据，不触发预测
      const currentTime = Date.now()
      const currentLevel = batteryTheme.level
      const isCharging = batteryTheme.charging
      
      setBatteryChangeHistory(prevHistory => {
        const newHistory = [
          ...prevHistory,
          {
            level: currentLevel,
            timestamp: currentTime,
            charging: isCharging
          }
        ]
        
        // 只保留最近2分钟的数据
        const twoMinutesAgo = currentTime - 2 * 60 * 1000
        return newHistory.filter(item => item.timestamp > twoMinutesAgo)
      })
    }, 10000) // 10秒
    
    return () => clearInterval(interval)
  }, [batteryInitialized, batteryTheme])

  // 更新电池主题
  const updateBatteryTheme = useCallback((status: BatteryStatus) => {
    const levelPercent = Math.round(status.level * 100)
    let themeName: BatteryTheme['name']
    let gradient: string
    let shadowColor: string
    let textColor: string = '#ffffff'

    if (status.charging) {
      // 充电状态主题 - 根据电量级别调整
      themeName = 'charging'
      const chargingLevel = getChargingStyleLevel(levelPercent)
      
      switch (chargingLevel) {
        case 'high':
          gradient = 'linear-gradient(135deg, #10b981 0%, #059669 30%, #047857 60%, #065f46 100%)'
          shadowColor = 'rgba(16, 185, 129, 0.5)'
          break
        case 'medium':
          gradient = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 30%, #1d4ed8 60%, #1e40af 100%)'
          shadowColor = 'rgba(59, 130, 246, 0.5)'
          break
        case 'low':
          gradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 30%, #b45309 60%, #92400e 100%)'
          shadowColor = 'rgba(245, 158, 11, 0.5)'
          break
        case 'critical':
          gradient = 'linear-gradient(135deg, #ef4444 0%, #dc2626 30%, #b91c1c 60%, #991b1b 100%)'
          shadowColor = 'rgba(239, 68, 68, 0.6)'
          break
      }
    } else {
      // 根据电量级别设置主题
      if (levelPercent >= 80) {
        themeName = 'high'
        gradient = 'linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)'
        shadowColor = 'rgba(34, 197, 94, 0.3)'
      } else if (levelPercent >= 50) {
        themeName = 'medium'
        gradient = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)'
        shadowColor = 'rgba(37, 99, 235, 0.3)'
      } else if (levelPercent >= 20) {
        themeName = 'low'
        gradient = 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%)'
        shadowColor = 'rgba(234, 88, 12, 0.3)'
      } else {
        themeName = 'critical'
        gradient = 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)'
        shadowColor = 'rgba(220, 38, 38, 0.4)'
      }
    }

    const newTheme: BatteryTheme = {
      name: themeName,
      level: levelPercent,
      charging: status.charging,
      gradient,
      shadowColor,
      textColor
    }

    setBatteryTheme(newTheme)
  }, [])

  // 获取电池主题样式
  const getBatteryCardStyle = () => {
    if (!batteryTheme) {
      // 初始化时的默认样式
      return {
        background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%)',
        boxShadow: '0 8px 32px rgba(107, 114, 128, 0.3)',
        color: '#ffffff',
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
    
    return {
      background: batteryTheme.gradient,
      boxShadow: `0 8px 32px ${batteryTheme.shadowColor}`,
      color: batteryTheme.textColor,
      transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
    }
  }

  // 获取电池主题类名
  const getBatteryThemeClass = () => {
    let baseClass = 'balance-card battery-theme'
    
    if (!batteryTheme) {
      return `${baseClass} battery-loading`
    }
    
    baseClass += ` battery-${batteryTheme.name}`
    
    if (batteryTheme.charging) {
      const chargingLevel = getChargingStyleLevel(batteryTheme.level)
      baseClass += ` charging-active charging-${chargingLevel}`
    }
    
    if (batteryTheme.name === 'critical') {
      baseClass += ' critical-pulse'
    }
    
    return baseClass
  }

  // 加载钱包数据 - 从dataManager获取最新数据
  const loadWalletData = useCallback(async () => {
    try {
      setLoading(true)
      console.log('🔄 加载钱包数据：从dataManager获取最新数据...')

      // 从dataManager获取最新数据（替换原有的dataJson直接引用）
      const currentData = dataManager.getData()
      const currentBalance = dataManager.getBalance()
      const currentTransactions = dataManager.getTransactions()

      // 保持原有的统计计算逻辑
      const rechargeTransactions = currentTransactions.filter(t => t.type === 'recharge')
      const consumeTransactions = currentTransactions.filter(t => t.type === 'consume')

      const totalRecharge = rechargeTransactions.reduce((sum, t) => sum + t.amount, 0)
      const totalConsume = consumeTransactions.reduce((sum, t) => sum + t.amount, 0)

      // 保持原有的钱包信息设置逻辑
        setWalletInfo({
        balance: currentBalance,
          frozenAmount: 0,
        availableBalance: currentBalance,
        totalRecharge: totalRecharge,
        totalConsume: totalConsume,
          paymentMethods: [
          { id: 'alipay', type: 'alipay', name: '支付宝', isDefault: true, isEnabled: true }
          ],
          settings: {
          defaultPaymentMethod: 'alipay'
        }
      })

      // 设置交易记录（使用dataManager的数据）
      setTransactions(currentTransactions)

      // 保持原有的优惠券数据加载
      setCoupons(currentData.coupons)

      console.log('✅ 钱包数据加载完成:', {
        余额: currentBalance,
        交易记录: currentTransactions.length,
        优惠券: currentData.coupons.length,
        总充值: totalRecharge,
        总消费: totalConsume
      })
      
    } catch (error) {
      console.error('❌ 加载数据失败:', error)
      TaroCompat.showToast({
        title: '数据加载失败',
        icon: 'error'
      })
    } finally {
      setLoading(false)
    }
  }, [])



  // 主初始化useEffect - 合并重复代码
  useEffect(() => {
    // 初始化移动端优化
    MobileDetect.init()
    
    loadWalletData()
    
    // 延迟初始化电池状态监听，确保页面完全加载
    const timer = setTimeout(() => {
      initBatteryAPI()
    }, 500) // 500ms延迟，确保页面稳定
    
    // 监听屏幕方向变化
    MobileDetect.onOrientationChange((orientation) => {
      console.log('屏幕方向变化:', orientation)
    })
    
    // 定期检查数据更新（每2秒检查一次）
    const dataCheckInterval = setInterval(() => {
      // 检查 localStorage 中的数据是否有更新
      const storedData = localStorage.getItem('walletData')
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData)
          const currentBalance = dataManager.getBalance()
          if (parsedData.walletBalance.amount !== currentBalance) {
            console.log('🔄 检测到数据更新，重新加载钱包数据...')
            loadWalletData()
          }
        } catch (error) {
          console.warn('检查数据更新失败:', error)
        }
      }
    }, 2000)
    
    return () => {
      clearTimeout(timer)
      clearInterval(dataCheckInterval)
    }
  }, [initBatteryAPI, loadWalletData])


  // 处理金额选择
  const handleAmountSelect = useCallback((amount: string) => {
    console.log('🔍 快速充值按钮点击:', { 选中金额: amount, 当前选中: selectedAmount })
    setSelectedAmount(amount)
    if (amount !== 'custom') {
      setCustomAmount(amount.replace('¥', ''))
    }
  }, [selectedAmount])

  // 处理手动输入金额，检测是否与快速充值按钮匹配
  const handleCustomAmountInput = useCallback((value: string) => {
    setCustomAmount(value)
    
    // 如果输入为空，清除选中状态
    if (!value || value.trim() === '') {
      if (selectedAmount) {
        setSelectedAmount('')
      }
      return
    }
    
    // 解析输入的金额（处理小数点情况）
    const inputAmount = parseFloat(value)
    
    // 如果输入的不是有效数字，清除选中状态
    if (Number.isNaN(inputAmount) || inputAmount <= 0) {
      if (selectedAmount) {
        setSelectedAmount('')
      }
      return
    }
    
    // 快速充值按钮的金额选项
    const quickAmounts = ['10', '50', '100', '200', '500']
    
    // 检查输入的金额是否与某个快速充值按钮匹配（支持小数比较）
    const matchingAmount = quickAmounts.find(amount => {
      const quickAmount = parseFloat(amount)
      return Math.abs(inputAmount - quickAmount) < 0.01 // 支持小数误差
    })
    
    // 如果找到匹配的金额且当前未选中该按钮，则选中
    if (matchingAmount && selectedAmount !== matchingAmount) {
      setSelectedAmount(matchingAmount)
    }
    // 如果没有找到匹配的金额且当前有选中的按钮，则取消选中
    else if (!matchingAmount && selectedAmount) {
      setSelectedAmount('')
    }
  }, [selectedAmount])

  // 处理优惠券使用
  const handleUseCoupon = useCallback((coupon: Coupon) => {
    setSelectedCoupon(coupon)
    setShowRechargeModal(true)
    setShowCouponSelector(false)
  }, [])

  // 计算优惠后的实际支付金额
  const calculateDiscountedAmount = useCallback((originalAmount: number) => {
    if (!selectedCoupon) {
      console.log('🔍 没有选择优惠券，返回原金额:', originalAmount)
      return originalAmount
    }
    
    console.log('🔍 开始计算优惠券折扣:', {
      优惠券: selectedCoupon.title,
      折扣信息: selectedCoupon.discount,
      原金额: originalAmount,
      最低金额: selectedCoupon.minAmount
    })
    
    // 检查是否满足最低金额要求
    if (originalAmount < selectedCoupon.minAmount) {
      console.log('⚠️ 金额不足，无法使用优惠券')
      return originalAmount
    }
    
    // 解析优惠券折扣信息（例如："8折"、"立减10元"、"20%"等）
    const discountText = selectedCoupon.discount
    let discountedAmount = originalAmount
    
    if (discountText.includes('折')) {
      // 处理折扣（如：8折 = 0.8）
      const discountRate = parseFloat(discountText.replace('折', '')) / 10
      discountedAmount = originalAmount * discountRate
      console.log('🎯 折扣券计算:', { 折扣率: discountRate, 优惠后金额: discountedAmount })
    } else if (discountText.includes('%')) {
      // 处理百分比折扣（如：20% = 0.8）
      const discountPercent = parseFloat(discountText.replace('%', ''))
      const discountRate = (100 - discountPercent) / 100
      discountedAmount = originalAmount * discountRate
      console.log('🎯 百分比折扣计算:', { 折扣百分比: discountPercent, 折扣率: discountRate, 优惠后金额: discountedAmount })
    } else if (discountText.includes('立减') || discountText.includes('减')) {
      // 处理立减（如：立减10元）
      const discountAmount = parseFloat(discountText.replace(/[^\d.]/g, ''))
      discountedAmount = Math.max(0, originalAmount - discountAmount)
      console.log('🎯 立减券计算:', { 立减金额: discountAmount, 优惠后金额: discountedAmount })
    } else if (discountText.includes('满减')) {
      // 处理满减（如：满100减20）
      const match = discountText.match(/满(\d+)减(\d+)/)
      if (match) {
        const minAmount = parseFloat(match[1])
        const discountAmount = parseFloat(match[2])
        if (originalAmount >= minAmount) {
          discountedAmount = originalAmount - discountAmount
          console.log('🎯 满减券计算:', { 满额: minAmount, 减额: discountAmount, 优惠后金额: discountedAmount })
        }
      }
    } else {
      console.log('⚠️ 无法识别的优惠券格式:', discountText)
      return originalAmount
    }
    
    const finalAmount = Math.max(0, discountedAmount)
    console.log('✅ 优惠券计算完成:', {
      原金额: originalAmount,
      优惠后金额: finalAmount,
      节省金额: originalAmount - finalAmount
    })
    
    return finalAmount
  }, [selectedCoupon])

  // 获取优惠券折扣描述
  const getCouponDiscountDescription = useCallback((coupon: Coupon, amount: number) => {
    console.log('🔍 生成优惠券描述:', { 优惠券: coupon.title, 金额: amount })
    
    const discountedAmount = calculateDiscountedAmount(amount)
    const savedAmount = amount - discountedAmount
    
    console.log('🔍 优惠券描述计算结果:', { 
      原金额: amount, 
      优惠后金额: discountedAmount, 
      节省金额: savedAmount 
    })
    
    if (savedAmount > 0) {
      return `优惠后支付：¥${discountedAmount.toFixed(2)}，节省：¥${savedAmount.toFixed(2)}`
    } else if (amount < coupon.minAmount) {
      return `满¥${coupon.minAmount}可用，当前金额不足`
    } else {
      return '无优惠'
    }
  }, [calculateDiscountedAmount])

  // 支付方式固定为支付宝，无需选择逻辑

  // 处理充值
  const handleRecharge = async () => {
    const originalAmount = selectedAmount ? parseFloat(selectedAmount.replace('¥', '')) : parseFloat(customAmount)
    const actualPaymentAmount = calculateDiscountedAmount(originalAmount)
    
    if (!originalAmount || originalAmount <= 0) {
      TaroCompat.showToast({
        title: '请输入有效金额',
        icon: 'error'
      })
      return
    }

    if (originalAmount < 1 || originalAmount > 1000) {
      TaroCompat.showToast({
        title: '充值金额必须在1-1000元之间',
        icon: 'error'
      })
      return
    }

    // 检查优惠券使用条件
    if (selectedCoupon && originalAmount < selectedCoupon.minAmount) {
      TaroCompat.showToast({
        title: `充值金额需满¥${selectedCoupon.minAmount}才能使用此优惠券`,
        icon: 'error'
      })
      return
    }

    // 支付方式固定为支付宝，无需检查

    try {
      // 关闭弹窗
      setShowRechargeModal(false)
      
      // 显示处理中提示
      TaroCompat.showLoading({
        title: '正在处理...'
      })
      
      // 调用钱包充值API
      const response = await fetch('/api/payments/wallet/recharge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          amount: originalAmount, // 实际充值到余额的金额
          paymentAmount: actualPaymentAmount, // 用户实际支付的金额
          paymentMethod: 'alipay',
          couponId: selectedCoupon?.id || null
        })
      })

      TaroCompat.hideLoading()

      // 检查响应状态
      if (!response.ok) {
        if (response.status === 404) {
          // API不存在，使用模拟支付宝沙箱支付URL
          console.warn('充值API不存在，使用模拟支付宝沙箱支付')
          
          TaroCompat.showToast({
            title: '正在跳转到支付宝沙箱...',
            icon: 'loading',
            duration: 2000
          })
          
          // 模拟支付宝沙箱支付URL（实际项目中应该由后端提供）
          const frontendUrl = 'http://localhost:10086' // 前端地址
          const mockPayUrl = `https://openapi.alipaydev.com/gateway.do?app_id=2021000000000001&method=alipay.trade.wap.pay&format=JSON&return_url=${encodeURIComponent(frontendUrl + '/#/pages/payment-success/index?orderId=WALLET_' + Date.now() + '&amount=' + originalAmount + '&paymentAmount=' + actualPaymentAmount + '&type=recharge' + (selectedCoupon ? '&couponId=' + selectedCoupon.id : ''))}&notify_url=${encodeURIComponent(window.location.origin + '/api/payments/notify')}&version=1.0&sign_type=RSA2&timestamp=${new Date().toISOString()}&biz_content=${encodeURIComponent(JSON.stringify({
            out_trade_no: 'WALLET_' + Date.now(),
            product_code: 'QUICK_WAP_WAY',
            total_amount: actualPaymentAmount, // 使用优惠后的支付金额
            subject: `钱包充值${selectedCoupon ? ' (优惠券)' : ''}`,
            quit_url: frontendUrl + '/#/pages/charging/index'
          }))}&sign=mock_signature`
          
          // 在跳转前标记优惠券为已使用（因为是模拟支付）
          if (selectedCoupon) {
            // 更新本地优惠券状态
            setCoupons(prevCoupons => 
              prevCoupons.map(coupon => 
                coupon.id === selectedCoupon.id 
                  ? { ...coupon, status: 'used' as const, usedDate: new Date().toISOString() }
                  : coupon
              )
            )
            
            // 更新本地存储中的优惠券数据
            try {
              const currentData = dataManager.getData()
              const updatedCoupons = currentData.coupons.map(coupon => 
                coupon.id === selectedCoupon.id 
                  ? { ...coupon, status: 'used' as const, usedDate: new Date().toISOString() }
                  : coupon
              )
              
              // 保存到本地存储
              const updatedData = {
                ...currentData,
                coupons: updatedCoupons
              }
              localStorage.setItem('walletData', JSON.stringify(updatedData))
              
              console.log('✅ 优惠券使用状态已更新到本地存储（模拟支付）')
            } catch (error) {
              console.error('❌ 更新本地存储失败:', error)
            }
            
            // 清除选中的优惠券
            setSelectedCoupon(null)
          }
          
          // 延迟跳转，让用户看到提示
          setTimeout(() => {
            window.location.href = mockPayUrl
          }, 2000)
          return
        } else {
          throw new Error(`请求失败 (${response.status}): ${response.statusText}`)
        }
      }

      // 尝试解析JSON响应
      let result
      try {
        const responseText = await response.text()
        if (responseText.trim() === '') {
          throw new Error('服务器返回空响应')
        }
        result = JSON.parse(responseText)
      } catch (jsonError) {
        console.error('JSON解析错误:', jsonError)
        throw new Error('服务器响应格式错误')
      }

      if (result.success && result.data && result.data.payUrl) {
        // 跳转到支付宝沙箱支付页面
        TaroCompat.showToast({
          title: '正在跳转到支付宝...',
          icon: 'loading',
          duration: 1000
        })
        
        setTimeout(() => {
          window.location.href = result.data.payUrl
        }, 1000)
      } else {
        throw new Error(result.message || result.error || '充值失败，请检查服务器配置')
      }

      // 支付成功后，标记优惠券为已使用
      if (selectedCoupon) {
        // 更新本地优惠券状态
        setCoupons(prevCoupons => 
          prevCoupons.map(coupon => 
            coupon.id === selectedCoupon.id 
              ? { ...coupon, status: 'used' as const, usedDate: new Date().toISOString() }
              : coupon
          )
        )
        
        // 更新本地存储中的优惠券数据
        try {
          const currentData = dataManager.getData()
          const updatedCoupons = currentData.coupons.map(coupon => 
            coupon.id === selectedCoupon.id 
              ? { ...coupon, status: 'used' as const, usedDate: new Date().toISOString() }
              : coupon
          )
          
          // 保存到本地存储
          const updatedData = {
            ...currentData,
            coupons: updatedCoupons
          }
          localStorage.setItem('walletData', JSON.stringify(updatedData))
          
          console.log('✅ 优惠券使用状态已更新到本地存储')
        } catch (error) {
          console.error('❌ 更新本地存储失败:', error)
        }
        
        // 清除选中的优惠券
        setSelectedCoupon(null)
      }
    } catch (error) {
      TaroCompat.hideLoading()
      console.error('充值失败', error)
      
      // 更详细的错误处理
      let errorMessage = '充值失败，请重试'
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = '网络连接失败，请检查网络设置'
      } else if (error.message && !error.message.includes('Unexpected end of JSON input')) {
        errorMessage = error.message
      } else if (error.message && error.message.includes('Unexpected end of JSON input')) {
        errorMessage = '服务器响应异常，请稍后重试'
      }
      
      TaroCompat.showToast({
        title: errorMessage,
        icon: 'error',
        duration: 3000
      })
      
      // 跳转到支付失败页面
      setTimeout(() => {
        TaroCompat.navigateTo({
          url: `/pages/payment-failure/index?orderId=WALLET_${Date.now()}&amount=${actualPaymentAmount}&type=recharge&errorMsg=${encodeURIComponent(errorMessage)}`
        }).catch(() => {
          // 如果跳转失败，重新显示充值弹窗
        setShowRechargeModal(true)
        })
      }, 3500)
    }
  }

  // 清除优惠券选择
  const clearSelectedCoupon = useCallback(() => {
    setSelectedCoupon(null)
  }, [])

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return `今天 ${date.toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: false })}`
    } else if (diffDays === 1) {
      return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: false })}`
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false })
    }
  }

  // 获取交易图标emoji
  const getTransactionIconEmoji = (description: string, type: string) => {
    if (description.includes('充值')) return '💰'
    if (description.includes('充电扣费') || description.includes('充电自动扣费')) return '⚡'
    if (description.includes('购物') || description.includes('购买')) return '🛒'
    if (description.includes('订阅') || description.includes('续费')) return '🔄'
    return type === 'recharge' ? '💰' : '💸'
  }

  // 获取优惠券状态样�?
  const getCouponStatusClass = (status: string) => {
    switch (status) {
      case 'active': return 'coupon-active'
      case 'used': return 'coupon-used'
      case 'expired': return 'coupon-expired'
      default: return ''
    }
  }

  // 查看交易详情
  const handleViewTransactionDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setShowTransactionDetail(true)
  }

  // 关闭交易详情
  const handleCloseTransactionDetail = () => {
    setShowTransactionDetail(false)
    setSelectedTransaction(null)
  }

  if (loading) {
    return (
      <View className='wallet-page'>
        <View className='loading-container'>
          <Text>加载�?..</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='wallet-page'>

      {/* Balance Card with Battery Theme */}
      <View 
        className={`${getBatteryThemeClass()} ${batteryTheme?.name === 'critical' ? 'critical-pulse' :
          batteryTheme?.charging ? 'charging-pulse' :
          'battery-pulse'
        }`} 
        style={getBatteryCardStyle()}
        onClick={() => setShowRechargeModal(true)}
      >
        {/* 电池状态指示器 */}
        <View 
          className='battery-indicator' 
          onClick={(e) => {
            e.stopPropagation()
            setShowBatteryInfo(!showBatteryInfo)
          }}
        >
          <View className='battery-icon'>
            <View 
              className='battery-level' 
              style={{ 
                width: batteryTheme ? `${batteryTheme.level}%` : '0%',
                backgroundColor: batteryTheme ? 
                  (batteryTheme.charging ? '#fbbf24' : 
                   batteryTheme.level > 20 ? '#22c55e' : '#ef4444') : '#6b7280'
              }}
            />
            <View className='battery-tip' />
            {batteryTheme?.charging && (
              <View className='charging-bolt'>⚡</View>
            )}
          </View>
          <Text className='battery-percentage'>
            {batteryTheme ? `${batteryTheme.level}%` : '--'}
          </Text>
        </View>

        {/* 电池信息面板 */}
        {showBatteryInfo && (
          <View className='battery-info-panel' onClick={(e) => e.stopPropagation()}>
            <View className='battery-info-item'>
              <Text className='info-label'>电量:</Text>
              <Text className='info-value'>{batteryTheme ? `${batteryTheme.level}%` : '--'}</Text>
            </View>
            <View className='battery-info-item'>
              <Text className='info-label'>状态:</Text>
              <Text className='info-value'>
                {!batteryTheme ? '🔄 检测中...' :
                 batteryTheme.charging ? '🔌 充电中' : '🔋 使用中'}
              </Text>
            </View>
            <View className='battery-info-item'>
              <Text className='info-label'>主题:</Text>
              <Text className='info-value'>
                {!batteryTheme ? '⏳ 加载中...' :
                 batteryTheme.name === 'high' ? '🟢 高电量' :
                 batteryTheme.name === 'medium' ? '🔵 中等电量' :
                 batteryTheme.name === 'low' ? '🟠 低电量' :
                 batteryTheme.name === 'critical' ? '🔴 电量危险' :
                 batteryTheme.name === 'charging' ? '⚡ 充电模式' : '❓ 未知'}
              </Text>
            </View>
            
            {/* 新增智能预测时间项 */}
            <View className='battery-info-item smart-prediction'>
              <Text className='info-label'>智能预测:</Text>
                <View className='info-value-container'>
                  {predictionLoading ? (
                    <Text className='info-value prediction-loading'>🤖 AI 分析中...</Text>
                  ) : (
                    <Text className='info-value prediction-text'>
                      {lastPredictionResult ? lastPredictionResult : smartPrediction}
              </Text>
                  )}
                </View>
            </View>
            
            {batteryStatus?.isSupported && (
              <>
              </>
            )}
          </View>
        )}

        <View className='card-decoration'>
          <View className='waves'></View>
        </View>
        
        <View className='balance-main'>
          <View className='balance-amount-container'>
            <Text className='currency-symbol'>{dataJson.walletBalance.currency}</Text>
            <Text className='balance-amount'>{walletInfo?.balance.toFixed(2) || dataJson.walletBalance.amount.toFixed(2)}</Text>
          </View>
          <Text className='battery-theme-hint'>
            {!batteryInitialized ? '🔄 正在检测电池状态...' :
             !batteryTheme ? '⏳ 主题加载中...' :
             batteryTheme.charging ? `⚡ 充电中 ${batteryTheme.level}%` : 
             `🔋 电量 ${batteryTheme.level}%`}
          </Text>

          {/* 钱包统计信息 */}
          {walletInfo && (
            <View className='balance-stats'>
              <View className='balance-stat-item'>
                <Text className='stat-value'>¥{walletInfo.totalRecharge.toFixed(2)}</Text>
                <Text className='stat-label'>总充值</Text>
              </View>
              <View className='balance-stat-divider' />
              <View className='balance-stat-item'>
                <Text className='stat-value'>¥{walletInfo.totalConsume.toFixed(2)}</Text>
                <Text className='stat-label'>总消费</Text>
              </View>
              <View className='balance-stat-divider' />
              <View className='balance-stat-item'>
                <Text className='stat-value'>{transactions.length}</Text>
                <Text className='stat-label'>交易记录</Text>
              </View>
            </View>
          )}
        </View>

         {/* Integrated Tab Navigation */}
         <View className='card-tab-navigation' onClick={(e) => e.stopPropagation()}>
           <View 
             className={`card-tab-item ${activeTab === 'balance' ? 'card-tab-active' : ''}`}
             onClick={() => setActiveTab('balance')}
           >
             <Text className='card-tab-icon'>💰</Text>
             <Text className='card-tab-text'>余额</Text>
           </View>
           <View 
             className={`card-tab-item ${activeTab === 'coupons' ? 'card-tab-active' : ''}`}
             onClick={() => setActiveTab('coupons')}
           >
             <Text className='card-tab-icon'>🏷️</Text>
             <Text className='card-tab-text'>优惠券</Text>
           </View>
         </View>
       </View>

       {/* Tab Content Container */}
       <View className='tabs-container'>

        {/* Tab Contents */}
        <ScrollView className='tab-content' scrollY>
          {/* Balance Tab */}
          {activeTab === 'balance' && (
            <View className='balance-tab'>
              <View className='transactions-section'>
                <Text className='section-title'>最近交易</Text>
                <View className='transactions-list'>
                  {transactions.slice(0, 10).map((transaction) => (
                    <View key={transaction.id} className='transaction-card'>
                      <View className='transaction-main'>
                      <View className='transaction-left'>
                          <View className={`transaction-icon ${transaction.type === 'recharge' ? 'icon-green' : transaction.type === 'consume' ? 'icon-blue' : 'icon-red'}`}>
                            <Text className='icon-text'>{getTransactionIconEmoji(transaction.description, transaction.type)}</Text>
                        </View>
                        <View className='transaction-info'>
                            <Text className='transaction-title'>
                              {transaction.type === 'recharge' ? '支付宝充值' :
                                transaction.type === 'consume' ? '充电消费' :
                                  transaction.description.split(' ')[0]}
                            </Text>
                          <Text className='transaction-time'>{formatDate(transaction.createdAt)}</Text>
                            {/* 简化的额外信息显示 */}
                            {(transaction as any).chargingInfo?.stationName && (
                              <Text className='transaction-location'>
                                📍 {(transaction as any).chargingInfo.stationName}
                              </Text>
                            )}
                        </View>
                      </View>
                      <View className='transaction-right'>
                        <Text className={`transaction-amount ${transaction.type === 'recharge' ? 'amount-positive' : 'amount-negative'}`}>
                            {transaction.type === 'recharge' ? '+' : '-'}¥{transaction.amount.toFixed(2)}
                        </Text>
                          <View className='transaction-actions'>
                            <Text className={`transaction-status ${transaction.status === 'completed' ? 'status-completed' : transaction.status === 'pending' ? 'status-pending' : 'status-failed'}`}>
                              {transaction.status === 'completed' ? '已完成' :
                                transaction.status === 'pending' ? '处理中' :
                                  transaction.status === 'failed' ? '失败' : '已取消'}
                            </Text>
                            <Button
                              className='detail-btn'
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewTransactionDetail(transaction)
                              }}
                            >
                              详情
                            </Button>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>


              </View>
            </View>
          )}

          {/* Coupons Tab */}
          {activeTab === 'coupons' && (
            <View className='coupons-tab'>
              <Text className='section-title'>我的优惠券</Text>
              <View className='coupons-stats'>
                <View className='coupon-stat-item'>
                  <Text className='coupon-stat-number'>{coupons.filter(c => c.status === 'active').length}</Text>
                  <Text className='coupon-stat-label'>可用</Text>
                </View>
                <View className='coupon-stat-item'>
                  <Text className='coupon-stat-number'>{coupons.filter(c => c.status === 'used').length}</Text>
                  <Text className='coupon-stat-label'>已使用</Text>
                </View>
                <View className='coupon-stat-item'>
                  <Text className='coupon-stat-number'>{coupons.filter(c => c.status === 'expired').length}</Text>
                  <Text className='coupon-stat-label'>已过期</Text>
                </View>
              </View>
              <View className='coupons-grid'>
                {coupons.map((coupon) => (
                  <View key={coupon.id} className={`coupon-card ${getCouponStatusClass(coupon.status)}`}>
                    <View className='coupon-header'>
                      <View className='coupon-status-badge'>
                        <Text className='status-text'>
                          {coupon.status === 'active' ? '✅ 可用' :
                            coupon.status === 'used' ? '✔️ 已使用' :
                              '❌ 已过期'}
                        </Text>
                      </View>
                      <View className='coupon-discount'>
                        <Text className='discount-value'>{coupon.discount}</Text>
                        <Text className='discount-label'>折扣</Text>
                      </View>
                    </View>
                    <Text className='coupon-title'>{coupon.title}</Text>
                    <Text className='coupon-description'>{coupon.description}</Text>
                    <View className='coupon-footer'>
                      <Text className='coupon-date'>
                        {coupon.status === 'used' ? `使用时间：${coupon.usedDate}` : 
                         coupon.status === 'expired' ? `过期时间：${coupon.expiryDate}` : 
                         `有效期至：${coupon.expiryDate}`}
                      </Text>
                      <Text className='coupon-min-amount'>满¥{coupon.minAmount}可用</Text>
                      {coupon.status === 'active' && (
                        <Button 
                          className='use-coupon-btn' 
                          onClick={() => handleUseCoupon(coupon)}
                        >
                          立即使用
                        </Button>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}


        </ScrollView>
      </View>

      {/* Recharge Modal */}
      {showRechargeModal && (
        <View className='modal-overlay' onClick={() => setShowRechargeModal(false)}>
          <View className='recharge-modal' onClick={(e) => e.stopPropagation()}>
            <View className='modal-header'>
              <Text className='modal-title'>钱包充值</Text>
              <Button className='close-btn' onClick={() => setShowRechargeModal(false)}>✕</Button>
            </View>
            
            <View className='modal-content'>
              <View className='amount-section'>
                <Text className='input-label'>金额</Text>
                <View className='amount-input-wrapper'>
                  <Text className='currency-symbol'>￥</Text>
                  <Input
                    className='amount-input'
                    type='number'
                    placeholder='输入金额'
                    value={customAmount}
                    onInput={(e) => handleCustomAmountInput(e.detail.value)}
                  />
                </View>
              </View>
              
              <View className='payment-methods-section'>
                <Text className='input-label'>支付方式</Text>
                <View className='payment-method-display'>
                  <View className='payment-method-item'>
                    <Text className='payment-icon'>💰</Text>
                    <Text className='payment-name'>支付宝</Text>
                    <Text className='payment-badge'>推荐</Text>
                    </View>
                </View>
              </View>
              
              <View className='quick-amounts-section'>
                <Text className='input-label'>快速充值</Text>
                <View className='quick-amounts'>
                  {['10', '50', '100', '200', '500'].map((amount) => (
                    <Button
                      key={amount}
                      className={`quick-amount ${selectedAmount === amount ? 'selected' : ''}`}
                      onClick={() => handleAmountSelect(amount)}
                    >
                      ￥{amount}
                    </Button>
                  ))}
                </View>
              </View>

              {/* 优惠券选择区域 */}
              <View className='coupon-section'>
                <Text className='input-label'>优惠券</Text>
                <View className='coupon-selector-wrapper'>
                  {selectedCoupon ? (
                    <View className='selected-coupon'>
                      <View className='selected-coupon-info'>
                        <Text className='selected-coupon-title'>{selectedCoupon.title}</Text>
                        <Text className='selected-coupon-discount'>{selectedCoupon.discount}</Text>
                        {customAmount && (
                          <Text className='selected-coupon-savings'>
                            {getCouponDiscountDescription(selectedCoupon, parseFloat(customAmount))}
                          </Text>
                        )}
                        {/* 调试信息 */}
                        <Text className='coupon-debug-info'>
                          最低金额: ¥{selectedCoupon.minAmount} | 当前金额: ¥{customAmount || '0'}
                        </Text>
                      </View>
                      <Button className='remove-coupon-btn' onClick={clearSelectedCoupon}>✕</Button>
                    </View>
                  ) : (
                    <Button 
                      className='select-coupon-btn'
                      onClick={() => setShowCouponSelector(true)}
                    >
                      选择优惠券
                    </Button>
                  )}
                </View>
              </View>

              {/* 支付信息显示 */}
              {customAmount && selectedCoupon && (
                <View className='payment-info'>
                  <View className='payment-info-item'>
                    <Text className='payment-info-label'>充值金额：</Text>
                    <Text className='payment-info-value'>¥{parseFloat(customAmount).toFixed(2)}</Text>
                  </View>
                  <View className='payment-info-item'>
                    <Text className='payment-info-label'>优惠后支付：</Text>
                    <Text className='payment-info-value payment-discounted'>
                      ¥{calculateDiscountedAmount(parseFloat(customAmount)).toFixed(2)}
                    </Text>
                  </View>
                  <View className='payment-info-item'>
                    <Text className='payment-info-label'>节省金额：</Text>
                    <Text className='payment-info-value payment-saved'>
                      ¥{(parseFloat(customAmount) - calculateDiscountedAmount(parseFloat(customAmount))).toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}
              
              <Button className='recharge-now-btn' onClick={handleRecharge}>
                立即充值
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 交易详情弹窗 */}
      {showTransactionDetail && selectedTransaction && (
        <View className='modal-overlay' onClick={handleCloseTransactionDetail}>
          <View className='transaction-detail-modal' onClick={(e) => e.stopPropagation()}>
            <View className='modal-header'>
              <Text className='modal-title'>交易详情</Text>
              <Button className='close-btn' onClick={handleCloseTransactionDetail}>✕</Button>
            </View>

            <View className='detail-content'>
              <View className='detail-section'>
                <Text className='detail-section-title'>基本信息</Text>
                <View className='detail-item'>
                  <Text className='detail-label'>交易类型</Text>
                  <Text className='detail-value'>
                    {selectedTransaction.type === 'recharge' ? '💰 钱包充值' :
                      selectedTransaction.type === 'consume' ? '⚡ 充电消费' :
                        selectedTransaction.type === 'refund' ? '🔄 退款' : '💸 提现'}
                  </Text>
                </View>
                <View className='detail-item'>
                  <Text className='detail-label'>交易金额</Text>
                  <Text className={`detail-value ${selectedTransaction.type === 'recharge' ? 'amount-positive' : 'amount-negative'}`}>
                    {selectedTransaction.type === 'recharge' ? '+' : '-'}¥{selectedTransaction.amount.toFixed(2)}
                  </Text>
                </View>
                <View className='detail-item'>
                  <Text className='detail-label'>交易状态</Text>
                  <Text className='detail-value'>
                    {selectedTransaction.status === 'completed' ? '✅ 已完成' :
                      selectedTransaction.status === 'pending' ? '⏳ 处理中' :
                        selectedTransaction.status === 'failed' ? '❌ 失败' : '❌ 已取消'}
                  </Text>
                </View>
                <View className='detail-item'>
                  <Text className='detail-label'>支付方式</Text>
                  <Text className='detail-value'>
                    {selectedTransaction.paymentMethod === 'alipay' ? '💰 支付宝' :
                      selectedTransaction.paymentMethod === 'balance' ? '💳 余额支付' :
                        selectedTransaction.paymentMethod === 'wechat' ? '💚 微信支付' : '其他'}
                  </Text>
                </View>
                <View className='detail-item'>
                  <Text className='detail-label'>交易时间</Text>
                  <Text className='detail-value'>{new Date(selectedTransaction.createdAt).toLocaleString('zh-CN')}</Text>
                </View>
                {selectedTransaction.orderId && (
                  <View className='detail-item'>
                    <Text className='detail-label'>订单号</Text>
                    <Text className='detail-value detail-order-id'>{selectedTransaction.orderId}</Text>
                  </View>
                )}
              </View>

              {/* 充电详情（如果是充电消费） */}
              {(selectedTransaction as any).chargingInfo && (
                <View className='detail-section'>
                  <Text className='detail-section-title'>充电详情</Text>
                  <View className='detail-item'>
                    <Text className='detail-label'>充电站</Text>
                    <Text className='detail-value'>📍 {(selectedTransaction as any).chargingInfo.stationName}</Text>
                  </View>
                  <View className='detail-item'>
                    <Text className='detail-label'>充电时长</Text>
                    <Text className='detail-value'>⏱️ {Math.floor((selectedTransaction as any).chargingInfo.duration / 60)}分钟</Text>
                  </View>
                  <View className='detail-item'>
                    <Text className='detail-label'>充电电量</Text>
                    <Text className='detail-value'>⚡ {(selectedTransaction as any).chargingInfo.energyDelivered}kWh</Text>
                  </View>
                  {(selectedTransaction as any).chargingInfo.startTime && (
                    <View className='detail-item'>
                      <Text className='detail-label'>开始时间</Text>
                      <Text className='detail-value'>
                        {new Date((selectedTransaction as any).chargingInfo.startTime).toLocaleString('zh-CN')}
                      </Text>
                    </View>
                  )}
                  {(selectedTransaction as any).chargingInfo.endTime && (
                    <View className='detail-item'>
                      <Text className='detail-label'>结束时间</Text>
                      <Text className='detail-value'>
                        {new Date((selectedTransaction as any).chargingInfo.endTime).toLocaleString('zh-CN')}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View className='detail-footer'>
              <Button className='detail-close-btn' onClick={handleCloseTransactionDetail}>
                关闭
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 优惠券选择器弹窗 */}
      {showCouponSelector && (
        <View className='modal-overlay' onClick={() => setShowCouponSelector(false)}>
          <View className='coupon-selector-modal' onClick={(e) => e.stopPropagation()}>
            <View className='modal-header'>
              <Text className='modal-title'>🎫 选择优惠券</Text>
              <Button className='close-btn' onClick={() => setShowCouponSelector(false)}>✕</Button>
            </View>

            <View className='modal-content'>
              <ScrollView className='coupon-list' scrollY>
                {coupons.filter(c => c.status === 'active').length > 0 ? (
                  coupons.filter(c => c.status === 'active').map((coupon) => (
                    <View 
                      key={coupon.id} 
                      className={`coupon-selector-item ${selectedCoupon?.id === coupon.id ? 'selected' : ''}`}
                      onClick={() => handleUseCoupon(coupon)}
                    >
                      <View className='coupon-selector-left'>
                        <Text className='coupon-selector-title'>🎁 {coupon.title}</Text>
                        <Text className='coupon-selector-discount'>💎 {coupon.discount}</Text>
                        <Text className='coupon-selector-description'>📝 {coupon.description}</Text>
                        <Text className='coupon-selector-min-amount'>💰 满¥{coupon.minAmount}可用</Text>
                      </View>
                      <View className='coupon-selector-right'>
                        <Text className='coupon-selector-expiry'>⏰ 有效期至：{coupon.expiryDate}</Text>
                        <Button className='coupon-selector-use-btn'>
                          {selectedCoupon?.id === coupon.id ? '✅ 已选择' : '🎯 使用'}
                        </Button>
                      </View>
                    </View>
                  ))
                ) : (
                  <View className='no-coupons-message'>
                    <Text className='no-coupons-icon'>🎫</Text>
                    <Text className='no-coupons-text'>暂无可用优惠券</Text>
                    <Text className='no-coupons-hint'>请先获取优惠券后再试</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
