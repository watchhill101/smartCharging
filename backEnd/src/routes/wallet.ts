import express, { Request, Response } from 'express'
import Wallet from '../models/Wallet'
import { authenticate } from '../middleware/auth'
import { body, query, validationResult } from 'express-validator'

const router = express.Router()

// 中间件：验证请求参数
const handleValidationErrors = (req: Request, res: Response, next: express.NextFunction) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    })
  }
  next()
}

// 获取钱包信息
router.get('/info', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      })
    }

    let wallet = await Wallet.findOne({ userId })
    
    // 如果钱包不存在，创建默认钱包
    if (!wallet) {
      wallet = (Wallet as any).createDefaultWallet(userId)
      await wallet.save()
    }

    res.json({
      success: true,
      data: {
        balance: wallet.balance,
        frozenAmount: wallet.frozenAmount,
        availableBalance: wallet.balance - wallet.frozenAmount,
        totalRecharge: wallet.totalRecharge,
        totalConsume: wallet.totalConsume,
        paymentMethods: wallet.paymentMethods,
        settings: wallet.settings
      }
    })
  } catch (error) {
    console.error('获取钱包信息失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    })
  }
})

// 获取交易记录
router.get('/transactions', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['recharge', 'consume', 'refund', 'withdraw'])
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const type = req.query.type as string

    const wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: '钱包不存在'
      })
    }

    let transactions = wallet.transactions
    
    if (type) {
      transactions = transactions.filter(t => t.type === type)
    }

    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const total = transactions.length
    const startIndex = (page - 1) * limit
    const paginatedTransactions = transactions.slice(startIndex, startIndex + limit)

    res.json({
      success: true,
      data: {
        transactions: paginatedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('获取交易记录失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    })
  }
})

// 创建充值订单
router.post('/recharge', authenticate, [
  body('amount').isFloat({ min: 0.01 }).withMessage('充值金额必须大于0.01'),
  body('paymentMethod').isIn(['alipay', 'wechat', 'bank_card']).withMessage('支付方式无效')
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const { amount, paymentMethod } = req.body

    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = (Wallet as any).createDefaultWallet(userId)
      await wallet.save()
    }

    if (!wallet) {
      return res.status(500).json({
        success: false,
        message: '钱包创建失败'
      })
    }

    // 手动创建交易记录
    const transaction = {
      id: new Date().getTime().toString(),
      type: 'recharge' as const,
      amount: parseFloat(amount),
      description: `${paymentMethod === 'alipay' ? '支付宝' : paymentMethod === 'wechat' ? '微信' : '银行卡'}充值`,
      paymentMethod,
      status: 'pending' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    wallet.transactions.push(transaction)
    await wallet.save()

    res.json({
      success: true,
      data: {
        orderId: transaction.id,
        amount: transaction.amount,
        paymentMethod,
        status: 'pending'
      },
      message: '充值订单创建成功'
    })
  } catch (error) {
    console.error('创建充值订单失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    })
  }
})

export default router