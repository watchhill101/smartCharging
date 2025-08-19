import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import './index.scss'

// 声明微信小程序全局对象类型
declare global {
  interface Window {
    wx?: any
  }
  const wx: any
}

interface TerminalInfo {
  terminalId: string
  stationId: string
  stationName: string
  address: string
  chargerOrder: number
  chargerType: string
  chargerPower: number
  pricePerKwh: string
  currentPeriod: string
}

export default function StartCharging() {
  const [terminalInfo, setTerminalInfo] = useState<TerminalInfo | null>(null)
  const [selectedAmount, setSelectedAmount] = useState(50)
  const [payMethod, setPayMethod] = useState<'alipay' | 'wechat'>('alipay')
  const [depositChecked, setDepositChecked] = useState(false)

  const amountOptions = [20, 50, 100, 200, 500]

  useLoad(() => {
    try {
      let terminalData = null
      
      if (typeof Taro.getStorageSync === 'function') {
        terminalData = Taro.getStorageSync('selected_terminal')
      } else {
        const browserData = localStorage.getItem('selected_terminal')
        if (browserData) {
          terminalData = JSON.parse(browserData)
        }
      }
      
      if (terminalData) {
        setTerminalInfo(terminalData)
      }
    } catch (error) {
      console.error('获取终端信息失败:', error)
    }
  })

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
      } catch (error) {
        // 如果检测失败，默认尝试打开微信
        const url = 'weixin://'
        tryOpenUrl(url)
      }
    }
  }

  const tryOpenUrl = (url: string) => {
    try {
      if (typeof Taro.openUrl === 'function') {
        Taro.openUrl({ url })
      } else {
        // 降级到浏览器打开
        window.open(url, '_blank')
      }
    } catch (error) {
      console.error('打开URL失败:', error)
      // 最后的备选方案
      try {
        window.location.href = url
      } catch (finalError) {
        console.error('所有打开方式都失败了:', finalError)
        Taro.showToast({
          title: '无法打开支付应用，请手动打开',
          icon: 'none',
          duration: 3000
        })
      }
    }
  }

  if (!terminalInfo) {
    return (
      <View className='start-page'>
        <View className='loading'>加载中...</View>
      </View>
    )
  }

  return (
    <View className='start-page'>
      {/* 站点信息卡片 */}
      <View className='station-card'>
        <View className='station-header'>
          <Text className='station-name'>{terminalInfo.stationName}</Text>
          <View className='station-tags'>
            <View className='tag slow'>慢充</View>
            <View className='tag power'>{terminalInfo.chargerPower}kW</View>
            <View className='tag invo'>支持开票</View>
          </View>
        </View>
        <View className='price-row'>
          <Text className='label'>当前计费时段</Text>
          <Text className='value'>{terminalInfo.currentPeriod}</Text>
        </View>
        <View className='price-row'>
          <Text className='label'>电费单价</Text>
          <Text className='value'>¥{terminalInfo.pricePerKwh}/度</Text>
        </View>
      </View>

      {/* 充电说明 */}
      <View className='instruction-section'>
        <Text className='instruction-title'>充电说明</Text>
        <Text className='instruction-text'>普通充电</Text>
      </View>

      {/* 金额选择 */}
      <View className='amount-section'>
        <Text className='section-title'>选择充电金额</Text>
        <View className='amount-grid'>
          {amountOptions.map(amount => (
            <View
              key={amount}
              className={`amount-option ${selectedAmount === amount ? 'selected' : ''}`}
              onClick={() => setSelectedAmount(amount)}
            >
              <Text className='amount-value'>¥{amount}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 支付方式 */}
      <View className='payment-section'>
        <Text className='section-title'>支付方式</Text>
        <View className='payment-options'>
          <View
            className={`payment-option ${payMethod === 'alipay' ? 'selected' : ''}`}
            onClick={() => setPayMethod('alipay')}
          >
            <View className='payment-icon'>💰</View>
            <Text className='payment-name'>支付宝</Text>
            <View className='payment-checkbox'>
              {payMethod === 'alipay' && <Text className='checkmark'>✓</Text>}
            </View>
          </View>
          <View
            className={`payment-option ${payMethod === 'wechat' ? 'selected' : ''}`}
            onClick={() => setPayMethod('wechat')}
          >
            <View className='payment-icon'>💳</View>
            <Text className='payment-name'>微信支付</Text>
            <View className='payment-checkbox'>
              {payMethod === 'wechat' && <Text className='checkmark'>✓</Text>}
            </View>
          </View>
        </View>
      </View>

      {/* 营业信息 */}
      <View className='business-card'>
        <View className='business-header'>
          <Text className='business-title'>营业信息</Text>
        </View>
        <View className='business-content'>
          <View className='info-row'>
            <Text className='info-label'>营业时间</Text>
            <Text className='info-value'>24小时营业</Text>
          </View>
          <View className='info-row'>
            <Text className='info-label'>服务热线</Text>
            <Text className='info-value'>0797-966999</Text>
          </View>
          <View className='info-row'>
            <Text className='info-label'>支持功能</Text>
            <Text className='info-value'>扫码充电、充电卡、发票服务</Text>
          </View>
        </View>
      </View>

      {/* 预付费确认 */}
      <View className='deposit-section'>
        <View className='deposit-checkbox' onClick={() => setDepositChecked(!depositChecked)}>
          <View className={`checkbox ${depositChecked ? 'checked' : ''}`}>
            {depositChecked && <Text className='checkmark'>✓</Text>}
          </View>
          <Text className='deposit-text'>我已阅读并同意预付费协议</Text>
        </View>
      </View>

      {/* 充电操作区域 */}
      <View className='charging-action-section'>
        <View className='charging-mode'>
          <Text className='mode-text'>普通充电</Text>
        </View>
        <View className='start-btn' onClick={handlePay}>
          <Text className='start-text'>启动充电</Text>
        </View>
      </View>
    </View>
  )
}
