import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Button, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
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

// 发票接口
interface Invoice {
  id: string
  invoiceNumber: string
  date: string
  amount: number
  description: string
  status: 'paid' | 'pending' | 'overdue'
}

export default function Charging() {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'balance' | 'coupons' | 'invoices'>('balance')
  const [selectedAmount, setSelectedAmount] = useState<string>('')
  const [customAmount, setCustomAmount] = useState<string>('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [showRechargeModal, setShowRechargeModal] = useState(false)

  useEffect(() => {
    // 初始化移动端优化
    MobileDetect.init()
    
    loadWalletData()
    
    // 监听屏幕方向变化
    MobileDetect.onOrientationChange((orientation) => {
      console.log('屏幕方向变化:', orientation)
    })
  }, [])

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
          autoInvoice: false,
          invoiceEmail: '',
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
      
      setInvoices([
        {
          id: '1',
          invoiceNumber: 'INV-2023-001',
          date: '2023-06-05',
          amount: 59.99,
          description: '在线购物',
          status: 'paid'
        },
        {
          id: '2',
          invoiceNumber: 'INV-2023-002',
          date: '2023-05-12',
          amount: 100.00,
          description: '钱包充值',
          status: 'paid'
        },
        {
          id: '3',
          invoiceNumber: 'INV-2023-003',
          date: '2023-04-28',
          amount: 29.99,
          description: '订阅续费',
          status: 'paid'
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
      Taro.showToast({
        title: '请输入有效金额',
        icon: 'error'
      })
      return
    }

    if (!selectedPaymentMethod) {
      Taro.showToast({
        title: '请选择支付方式',
        icon: 'error'
      })
      return
    }

    try {
      await WalletService.createRecharge(parseFloat(amount), selectedPaymentMethod)
      
      Taro.showToast({
        title: '充值订单创建成功',
        icon: 'success'
      })
      
      // 刷新数据
      loadWalletData()
    } catch (error) {
      console.error('充值失败', error)
      Taro.showToast({
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

  // 获取发票状态样�?
  const getInvoiceStatusClass = (status: string) => {
    switch (status) {
      case 'paid': return 'invoice-paid'
      case 'pending': return 'invoice-pending'
      case 'overdue': return 'invoice-overdue'
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

      {/* Balance Card */}
      <View className='balance-card'>
        <View className='card-decoration'>
          <View className='waves'></View>
        </View>
        
        <View className='balance-main'>
          <Text className='balance-label'>钱包余额</Text>
          <View className='balance-amount-container'>
            <Text className='currency-symbol'>￥</Text>
            <Text className='balance-amount'>{walletInfo?.balance.toFixed(2) || '0.00'}</Text>
          </View>
        </View>
        
                 <View className='balance-actions'>
           <Button className='recharge-btn-main' onClick={() => setShowRechargeModal(true)}>
             立即充值
           </Button>
         </View>

         {/* Integrated Tab Navigation */}
         <View className='card-tab-navigation'>
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
           <View 
             className={`card-tab-item ${activeTab === 'invoices' ? 'card-tab-active' : ''}`}
             onClick={() => setActiveTab('invoices')}
           >
             <Text className='card-tab-icon'>🧾</Text>
             <Text className='card-tab-text'>发票</Text>
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

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <View className='invoices-tab'>
              <View className='invoices-header'>
                <Text className='section-title'>发票历史</Text>
                <Button className='export-btn'>📤 导出全部</Button>
              </View>
              <View className='invoices-list'>
                {invoices.map((invoice) => (
                  <View key={invoice.id} className='invoice-item'>
                    <View className='invoice-main'>
                      <View className='invoice-info'>
                        <Text className='invoice-number'>{invoice.invoiceNumber}</Text>
                        <Text className='invoice-date'>{invoice.date}</Text>
                      </View>
                      <View className='invoice-amount-status'>
                        <Text className='invoice-amount'>${invoice.amount.toFixed(2)}</Text>
                        <View className={`invoice-status ${getInvoiceStatusClass(invoice.status)}`}>
                          <Text className='status-icon'>✓</Text>
                          <Text className='status-text'>已支付</Text>
                        </View>
                      </View>
                    </View>
                    <View className='invoice-footer'>
                      <Text className='invoice-description'>{invoice.description}</Text>
                      <View className='invoice-actions'>
                        <Button className='action-btn'>👁️ 查看</Button>
                        <Button className='action-btn'>📥 下载</Button>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
              <Button className='load-more-btn'>
                加载更多 ↓
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
