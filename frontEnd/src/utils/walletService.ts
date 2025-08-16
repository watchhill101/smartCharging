import Taro from '@tarojs/taro'

// 钱包信息接口
export interface WalletInfo {
  balance: number
  frozenAmount: number
  availableBalance: number
  totalRecharge: number
  totalConsume: number
  paymentMethods: PaymentMethod[]
  settings: WalletSettings
}

// 支付方式接口
export interface PaymentMethod {
  id: string
  type: 'alipay' | 'wechat' | 'bank_card' | 'balance'
  name: string
  isDefault: boolean
  isEnabled: boolean
}

// 钱包设置接口
export interface WalletSettings {
  autoInvoice: boolean
  invoiceEmail: string
  defaultPaymentMethod: string
}

// 交易记录接口
export interface Transaction {
  id: string
  type: 'recharge' | 'consume' | 'refund' | 'withdraw'
  amount: number
  description: string
  orderId?: string
  paymentMethod?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

// 发票信息接口
export interface InvoiceInfo {
  type: 'personal' | 'company'
  title: string
  taxNumber?: string
  address?: string
  phone?: string
  bankName?: string
  bankAccount?: string
  email: string
  isDefault: boolean
}

// 发票记录接口
export interface Invoice {
  id: string
  invoiceNumber: string
  amount: number
  title: string
  taxNumber?: string
  content: string
  type: 'electronic' | 'paper'
  status: 'pending' | 'issued' | 'sent' | 'cancelled'
  transactionIds: string[]
  appliedAt: string
  issuedAt?: string
  downloadUrl?: string
  createdAt: string
  updatedAt: string
}

// 分页接口
export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// API响应接口
interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  errors?: any[]
}

class WalletService {
  private baseUrl = 'http://localhost:3000/api/wallet' // 根据实际后端地址调整

  // 发起请求的通用方法
  private async request<T>(
    url: string, 
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      data?: any
      header?: Record<string, string>
    } = {}
  ): Promise<T> {
    const { method = 'GET', data, header = {} } = options
    
    try {
      // 获取token
      const token = Taro.getStorageSync('token')
      if (token) {
        header['Authorization'] = `Bearer ${token}`
      }

      const response = await Taro.request({
        url: `${this.baseUrl}${url}`,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          ...header
        }
      })

      const result = response.data as ApiResponse<T>
      
      if (!result.success) {
        throw new Error(result.message || '请求失败')
      }

      return result.data as T
    } catch (error) {
      console.error('API请求失败:', error)
      throw error
    }
  }

  // 获取钱包信息
  async getWalletInfo(): Promise<WalletInfo> {
    return this.request<WalletInfo>('/info')
  }

  // 获取交易记录
  async getTransactions(params: {
    page?: number
    limit?: number
    type?: 'recharge' | 'consume' | 'refund' | 'withdraw'
  } = {}): Promise<{ transactions: Transaction[], pagination: Pagination }> {
    const queryString = new URLSearchParams(params as any).toString()
    return this.request<{ transactions: Transaction[], pagination: Pagination }>(
      `/transactions${queryString ? `?${queryString}` : ''}`
    )
  }

  // 创建充值订单
  async createRecharge(amount: number, paymentMethod: string): Promise<{
    orderId: string
    amount: number
    paymentMethod: string
    status: string
  }> {
    return this.request('/recharge', {
      method: 'POST',
      data: { amount, paymentMethod }
    })
  }

  // 余额支付
  async payWithBalance(amount: number, description: string, orderId?: string): Promise<{
    transactionId: string
    remainingBalance: number
  }> {
    return this.request('/pay', {
      method: 'POST',
      data: { amount, description, orderId }
    })
  }

  // 获取发票信息列表
  async getInvoiceInfoList(): Promise<InvoiceInfo[]> {
    return this.request<InvoiceInfo[]>('/invoice-info')
  }

  // 添加发票信息
  async addInvoiceInfo(invoiceInfo: Omit<InvoiceInfo, 'isDefault'>): Promise<InvoiceInfo> {
    return this.request('/invoice-info', {
      method: 'POST',
      data: invoiceInfo
    })
  }

  // 获取发票记录
  async getInvoices(params: {
    page?: number
    limit?: number
    status?: 'pending' | 'issued' | 'sent' | 'cancelled'
  } = {}): Promise<{ invoices: Invoice[], pagination: Pagination }> {
    const queryString = new URLSearchParams(params as any).toString()
    return this.request<{ invoices: Invoice[], pagination: Pagination }>(
      `/invoices${queryString ? `?${queryString}` : ''}`
    )
  }

  // 申请开票
  async applyInvoice(params: {
    transactionIds: string[]
    invoiceInfoIndex: number
    content: string
    type: 'electronic' | 'paper'
  }): Promise<{
    invoiceId: string
    invoiceNumber: string
    amount: number
  }> {
    return this.request('/apply-invoice', {
      method: 'POST',
      data: params
    })
  }

  // 更新支付方式设置
  async updatePaymentMethods(params: {
    defaultPaymentMethod: string
    enabledMethods: string[]
  }): Promise<PaymentMethod[]> {
    return this.request('/payment-methods', {
      method: 'PUT',
      data: params
    })
  }

  // 获取收支统计
  async getStatistics(period: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<{
    period: string
    totalIncome: number
    totalExpense: number
    netAmount: number
    recentTransactions: Transaction[]
  }> {
    return this.request(`/statistics?period=${period}`)
  }

  // 模拟支付成功（用于测试）
  async simulatePaymentSuccess(orderId: string): Promise<void> {
    // 这里可以添加模拟支付成功的逻辑
    console.log(`模拟支付成功: ${orderId}`)
  }

  // 格式化金额显示
  formatAmount(amount: number): string {
    return `¥${amount.toFixed(2)}`
  }

  // 格式化日期显示
  formatDate(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    } else if (diffDays === 1) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
    }
  }

  // 获取交易类型显示文本
  getTransactionTypeText(type: string): string {
    const typeMap = {
      'recharge': '充值',
      'consume': '消费',
      'refund': '退款',
      'withdraw': '提现'
    }
    return typeMap[type] || type
  }

  // 获取交易状态显示文本
  getTransactionStatusText(status: string): string {
    const statusMap = {
      'pending': '处理中',
      'completed': '已完成',
      'failed': '失败',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  }

  // 获取支付方式显示文本
  getPaymentMethodText(type: string): string {
    const methodMap = {
      'alipay': '支付宝',
      'wechat': '微信支付',
      'bank_card': '银行卡',
      'balance': '余额支付'
    }
    return methodMap[type] || type
  }

  // 获取发票状态显示文本
  getInvoiceStatusText(status: string): string {
    const statusMap = {
      'pending': '处理中',
      'issued': '已开票',
      'sent': '已发送',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  }
}

export default new WalletService()
