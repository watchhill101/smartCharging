import { useState, useEffect } from 'react'
import { View, Text, Button } from '@tarojs/components'
import TaroCompat from '../../utils/taroCompat'
import { parsePaymentParams } from '../../utils/urlUtils'
import './index.scss'

export default function PaymentFailure() {
  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 使用工具函数解析支付回调参数
    const router = TaroCompat.getCurrentInstance()?.router
    const params = parsePaymentParams(router)
    const { orderId, amount, type, errorMsg } = params
    
    if (orderId && amount) {
      setOrderInfo({
        orderId,
        amount: parseFloat(amount),
        type: type || 'recharge',
        errorMsg: errorMsg || '支付过程中发生错误'
      })
    }
    
    setLoading(false)

    // 显示失败提示
    TaroCompat.showToast({
      title: '支付失败',
      icon: 'error',
      duration: 2000
    })
  }, [])

  const handleRetryPayment = () => {
    // 返回到钱包页面重新支付
    TaroCompat.switchTab({
      url: '/pages/charging/index'
    })
  }

  const handleContactSupport = () => {
    // 联系客服
    TaroCompat.showModal({
      title: '联系客服',
      content: '客服热线：400-888-8888\n工作时间：9:00-18:00',
      showCancel: false,
      confirmText: '知道了'
    })
  }

  const handleBackToHome = () => {
    TaroCompat.switchTab({
      url: '/pages/index/index'
    })
  }

  if (loading) {
    return (
      <View className='payment-failure-page loading'>
        <Text>加载中...</Text>
      </View>
    )
  }

  return (
    <View className='payment-failure-page'>
      <View className='failure-container'>
        {/* 失败图标 */}
        <View className='failure-icon'>
          <Text className='icon-text'>❌</Text>
        </View>
        
        {/* 失败标题 */}
        <Text className='failure-title'>支付失败</Text>
        <Text className='failure-subtitle'>
          {orderInfo?.type === 'recharge' ? '钱包充值失败' : '充电支付失败'}
        </Text>

        {/* 错误信息 */}
        {orderInfo?.errorMsg && (
          <View className='error-message'>
            <Text className='error-text'>{orderInfo.errorMsg}</Text>
          </View>
        )}

        {/* 订单信息 */}
        {orderInfo && (
          <View className='order-info'>
            <View className='info-item'>
              <Text className='info-label'>订单编号</Text>
              <Text className='info-value'>{orderInfo.orderId}</Text>
            </View>
            <View className='info-item'>
              <Text className='info-label'>支付金额</Text>
              <Text className='info-value amount'>¥{orderInfo.amount.toFixed(2)}</Text>
            </View>
            <View className='info-item'>
              <Text className='info-label'>失败时间</Text>
              <Text className='info-value'>{new Date().toLocaleString('zh-CN')}</Text>
            </View>
            <View className='info-item'>
              <Text className='info-label'>支付方式</Text>
              <Text className='info-value'>支付宝</Text>
            </View>
          </View>
        )}

        {/* 操作按钮 */}
        <View className='action-buttons'>
          <Button 
            className='btn btn-retry' 
            onClick={handleRetryPayment}
          >
            重新支付
          </Button>
          <Button 
            className='btn btn-secondary' 
            onClick={handleContactSupport}
          >
            联系客服
          </Button>
        </View>

        <Button 
          className='btn btn-text' 
          onClick={handleBackToHome}
        >
          返回首页
        </Button>

        {/* 常见问题 */}
        <View className='faq'>
          <Text className='faq-title'>常见支付失败原因</Text>
          <View className='faq-list'>
            <Text className='faq-item'>• 网络连接不稳定</Text>
            <Text className='faq-item'>• 支付宝余额不足</Text>
            <Text className='faq-item'>• 银行卡状态异常</Text>
            <Text className='faq-item'>• 支付密码错误</Text>
          </View>
        </View>

        {/* 温馨提示 */}
        <View className='tips'>
          <Text className='tips-title'>温馨提示</Text>
          <Text className='tips-text'>
            如果多次支付失败，请检查网络连接或联系客服获取帮助。我们将尽快为您解决问题。
          </Text>
        </View>
      </View>
    </View>
  )
}
