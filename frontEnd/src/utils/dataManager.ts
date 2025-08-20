// 数据管理工具 - 用于更新data.json文件，支持数据持久化
import dataJson from '../pages/charging/data.json'

interface Transaction {
  id: string
  type: 'recharge' | 'consume' | 'refund' | 'withdraw'
  amount: number
  description: string
  orderId?: string
  paymentMethod: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  updatedAt: string
  chargingInfo?: {
    stationName?: string
    duration?: number
    energyDelivered?: number
    startTime?: string
    endTime?: string
  }
}

interface WalletData {
  walletBalance: {
    amount: number
    currency: string
    lastUpdated: string
  }
  transactions: Transaction[]
  coupons: any[]
}

class DataManager {
  private data: WalletData
  private readonly STORAGE_KEY = 'walletData'

  constructor() {
    this.data = this.loadData()
  }

  private loadData(): WalletData {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY)
      if (storedData) {
        const parsedData: WalletData = JSON.parse(storedData)
        // Ensure transactions are sorted by createdAt descending
        parsedData.transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        console.log('✅ 从 localStorage 加载数据成功:', parsedData)
        return parsedData
      }
    } catch (error) {
      console.error('❌ 从 localStorage 加载数据失败:', error)
    }
    console.log('�� 使用默认 data.json 初始化数据')
    const initialData = JSON.parse(JSON.stringify(dataJson))
    initialData.transactions.sort((a: Transaction, b: Transaction) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return initialData
  }

  private saveData(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data))
      console.log('💾 数据已保存到 localStorage')
    } catch (error) {
      console.error('❌ 保存数据到 localStorage 失败:', error)
    }
  }

  private generateNewTransactionId(): string {
    const existingIds = this.data.transactions.map(t => parseInt(t.id)).filter(id => !isNaN(id))
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0
    return (maxId + 1).toString()
  }

  addRechargeTransaction(amount: number, orderId: string, paymentMethod: string = 'alipay'): Transaction {
    const now = new Date().toISOString()
    const newTransaction: Transaction = {
      id: this.generateNewTransactionId(),
      type: 'recharge',
      amount: amount,
      description: `支付宝充值 ¥${amount}`,
      orderId: orderId,
      paymentMethod: paymentMethod,
      status: 'completed',
      createdAt: now,
      updatedAt: now
    }
    this.data.transactions.unshift(newTransaction) // Add to the beginning
    this.data.walletBalance.amount += amount
    this.data.walletBalance.lastUpdated = now
    this.saveData() // Persist changes
    console.log('✅ 添加充值交易记录:', newTransaction)
    console.log('�� 更新后余额:', this.data.walletBalance.amount)
    return newTransaction
  }

  getData(): WalletData {
    // Always return a fresh copy to prevent direct modification outside DataManager
    return JSON.parse(JSON.stringify(this.data))
  }

  getBalance(): number {
    return this.data.walletBalance.amount
  }

  getTransactions(): Transaction[] {
    // Return a sorted copy
    return JSON.parse(JSON.stringify(this.data.transactions)).sort((a: Transaction, b: Transaction) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  resetData(): void {
    this.data = JSON.parse(JSON.stringify(dataJson))
    this.saveData() // Persist reset
    console.log('🔄 数据已重置为原始状态并保存')
  }
}

const dataManager = new DataManager()
export default dataManager
export type { Transaction, WalletData }