// URL参数处理工具

/**
 * 解析支付宝回调URL参数
 * @param router Taro路由对象
 * @returns 解析后的参数对象
 */
export const parsePaymentParams = (router?: any) => {
  let params = router?.params || {}
  
  console.log('开始解析支付参数...')
  console.log('Taro路由参数:', params)
  
  // 优先使用Taro路由参数（测试或内部调用）
  if (params.success || params.orderId || params.amount) {
    console.log('✅ 使用Taro路由参数')
    return {
      orderId: params.orderId,
      amount: params.amount,
      type: params.type || 'recharge',
      success: params.success,
      isSimpleParams: true
    }
  }
  
  // 尝试从完整URL中解析支付宝回调参数
  try {
    let currentUrl = ''
    if (typeof window !== 'undefined' && window.location) {
      currentUrl = window.location.href
    }
    
    console.log('当前URL:', currentUrl)
    
    if (currentUrl) {
      const urlObj = new URL(currentUrl)
      const searchParams = urlObj.searchParams
      
      // 检查是否是支付宝回调（包含特征参数）
      const out_trade_no = searchParams.get('out_trade_no')
      const total_amount = searchParams.get('total_amount')
      const trade_no = searchParams.get('trade_no')
      const method = searchParams.get('method')
      const charset = searchParams.get('charset')
      
      console.log('URL参数解析结果:', { 
        out_trade_no, 
        total_amount, 
        trade_no, 
        method, 
        charset 
      })
      
      // 如果是支付宝回调（presence of key parameters）
      if (out_trade_no && total_amount && method === 'alipay.trade.page.pay.return') {
        console.log('✅ 检测到支付宝回调，解析参数...')
        
        // 根据订单号判断交易类型
        let transactionType = 'recharge'
        if (out_trade_no.includes('CHARGE')) {
          transactionType = 'charging'
        } else if (out_trade_no.includes('RECHARGE')) {
          transactionType = 'recharge'
        }
        
        const result = {
          orderId: out_trade_no,
          amount: total_amount,
          type: transactionType,
          tradeNo: trade_no,
          isAlipayCallback: true
        }
        
        console.log('✅ 支付宝回调参数解析成功:', result)
        
        // 清理URL参数，保持页面整洁
        setTimeout(() => {
          cleanUrlParams()
        }, 100)
        
        return result
      }
      
      // 检查是否有我们的自定义简单参数
      const success = searchParams.get('success')
      const orderId = searchParams.get('orderId')
      const amount = searchParams.get('amount')
      const type = searchParams.get('type')
      
      if (success && orderId && amount) {
        console.log('✅ 使用自定义简单参数:', { success, orderId, amount, type })
        cleanUrlParams()
        return {
          orderId,
          amount,
          type: type || 'recharge',
          success: success === '1',
          isSimpleParams: true
        }
      }
    }
  } catch (error) {
    console.error('解析URL参数失败:', error)
  }
  
  console.log('⚠️ 未找到有效的支付参数，返回空对象')
  return {}
}

/**
 * 清理URL中的查询参数，保持页面整洁
 */
export const cleanUrlParams = () => {
  try {
    if (typeof window !== 'undefined' && window.history && window.location) {
      // 构建清洁的URL（移除所有查询参数）
      const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash.split('?')[0]}`
      
      // 使用 replaceState 替换当前历史记录，不会触发页面刷新
      window.history.replaceState({}, document.title, cleanUrl)
      
      console.log('URL已清理:', cleanUrl)
    }
  } catch (error) {
    console.warn('清理URL失败:', error)
  }
}

/**
 * 获取URL中的特定参数
 * @param paramName 参数名
 * @returns 参数值或null
 */
export const getUrlParam = (paramName: string): string | null => {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const urlObj = new URL(window.location.href)
      return urlObj.searchParams.get(paramName)
    }
  } catch (error) {
    console.warn('获取URL参数失败:', error)
  }
  return null
}

/**
 * 检查是否为支付宝回调页面
 * @returns 是否为支付宝回调
 */
export const isAlipayCallback = (): boolean => {
  try {
    const method = getUrlParam('method')
    const outTradeNo = getUrlParam('out_trade_no')
    const totalAmount = getUrlParam('total_amount')
    
    return method === 'alipay.trade.page.pay.return' || 
           (outTradeNo !== null && totalAmount !== null)
  } catch (error) {
    console.warn('检查支付宝回调失败:', error)
  }
  return false
}
