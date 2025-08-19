import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import './index.scss'

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
  const [selectedAmount, setSelectedAmount] = useState<number>(5)
  const [payMethod, setPayMethod] = useState<'alipay' | 'wechat'>('alipay')
  const [depositChecked, setDepositChecked] = useState(true)

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

  const handleBack = () => {
    try {
      if (typeof Taro.navigateBack === 'function') {
        Taro.navigateBack({
          fail: () => fallbackBack()
        })
      } else {
        fallbackBack()
      }
    } catch {
      fallbackBack()
    }
  }

  const fallbackBack = () => {
    try {
      if (typeof Taro.switchTab === 'function') {
        Taro.switchTab({ url: '/pages/index/index' })
      } else if (window.history.length > 1) {
        window.history.back()
      } else {
        window.location.hash = '#/pages/index/index'
      }
    } catch (e) {
      console.error('返回失败:', e)
    }
  }

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
      <View className='nav'>
        <View className='back' onClick={handleBack}>
          <Text className='back-icon'>‹</Text>
        </View>
        <Text className='title'>开始充电</Text>
        <View className='spacer' />
      </View>

      {/* 充电说明 */}
      <View className='instruction-section'>
        <Text className='instruction-text'>
          请插枪后<Text className='clickable-link' onClick={handleRefresh}>点击刷新</Text>,
          如刷新后还不显示"已插枪"状态,请<Text className='clickable-link' onClick={handleViewInstructions}>点击这里</Text>查看操作说明
        </Text>
      </View>

      {/* 站点与终端信息 */}
      <View className='station-card'>
        <Text className='station-name'>{terminal.stationName || '充电站'}</Text>
        <View className='tags'>
          <View className='tag'>{terminal.chargerType === 'fast' ? '快充' : '慢充'}</View>
          <View className='tag power'>{terminal.chargerPower || 0}kW</View>
          <View className='tag invo'>支持开票</View>
        </View>
        <View className='price-row'>
          <Text className='label'>当前计费时段</Text>
          <Text className='price'>
            <Text className='num'>{Number(terminal.pricePerKwh || '0').toFixed(4)}</Text>元/度
          </Text>
        </View>
        <View className='period'>
          {terminal.currentPeriod || '00:00-23:59'}
        </View>
      </View>

      {/* 支付方式 */}
      <View className='pay-card'>
        <View className='pay-head'>
          <Text className='pay-title'>选择支付方式</Text>
          <Text className='pay-note'>充电声明</Text>
        </View>

        <View className='deposit'>
          <View className={`check ${depositChecked ? 'checked' : ''}`} onClick={() => setDepositChecked(v => !v)}>
            <Text>✔</Text>
          </View>
          <Text className='deposit-title'>预付费</Text>
          <Text className='deposit-desc'>剩余金额原路退回</Text>
        </View>

        <View className='amount-grid'>
          {amounts.map(a => (
            <View key={a} className={`amount-item ${selectedAmount === a ? 'selected' : ''}`} onClick={() => setSelectedAmount(a)}>
              <Text className='amount-text'>{a}元</Text>
            </View>
          ))}
        </View>

        <View className='pay-methods'>
          <View className={`method ${payMethod === 'alipay' ? 'active' : ''}`} onClick={() => setPayMethod('alipay')}>
            <Text className='icon'>🅰️</Text>
            <Text className='text'>支付宝</Text>
          </View>
          <View className={`method ${payMethod === 'wechat' ? 'active' : ''}`} onClick={() => setPayMethod('wechat')}>
            <Text className='icon'>🟢</Text>
            <Text className='text'>微信支付</Text>
          </View>
        </View>
      </View>

      {/* 营业信息 */}
      <View className='business-card'>
        <View className='business-header'>
          <Text className='business-title'>营业信息</Text>
          <View className='business-tag'>他营</View>
        </View>
        <View className='business-details'>
          <View className='info-line'>
            <Text className='label'>公司名称:</Text>
            <Text className='value'>保定京铁轨道装备有限公司</Text>
            <Text className='license-link' onClick={handleBusinessLicense}>营业执照 {'>'}</Text>
          </View>
          <View className='info-line'>
            <Text className='label'>发票服务:</Text>
            <Text className='value'>保定京铁轨道装备有限公司</Text>
          </View>
          <View className='info-line'>
            <Text className='label'>服务热线:</Text>
            <Text className='value'>0797-966999</Text>
          </View>
        </View>
      </View>

      {/* 充电操作区域 */}
      <View className='charging-action-section'>
        <View className='charging-mode'>普通充电</View>
        <View className='start-btn' onClick={handlePay}>
          <Text className='start-text'>¥ {selectedAmount.toFixed(2)} 启动充电</Text>
        </View>
      </View>
    </View>
  )
}
