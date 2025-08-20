import { useState, useEffect } from 'react'
import { View, Text, Button } from '@tarojs/components'
import TaroCompat from '../../utils/taroCompat'
import dataManager from '../../utils/dataManager'
import './index.scss'

export default function PaymentSuccess() {
  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('支付成功页面加载')
    
    try {
      // 直接从URL解析支付宝回调参数
      let orderId = ''
      let amount = '' // 兼容字段（可能是充值金额）
      let rechargeAmount = '' // 实际充值到钱包余额的金额（原始金额）
      let paymentAmount = '' // 用户实际支付金额（优惠后）
      let type = 'recharge'
      let tradeNo = ''
      let isAlipayCallback = false

      // 方法1：优先使用Taro路由参数
      const router = TaroCompat.getCurrentInstance()?.router
      if (router?.params) {
        console.log('Taro路由参数:', router.params)
        orderId = router.params.orderId || router.params.out_trade_no || ''
        // 优先使用明确语义的字段
        rechargeAmount = router.params.rechargeAmount || router.params.amount || router.params.total_amount || ''
        paymentAmount = router.params.paymentAmount || router.params.total_amount || ''
        amount = rechargeAmount || router.params.amount || router.params.total_amount || ''
        type = router.params.type || 'recharge'
        tradeNo = router.params.tradeNo || router.params.trade_no || ''
      }

      // 方法2：直接从浏览器URL解析（更可靠）
      if (typeof window !== 'undefined' && window.location.href) {
        try {
          const url = new URL(window.location.href)
          const searchParams = url.searchParams
          
          console.log('URL中的所有参数:')
          for (let [key, value] of searchParams.entries()) {
            console.log(`  ${key}: ${value}`)
          }
          
          // 提取关键参数
          const urlOrderId = searchParams.get('out_trade_no')
          const urlRechargeAmount = searchParams.get('rechargeAmount')
          const urlPaymentAmount = searchParams.get('paymentAmount')
          const urlAmount = searchParams.get('amount') || searchParams.get('total_amount')
          const urlTradeNo = searchParams.get('trade_no')
          const urlMethod = searchParams.get('method')
          
          // 优先采用具有语义的字段
          if (urlRechargeAmount) {
            rechargeAmount = urlRechargeAmount
            amount = urlRechargeAmount
            console.log('✅ 从URL提取到充值金额:', rechargeAmount)
          } else if (urlAmount) {
            // 兼容模式：amount 作为充值金额
            amount = urlAmount
            rechargeAmount = urlAmount
            console.log('✅ 从URL提取到金额(兼容为充值金额):', amount)
          }

          if (urlPaymentAmount) {
            paymentAmount = urlPaymentAmount
            console.log('✅ 从URL提取到支付金额:', paymentAmount)
          }
          
          if (urlOrderId) {
            orderId = urlOrderId
            console.log('✅ 从URL提取到订单号:', orderId)
          }
          
          if (urlTradeNo) {
            tradeNo = urlTradeNo
            console.log('✅ 从URL提取到交易流水号:', tradeNo)
          }
          
          if (urlMethod && urlMethod.includes('alipay')) {
            isAlipayCallback = true
            console.log('✅ 检测到支付宝回调')
          }
          
          // 根据订单号判断交易类型
          if (urlOrderId && urlOrderId.includes('RECHARGE')) {
            type = 'recharge'
          } else if (urlOrderId && urlOrderId.includes('CHARGE')) {
            type = 'charging'
          }
          
        } catch (error) {
          console.error('URL解析失败:', error)
        }
      }

      console.log('最终解析结果:', { orderId, amount, rechargeAmount, paymentAmount, type, tradeNo, isAlipayCallback })
      
      // 设置订单信息
      if (orderId && (rechargeAmount || amount)) {
        const actualRechargeAmount = parseFloat(rechargeAmount || amount)
        const actualPaymentAmount = parseFloat(paymentAmount || amount)
        
        // 添加到data.json并更新余额（使用充值金额而非支付金额）
        try {
          const newTransaction = dataManager.addRechargeTransaction(actualRechargeAmount, orderId, 'alipay')
          
          // 扩展订单数据，添加新信息
          const orderData = {
            orderId,
            rechargeAmount: actualRechargeAmount, // 充值金额（入账金额）
            paymentAmount: actualPaymentAmount, // 实付金额
            amount: actualRechargeAmount, // 兼容：amount 等于充值金额
            type: type || 'recharge',
            tradeNo,
            isAlipayCallback: isAlipayCallback || false,
            // 新增显示信息
            transactionId: newTransaction.id,
            newBalance: dataManager.getBalance(),
            savedAmount: Math.max(0, actualRechargeAmount - actualPaymentAmount)
          }
          
          setOrderInfo(orderData)
          
          console.log('🎉 支付成功，交易记录已添加到data.json')
          console.log('💰 新余额:', orderData.newBalance)
          
          // 通知钱包页面刷新数据
          TaroCompat.eventCenter.trigger('refreshWalletData')
          
        } catch (error) {
          console.error('❌ 添加交易记录失败:', error)
          // 即使失败也要显示基本信息（保持原有逻辑）
          setOrderInfo({
            orderId,
            rechargeAmount: actualRechargeAmount,
            paymentAmount: actualPaymentAmount,
            amount: actualRechargeAmount,
            type: type || 'recharge',
            tradeNo,
            isAlipayCallback: isAlipayCallback || false
          })
        }
        
        // 显示成功提示
        TaroCompat.showToast({
          title: '支付成功！',
          icon: 'success',
          duration: 2000
        })
      } else {
        console.warn('未找到订单信息，显示默认成功页面')
        setOrderInfo({
          orderId: '未知订单',
          amount: 0,
          type: 'recharge'
        })
      }
    } catch (error) {
      console.error('页面初始化失败:', error)
      setOrderInfo({
        orderId: '订单异常',
        amount: 0,
        type: 'recharge'
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleBackToWallet = () => {
    TaroCompat.switchTab({
      url: '/pages/charging/index'
    })
  }

  // 预留：查看订单入口（当前未使用）

  if (loading) {
    return (
      <View className='payment-success-page loading'>
        <Text>加载中...</Text>
      </View>
    )
  }

  return (
    <View className='payment-success-page'>
      <View className='success-container'>
        {/* 成功图标 */}
        <View className='success-icon'>
          <Text className='icon-text'>✅</Text>
        </View>
        
        {/* 成功标题 */}
        <Text className='success-title'>支付成功</Text>
        <Text className='success-subtitle'>
          {orderInfo?.type === 'recharge' ? '钱包充值成功' : '充电支付成功'}
        </Text>

        {/* 订单信息 */}
        {orderInfo && (
          <View className='order-info'>
            <View className='info-item'>
              <Text className='info-label'>订单编号</Text>
              <Text className='info-value'>{orderInfo.orderId}</Text>
            </View>
            <View className='info-item'>
              <Text className='info-label'>充值金额</Text>
              <Text className='info-value amount'>¥{(orderInfo.rechargeAmount ?? orderInfo.amount).toFixed(2)}</Text>
            </View>
            {orderInfo.paymentAmount !== undefined && orderInfo.paymentAmount !== orderInfo.rechargeAmount && (
              <View className='info-item'>
                <Text className='info-label'>实际支付</Text>
                <Text className='info-value amount'>¥{orderInfo.paymentAmount.toFixed(2)}</Text>
              </View>
            )}
            {orderInfo.savedAmount !== undefined && orderInfo.savedAmount > 0 && (
              <View className='info-item saved-highlight'>
                <Text className='info-label'>优惠券节省</Text>
                <Text className='info-value saved-amount'>¥{orderInfo.savedAmount.toFixed(2)}</Text>
              </View>
            )}
            <View className='info-item'>
              <Text className='info-label'>支付时间</Text>
              <Text className='info-value'>{new Date().toLocaleString('zh-CN')}</Text>
            </View>
            <View className='info-item'>
              <Text className='info-label'>支付方式</Text>
              <Text className='info-value'>支付宝</Text>
            </View>
            {/* 新增：交易记录ID */}
            {orderInfo.transactionId && (
              <View className='info-item'>
                <Text className='info-label'>交易记录ID</Text>
                <Text className='info-value'>{orderInfo.transactionId}</Text>
              </View>
            )}
            {/* 新增：账户余额 */}
            {orderInfo.newBalance !== undefined && (
              <View className='info-item balance-highlight'>
                <Text className='info-label'>账户余额</Text>
                <Text className='info-value balance-amount'>¥{orderInfo.newBalance.toFixed(2)}</Text>
              </View>
            )}
            {orderInfo.tradeNo && (
              <View className='info-item'>
                <Text className='info-label'>交易流水号</Text>
                <Text className='info-value'>{orderInfo.tradeNo}</Text>
              </View>
            )}
          </View>
        )}

        {/* 操作按钮 */}
        <View className='action-buttons'>
          <Button 
            className='btn btn-primary' 
            onClick={handleBackToWallet}
          >
            返回钱包
          </Button>
        </View>



        {/* 温馨提示 */}
        <View className='tips'>
          <Text className='tips-title'>温馨提示</Text>
          <Text className='tips-text'>
            {orderInfo?.type === 'recharge' 
              ? '充值金额已到账，可在钱包中查看余额变化'
              : '支付完成后，充电服务将自动开始，请注意充电状态'
            }
          </Text>
        </View>
      </View>
    </View>
  )
}
