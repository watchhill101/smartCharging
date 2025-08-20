import mongoose, { Schema, Document } from 'mongoose'

// 交易记录接口
export interface ITransaction {
  id: string
  type: 'recharge' | 'consume' | 'refund' | 'withdraw'
  amount: number
  description: string
  orderId?: string
  paymentMethod?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  createdAt: Date
  updatedAt: Date
}

// 发票信息接口
export interface IInvoiceInfo {
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
export interface IInvoice {
  id: string
  invoiceNumber: string
  amount: number
  title: string
  taxNumber?: string
  content: string
  type: 'electronic' | 'paper'
  status: 'pending' | 'issued' | 'sent' | 'cancelled'
  transactionIds: string[]
  appliedAt: Date
  issuedAt?: Date
  downloadUrl?: string
  createdAt: Date
  updatedAt: Date
}

// 支付方式接口
export interface IPaymentMethod {
  id: string
  type: 'alipay' | 'wechat' | 'bank_card' | 'balance'
  name: string
  isDefault: boolean
  isEnabled: boolean
}

// 钱包接口
export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId
  balance: number
  frozenAmount: number
  totalRecharge: number
  totalConsume: number
  transactions: ITransaction[]
  invoiceInfo: IInvoiceInfo[]
  invoices: IInvoice[]
  paymentMethods: IPaymentMethod[]
  settings: {
    autoInvoice: boolean
    invoiceEmail: string
    defaultPaymentMethod: string
  }
  createdAt: Date
  updatedAt: Date
}

// 交易记录Schema
const TransactionSchema = new Schema<ITransaction>({
  id: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: ['recharge', 'consume', 'refund', 'withdraw'] },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  orderId: { type: String },
  paymentMethod: { type: String },
  status: { type: String, required: true, enum: ['pending', 'completed', 'failed', 'cancelled'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// 发票信息Schema
const InvoiceInfoSchema = new Schema<IInvoiceInfo>({
  type: { type: String, required: true, enum: ['personal', 'company'] },
  title: { type: String, required: true },
  taxNumber: { type: String },
  address: { type: String },
  phone: { type: String },
  bankName: { type: String },
  bankAccount: { type: String },
  email: { type: String, required: true },
  isDefault: { type: Boolean, default: false }
})

// 发票记录Schema
const InvoiceSchema = new Schema<IInvoice>({
  id: { type: String, required: true, unique: true },
  invoiceNumber: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  title: { type: String, required: true },
  taxNumber: { type: String },
  content: { type: String, required: true },
  type: { type: String, required: true, enum: ['electronic', 'paper'] },
  status: { type: String, required: true, enum: ['pending', 'issued', 'sent', 'cancelled'] },
  transactionIds: [{ type: String }],
  appliedAt: { type: Date, required: true },
  issuedAt: { type: Date },
  downloadUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// 支付方式Schema
const PaymentMethodSchema = new Schema<IPaymentMethod>({
  id: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: ['alipay', 'wechat', 'bank_card', 'balance'] },
  name: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  isEnabled: { type: Boolean, default: true }
})

// 钱包Schema
const WalletSchema = new Schema<IWallet>({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', unique: true },
  balance: { type: Number, default: 0, min: 0 },
  frozenAmount: { type: Number, default: 0, min: 0 },
  totalRecharge: { type: Number, default: 0, min: 0 },
  totalConsume: { type: Number, default: 0, min: 0 },
  transactions: [TransactionSchema],
  invoiceInfo: [InvoiceInfoSchema],
  invoices: [InvoiceSchema],
  paymentMethods: [PaymentMethodSchema],
  settings: {
    autoInvoice: { type: Boolean, default: false },
    invoiceEmail: { type: String },
    defaultPaymentMethod: { type: String, default: 'balance' }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// 索引
WalletSchema.index({ userId: 1 })
WalletSchema.index({ 'transactions.id': 1 })
WalletSchema.index({ 'transactions.orderId': 1 })
WalletSchema.index({ 'invoices.id': 1 })
WalletSchema.index({ 'invoices.invoiceNumber': 1 })

// 实例方法
WalletSchema.methods.addTransaction = function(transaction: Omit<ITransaction, 'id' | 'createdAt' | 'updatedAt'>) {
  const newTransaction: ITransaction = {
    ...transaction,
    id: new mongoose.Types.ObjectId().toString(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  this.transactions.push(newTransaction)
  this.updatedAt = new Date()
  
  // 更新余额
  if (transaction.status === 'completed') {
    switch (transaction.type) {
      case 'recharge':
        this.balance += transaction.amount
        this.totalRecharge += transaction.amount
        break
      case 'consume':
        this.balance -= transaction.amount
        this.totalConsume += transaction.amount
        break
      case 'refund':
        this.balance += transaction.amount
        break
      case 'withdraw':
        this.balance -= transaction.amount
        break
    }
  }
  
  return newTransaction
}

WalletSchema.methods.addInvoiceInfo = function(invoiceInfo: Omit<IInvoiceInfo, 'isDefault'>) {
  // 如果是第一个发票信息或者没有默认的，设为默认
  const isFirst = this.invoiceInfo.length === 0
  const hasDefault = this.invoiceInfo.some((info: IInvoiceInfo) => info.isDefault)
  
  const newInvoiceInfo: IInvoiceInfo = {
    ...invoiceInfo,
    isDefault: isFirst || !hasDefault
  }
  
  // 如果设为默认，取消其他默认设置
  if (newInvoiceInfo.isDefault) {
    this.invoiceInfo.forEach((info: IInvoiceInfo) => {
      info.isDefault = false
    })
  }
  
  this.invoiceInfo.push(newInvoiceInfo)
  this.updatedAt = new Date()
  
  return newInvoiceInfo
}

WalletSchema.methods.createInvoice = function(invoiceData: Omit<IInvoice, 'id' | 'invoiceNumber' | 'appliedAt' | 'createdAt' | 'updatedAt'>) {
  const newInvoice: IInvoice = {
    ...invoiceData,
    id: new mongoose.Types.ObjectId().toString(),
    invoiceNumber: `INV${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
    appliedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  this.invoices.push(newInvoice)
  this.updatedAt = new Date()
  
  return newInvoice
}

WalletSchema.methods.getAvailableBalance = function() {
  return this.balance - this.frozenAmount
}

WalletSchema.methods.freezeAmount = function(amount: number) {
  if (this.getAvailableBalance() < amount) {
    throw new Error('余额不足')
  }
  this.frozenAmount += amount
  this.updatedAt = new Date()
}

WalletSchema.methods.unfreezeAmount = function(amount: number) {
  this.frozenAmount = Math.max(0, this.frozenAmount - amount)
  this.updatedAt = new Date()
}

// 静态方法
WalletSchema.statics.createDefaultWallet = function(userId: mongoose.Types.ObjectId) {
  const defaultPaymentMethods: IPaymentMethod[] = [
    {
      id: 'alipay',
      type: 'alipay',
      name: '支付宝',
      isDefault: true,
      isEnabled: true
    }
  ]
  
  return new this({
    userId,
    balance: 0,
    frozenAmount: 0,
    totalRecharge: 0,
    totalConsume: 0,
    transactions: [],
    invoiceInfo: [],
    invoices: [],
    paymentMethods: defaultPaymentMethods,
    settings: {
      autoInvoice: false,
      invoiceEmail: '',
      defaultPaymentMethod: 'alipay'
    }
  })
}

// 更新时间中间件
WalletSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

export default mongoose.model<IWallet>('Wallet', WalletSchema)
