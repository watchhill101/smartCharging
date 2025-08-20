// 本地交易记录存储管理
import TaroCompat from './taroCompat'

export interface LocalTransaction {
  id: string
  type: 'recharge' | 'consume' | 'refund' | 'withdraw'
  amount: number
  description: string
  status: 'completed' | 'pending' | 'failed'
  timestamp: string
  orderId?: string
  paymentMethod?: 'alipay' | 'balance' | 'wechat'
  chargingInfo?: {
    stationName?: string
    duration?: string
    energyDelivered?: number
  }
}

const STORAGE_KEY = 'smart_charging_transactions'

/**
 * 获取本地存储的交易记录
 */
export const getLocalTransactions = (): LocalTransaction[] => {
  try {
    const stored = TaroCompat.getStorageSync(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.warn('读取本地交易记录失败:', error)
    return []
  }
}

/**
 * 保存交易记录到本地存储
 */
export const saveLocalTransactions = (transactions: LocalTransaction[]): boolean => {
  try {
    TaroCompat.setStorageSync(STORAGE_KEY, JSON.stringify(transactions))
    return true
  } catch (error) {
    console.error('保存本地交易记录失败:', error)
    return false
  }
}

/**
 * 添加新的交易记录（置于首位）
 */
export const addLocalTransaction = (transaction: Omit<LocalTransaction, 'id' | 'timestamp'>): LocalTransaction => {
  const newTransaction: LocalTransaction = {
    ...transaction,
    id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString()
  }

  const existingTransactions = getLocalTransactions()
  
  // 检查是否已存在相同的订单ID，避免重复
  if (newTransaction.orderId) {
    const existingIndex = existingTransactions.findIndex(t => t.orderId === newTransaction.orderId)
    if (existingIndex >= 0) {
      // 更新现有记录
      existingTransactions[existingIndex] = newTransaction
      saveLocalTransactions(existingTransactions)
      return newTransaction
    }
  }

  // 添加到首位
  const updatedTransactions = [newTransaction, ...existingTransactions]
  
  // 保持最多100条记录
  const limitedTransactions = updatedTransactions.slice(0, 100)
  
  saveLocalTransactions(limitedTransactions)
  
  console.log('新增本地交易记录:', newTransaction)
  return newTransaction
}

/**
 * 根据订单ID查找交易记录
 */
export const findLocalTransactionByOrderId = (orderId: string): LocalTransaction | null => {
  const transactions = getLocalTransactions()
  return transactions.find(t => t.orderId === orderId) || null
}

/**
 * 更新交易记录状态
 */
export const updateLocalTransactionStatus = (orderId: string, status: LocalTransaction['status']): boolean => {
  const transactions = getLocalTransactions()
  const index = transactions.findIndex(t => t.orderId === orderId)
  
  if (index >= 0) {
    transactions[index].status = status
    return saveLocalTransactions(transactions)
  }
  
  return false
}

/**
 * 清空本地交易记录
 */
export const clearLocalTransactions = (): boolean => {
  try {
    TaroCompat.removeStorageSync(STORAGE_KEY)
    return true
  } catch (error) {
    console.error('清空本地交易记录失败:', error)
    return false
  }
}

/**
 * 从支付成功信息创建交易记录
 */
export const createTransactionFromPayment = (paymentInfo: {
  orderId: string
  amount: number
  type: 'recharge' | 'charging'
  paymentMethod?: string
}): LocalTransaction => {
  const { orderId, amount, type, paymentMethod = 'alipay' } = paymentInfo
  
  let description: string
  let transactionType: LocalTransaction['type'] = 'recharge'
  
  if (type === 'recharge') {
    description = `支付宝充值 ¥${amount}`
    transactionType = 'recharge'
  } else {
    description = `充电扣费 ¥${amount}`
    transactionType = 'consume'
  }
  
  return addLocalTransaction({
    type: transactionType,
    amount,
    description,
    status: 'completed',
    orderId,
    paymentMethod: paymentMethod as any
  })
}
