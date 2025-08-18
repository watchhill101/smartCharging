import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Button, Input } from '@tarojs/components'
import TaroCompat from '../../utils/taroCompat'
import './index.scss'
import WalletService, { WalletInfo, Transaction } from '../../utils/walletService'
import MobileDetect from '../../utils/mobileDetect'

// 优惠券接�?
interface Coupon {
  id: string
  title: string
  discount: string
  description: string
  status: 'active' | 'used' | 'expired'
  expiryDate: string
  usedDate?: string
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [showRechargeModal, setShowRechargeModal] = useState(false)
  
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
    
    return () => clearTimeout(timer)
  }, [initBatteryAPI])

  // 获取充电样式级别
  const getChargingStyleLevel = (level: number): ChargingStyleLevel => {
    if (level >= 80) return 'high'
    if (level >= 50) return 'medium'
    if (level >= 20) return 'low'
    return 'critical'
  }

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

  // 加载钱包数据
  const loadWalletData = async () => {
    try {
      setLoading(true)
      const [walletData, transactionData] = await Promise.all([
        WalletService.getWalletInfo(),
        WalletService.getTransactions({ page: 1, limit: 10 })
      ])
      
      setWalletInfo(walletData)
      setTransactions(transactionData.transactions)
    } catch (error) {
      console.error('加载钱包数据失败:', error)
      
      // 使用模拟数据
      setWalletInfo({
        balance: 1245.50,
        frozenAmount: 0,
        availableBalance: 1245.50,
        totalRecharge: 2000.00,
        totalConsume: 754.50,
        paymentMethods: [
          { id: 'visa', type: 'bank_card', name: 'Visa卡', isDefault: true, isEnabled: true },
          { id: 'mastercard', type: 'bank_card', name: '万事达卡', isDefault: false, isEnabled: true },
          { id: 'paypal', type: 'alipay', name: 'PayPal', isDefault: false, isEnabled: true },
          { id: 'bank', type: 'bank_card', name: '银行转账', isDefault: false, isEnabled: true }
        ],
        settings: {
          defaultPaymentMethod: 'visa'
        }
      })
      
      setTransactions([
        {
          id: '1',
          type: 'recharge',
          amount: 200,
          description: '账户充值',
          paymentMethod: 'visa',
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          type: 'consume',
          amount: 59.99,
          description: '在线购物',
          paymentMethod: 'visa',
          status: 'completed',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '3',
          type: 'recharge',
          amount: 100,
          description: '钱包充值',
          paymentMethod: 'paypal',
          status: 'completed',
          createdAt: '2023-05-12T14:00:00.000Z',
          updatedAt: '2023-05-12T14:00:00.000Z'
        }
      ])
      
      setCoupons([
        {
          id: '1',
          title: '夏季促销',
          discount: '20%',
          description: '购买满100元享受8折优惠',
          status: 'active',
          expiryDate: '2023-08-30'
        },
        {
          id: '2',
          title: '新用户福利',
          discount: '$10',
          description: '首次购买立减10元',
          status: 'used',
          expiryDate: '2023-12-31',
          usedDate: '2023-05-05'
        },
        {
          id: '3',
          title: '春季特惠',
          discount: '15%',
          description: '精选商品享受85折优惠',
          status: 'expired',
          expiryDate: '2023-04-15'
        }
      ])

    } finally {
      setLoading(false)
    }
  }

  // 处理金额选择
  const handleAmountSelect = (amount: string) => {
    setSelectedAmount(amount)
    if (amount !== 'custom') {
      setCustomAmount(amount.replace('¥', ''))
    }
  }

  // 处理支付方式选择
  const handlePaymentMethodSelect = (methodId: string) => {
    setSelectedPaymentMethod(methodId)
  }

  // 处理充�?
  const handleRecharge = async () => {
    const amount = selectedAmount === 'custom' ? customAmount : selectedAmount.replace('¥', '')
    
    if (!amount || parseFloat(amount) <= 0) {
      TaroCompat.showToast({
        title: '请输入有效金额',
        icon: 'error'
      })
      return
    }

    if (!selectedPaymentMethod) {
      TaroCompat.showToast({
        title: '请选择支付方式',
        icon: 'error'
      })
      return
    }

    try {
      await WalletService.createRecharge(parseFloat(amount), selectedPaymentMethod)
      
      TaroCompat.showToast({
        title: '充值订单创建成功',
        icon: 'success'
      })
      
      // 刷新数据
      loadWalletData()
    } catch (error) {
      console.error('充值失败', error)
              TaroCompat.showToast({
          title: '充值失败',
          icon: 'error'
        })
    }
  }

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

  // 获取交易图标
  const getTransactionIcon = (description: string, type: string) => {
    if (description.includes('充值')) return type === 'recharge' ? 'arrow-down' : 'arrow-up'
    if (description.includes('购物') || description.includes('购买')) return 'shopping-cart'
    if (description.includes('订阅') || description.includes('续费')) return 'sync'
    return type === 'recharge' ? 'arrow-down' : 'arrow-up'
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
        className={`${getBatteryThemeClass()} ${
          batteryTheme?.name === 'critical' ? 'critical-pulse' : 
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
            <View className='battery-info-item'>
              <Text className='info-label'>API:</Text>
              <Text className='info-value'>
                {!batteryInitialized ? '🔄 初始化中...' : 
                 batteryStatus?.isSupported ? '✅ 已支持' : '🤖 智能模拟'}
              </Text>
            </View>
            {batteryStatus?.isSupported && (
              <>
                {batteryStatus.chargingTime !== Infinity && (
                  <View className='battery-info-item'>
                    <Text className='info-label'>充满:</Text>
                    <Text className='info-value'>
                      {Math.round(batteryStatus.chargingTime / 60)}分钟
                    </Text>
                  </View>
                )}
                {batteryStatus.dischargingTime !== Infinity && (
                  <View className='battery-info-item'>
                    <Text className='info-label'>续航:</Text>
                    <Text className='info-value'>
                      {Math.round(batteryStatus.dischargingTime / 3600)}小时
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        <View className='card-decoration'>
          <View className='waves'></View>
        </View>
        
        <View className='balance-main'>
          <Text className='balance-label'>钱包余额</Text>
          <View className='balance-amount-container'>
            <Text className='currency-symbol'>￥</Text>
            <Text className='balance-amount'>{walletInfo?.balance.toFixed(2) || '0.00'}</Text>
          </View>
          <Text className='battery-theme-hint'>
            {!batteryInitialized ? '🔄 正在检测电池状态...' :
             !batteryTheme ? '⏳ 主题加载中...' :
             batteryTheme.charging ? `⚡ 充电中 ${batteryTheme.level}%` : 
             batteryStatus?.isSupported ? `🔋 ${batteryTheme.level}% 真实电量` : 
             `🤖 ${batteryTheme.level}% 智能推测`}
          </Text>
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
                  {transactions.map((transaction) => (
                    <View key={transaction.id} className='transaction-item'>
                      <View className='transaction-left'>
                        <View className={`transaction-icon ${transaction.type === 'recharge' ? 'icon-green' : 'icon-red'}`}>
                          <Text className='icon-text'>{getTransactionIcon(transaction.description, transaction.type) === 'arrow-down' ? '↓' : getTransactionIcon(transaction.description, transaction.type) === 'shopping-cart' ? '🛒' : '🔄'}</Text>
                        </View>
                        <View className='transaction-info'>
                          <Text className='transaction-desc'>{transaction.description}</Text>
                          <Text className='transaction-time'>{formatDate(transaction.createdAt)}</Text>
                        </View>
                      </View>
                      <View className='transaction-right'>
                        <Text className={`transaction-amount ${transaction.type === 'recharge' ? 'amount-positive' : 'amount-negative'}`}>
                          {transaction.type === 'recharge' ? '+' : '-'}${transaction.amount.toFixed(2)}
                        </Text>
                        <Text className='transaction-status'>已完成</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Button className='view-all-btn'>
                  查看所有交易 →
                </Button>
              </View>
            </View>
          )}

          {/* Coupons Tab */}
          {activeTab === 'coupons' && (
            <View className='coupons-tab'>
              <View className='coupons-grid'>
                {coupons.map((coupon) => (
                  <View key={coupon.id} className={`coupon-card ${getCouponStatusClass(coupon.status)}`}>
                    <View className='coupon-header'>
                      <View className='coupon-status-badge'>
                        <Text className='status-text'>{coupon.status === 'active' ? '可用' : coupon.status === 'used' ? '已使用' : '已过期'}</Text>
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
                      {coupon.status === 'active' && (
                        <Button className='use-coupon-btn'>立即使用</Button>
                      )}
                    </View>
                  </View>
                ))}
              </View>
              <Button className='add-coupon-btn'>
                ➕ 添加优惠券代码
              </Button>
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
                  <Text className='currency-symbol'>$</Text>
                  <Input
                    className='amount-input'
                    type='number'
                    placeholder='输入金额'
                    value={customAmount}
                    onInput={(e) => setCustomAmount(e.detail.value)}
                  />
                </View>
              </View>
              
              <View className='payment-methods-section'>
                <Text className='input-label'>支付方式</Text>
                <View className='payment-grid'>
                  {walletInfo?.paymentMethods.map((method) => (
                    <View
                      key={method.id}
                      className={`payment-option ${selectedPaymentMethod === method.id ? 'selected' : ''}`}
                      onClick={() => handlePaymentMethodSelect(method.id)}
                    >
                      <Text className='payment-icon'>
                        {method.name === 'Visa卡' && '💳'}
                        {method.name === '万事达卡' && '💳'}
                        {method.name === 'PayPal' && '🅿️'}
                        {method.name === '银行转账' && '🏦'}
                      </Text>
                      <Text className='payment-name'>{method.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              <View className='quick-amounts-section'>
                <Text className='input-label'>快速充值</Text>
                <View className='quick-amounts'>
                  {['10', '50', '100', '200', '500', 'Other'].map((amount) => (
                    <Button
                      key={amount}
                      className={`quick-amount ${selectedAmount === amount ? 'selected' : ''}`}
                      onClick={() => handleAmountSelect(amount)}
                    >
                      {amount === 'Other' ? '其他' : `$${amount}`}
                    </Button>
                  ))}
                </View>
              </View>
              
              <Button className='recharge-now-btn' onClick={handleRecharge}>
                立即充值
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
