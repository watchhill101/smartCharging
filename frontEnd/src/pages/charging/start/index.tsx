import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import './index.scss'

// 声明微信小程序全局对象类型
declare global {
  interface Window {
    wx?: any
  }
  const wx: any
}

interface SelectedTerminalInfo {
  stationId?: string
  stationName?: string
  address?: string
  chargerOrder?: number
  chargerId?: string
  chargerType?: 'fast' | 'slow'
  chargerPower?: number
  pricePerKwh?: string
  currentPeriod?: string
}

export default function StartCharging() {
  const [terminal, setTerminal] = useState<SelectedTerminalInfo>({})
  const [selectedAmount, setSelectedAmount] = useState<number>(10)
  const [payMethod, setPayMethod] = useState<'alipay' | 'wechat'>('alipay')
  const [depositChecked] = useState(true)

  useEffect(() => {
    try {
      let data: any = null
      if (typeof Taro.getStorageSync === 'function') {
        data = Taro.getStorageSync('selected_terminal')
      }
      if (!data) {
        const raw = localStorage.getItem('selected_terminal')
        if (raw) data = JSON.parse(raw)
      }
      if (data) setTerminal(data)
    } catch (e) {
      console.error('加载选中终端失败:', e)
    }
  }, [])

  const tryOpenUrl = (url: string) => {
    try {
      const win = window.open(url, '_blank')
      if (!win) {
        window.location.href = url
      }
    } catch (e) {
      console.error('打开URL失败', e)
    }
  }

  const handlePay = () => {
    if (!depositChecked) {
      Taro.showToast({ title: '请勾选预付费', icon: 'none' })
      return
    }

    if (payMethod === 'alipay') {
      // 常见支付宝唤起方式（不同端可能受限制）
      const urls = [
        'alipays://platformapi/startapp?appId=20000056',
        'alipayqr://platformapi/startapp?saId=10000007'
      ]
      tryOpenUrl(urls[0])
      setTimeout(() => tryOpenUrl(urls[1]), 500)
    } else {
      // 微信支付逻辑
      try {
        // 检查是否在微信环境中
        if (typeof wx !== 'undefined' && wx.miniProgram) {
          // 在微信小程序中，直接显示付款码
          Taro.showModal({
            title: '微信支付',
            content: `请使用微信扫码支付 ¥${selectedAmount.toFixed(2)}`,
            showCancel: false,
            confirmText: '确定'
          })
        } else {
          // 在其他环境中，尝试打开微信
          const url = 'weixin://'
          tryOpenUrl(url)
        }
      } catch (e) {
        // 如果检测失败，默认尝试打开微信
        const url = 'weixin://'
        tryOpenUrl(url)
      }
    }

    Taro.showToast({ title: '正在跳转支付...', icon: 'none' })
  }

  const handleRefresh = () => {
    Taro.showToast({ title: '正在刷新状态...', icon: 'none' })
  }

  const handleViewInstructions = () => {
    Taro.showToast({ title: '查看操作说明', icon: 'none' })
  }

  const handleBusinessLicense = () => {
    Taro.showToast({ title: '查看营业执照', icon: 'none' })
  }

  const amounts = [5, 10, 30, 50, 80, 100]

  return (
    <View className='start-page'>
      {/* 页面标题和说明区域 */}
      <View className='page-header'>
        <Text className='page-title'>开始充电</Text>
        <View className='charging-instructions'>
          <Text className='instruction-text'>
            请插枪后<Text className='instruction-link' onClick={handleRefresh}>点击刷新</Text>，如刷新后还不显示"已插枪"状态，请<Text className='instruction-link' onClick={handleViewInstructions}>点击这里</Text>查看操作说明
          </Text>
        </View>
      </View>

      {/* 充电站信息卡片 */}
      <View className='station-card'>
        <View className='station-header'>
          <View className='station-icon'>⚡</View>
          <View className='station-info'>
            <Text className='station-name'>{terminal.stationName || '充电站'}</Text>
            <View className='station-details'>
              <View className='detail-item'>
                <Text className='detail-icon'>🔌</Text>
                <Text>{terminal.chargerType === 'fast' ? '快充' : '慢充'}</Text>
              </View>
              <View className='detail-item'>
                <Text className='detail-icon'>⚡</Text>
                <Text>{terminal.chargerPower || 0}kW</Text>
              </View>
              <View className='detail-item'>
                <Text className='detail-icon'>📄</Text>
                <Text>支持开票</Text>
              </View>
            </View>
          </View>
        </View>
        
        <View className='terminal-info'>
          <View className='terminal-header'>
            <Text className='terminal-name'>终端信息</Text>
            <View className='terminal-status'>可用</View>
          </View>
          <View className='terminal-details'>
            <View className='detail-item'>
              <Text className='detail-icon'>💰</Text>
              <Text>当前计费时段 {Number(terminal.pricePerKwh || '0').toFixed(4)}元/度</Text>
            </View>
            <View className='detail-item'>
              <Text className='detail-icon'>🕒</Text>
              <Text>{terminal.currentPeriod || '00:00-23:59'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 充电金额选择 */}
      <View className='amount-section'>
        <View className='section-header'>
          <Text className='section-icon'>💰</Text>
          <Text className='section-title'>选择充电金额</Text>
        </View>
        
        <View className='amount-options'>
          {amounts.map(amount => (
            <View 
              key={amount} 
              className={`amount-option ${selectedAmount === amount ? 'selected' : ''}`}
              onClick={() => setSelectedAmount(amount)}
            >
              <Text className='amount-value'>{amount}</Text>
              <Text className='amount-unit'>元</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 支付方式选择 */}
      <View className='payment-section'>
        <View className='section-header'>
          <Text className='section-icon'>💳</Text>
          <Text className='section-title'>选择支付方式</Text>
          <Text className='checkmark'>✓</Text>
        </View>
        
        <View className='refund-policy'>
          预付费剩余金额原路退回
        </View>

        <View className='payment-options'>
          <View 
            className={`payment-option ${payMethod === 'alipay' ? 'selected' : ''}`}
            onClick={() => setPayMethod('alipay')}
          >
            <View className='payment-icon alipay'>支</View>
            <View className='payment-info'>
              <Text className='payment-name'>支付宝</Text>
              <Text className='payment-desc'>安全便捷的支付方式</Text>
            </View>
            <View className={`radio-button ${payMethod === 'alipay' ? 'selected' : ''}`} />
          </View>
          
          <View 
            className={`payment-option ${payMethod === 'wechat' ? 'selected' : ''}`}
            onClick={() => setPayMethod('wechat')}
          >
            <View className='payment-icon wechat'>微</View>
            <View className='payment-info'>
              <Text className='payment-name'>微信支付</Text>
              <Text className='payment-desc'>快速便捷的支付方式</Text>
            </View>
            <View className={`radio-button ${payMethod === 'wechat' ? 'selected' : ''}`} />
          </View>
        </View>
      </View>

      {/* 营业信息 */}
      <View className='business-info'>
        <View className='section-header'>
          <Text className='section-icon'>🏢</Text>
          <Text className='section-title'>营业信息</Text>
        </View>
        <View className='business-details'>
          <View className='detail-row'>
            <Text className='detail-label'>运营商类型</Text>
            <Text className='detail-value'>他营</Text>
          </View>
          <View className='detail-row'>
            <Text className='detail-label'>公司名称</Text>
            <Text className='detail-value clickable' onClick={handleBusinessLicense}>
              保定京铁轨道装备有限公司营业执照 {'>'}
            </Text>
          </View>
          <View className='detail-row'>
            <Text className='detail-label'>发票服务</Text>
            <Text className='detail-value'>保定京铁轨道装备有限公司</Text>
          </View>
          <View className='detail-row'>
            <Text className='detail-label'>服务热线</Text>
            <Text className='detail-value'>0797-966999</Text>
          </View>
        </View>
      </View>

      {/* 底部充电操作区域 */}
      <View className='charging-actions'>
        <View className='action-summary'>
          <View className='summary-info'>
            <Text className='summary-label'>普通充电</Text>
            <Text className='summary-value'>¥ {selectedAmount.toFixed(2)}</Text>
          </View>
          <View className='summary-actions'>
            <View className='action-btn' onClick={handleRefresh}>刷新</View>
            <View className='action-btn' onClick={handleViewInstructions}>说明</View>
          </View>
        </View>
        <View className='start-charging-btn' onClick={handlePay}>
          ¥ {selectedAmount.toFixed(2)} 启动充电
        </View>
      </View>
    </View>
  )
}