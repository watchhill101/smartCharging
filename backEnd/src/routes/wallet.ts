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
router.get('/info', /* authenticate, */ async (req: Request, res: Response) => {
  try {
    // const userId = req.user?.id // 临时注释掉用于测试
    const userId = 'test-user-id' // 使用测试用户ID
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      })
    }

    let wallet = await Wallet.findOne({ userId })
    
    // 如果钱包不存在，创建默认钱包
    if (!wallet) {
      try {
        const newWallet = (Wallet as any).createDefaultWallet(userId)
        await newWallet.save()
        wallet = newWallet
      } catch (createError) {
        console.error('创建钱包失败:', createError)
        wallet = null
      }
    }

    if (!wallet) {
      return res.status(500).json({
        success: false,
        message: '无法创建钱包'
      })
    }

    res.json({
      success: true,
      data: {
        balance: wallet.balance,
        frozenAmount: wallet.frozenAmount,
        availableBalance: (wallet as any).getAvailableBalance(),
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
router.get('/transactions', /* authenticate, */ [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['recharge', 'consume', 'refund', 'withdraw'])
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    // const userId = req.user?.id // 临时注释掉用于测试
    const userId = 'test-user-id' // 使用测试用户ID
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
      try {
        const newWallet = (Wallet as any).createDefaultWallet(userId)
        await newWallet.save()
        wallet = newWallet
      } catch (createError) {
        console.error('创建钱包失败:', createError)
      }
    }

    if (!wallet) {
      return res.status(500).json({
        success: false,
        message: '无法创建钱包'
      })
    }

    const transaction = (wallet as any).addTransaction({
      type: 'recharge',
      amount: parseFloat(amount),
      description: `${paymentMethod === 'alipay' ? '支付宝' : paymentMethod === 'wechat' ? '微信' : '银行卡'}充值`,
      paymentMethod,
      status: 'pending'
    })

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

// 余额支付扣费
router.post('/pay', authenticate, [
  body('amount').isFloat({ min: 0.01 }).withMessage('支付金额必须大于0.01'),
  body('description').notEmpty().withMessage('描述不能为空'),
  body('orderId').optional().isString()
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const { amount, description, orderId } = req.body

    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      try {
        const newWallet = (Wallet as any).createDefaultWallet(userId)
        await newWallet.save()
        wallet = newWallet
      } catch (createError) {
        console.error('创建钱包失败:', createError)
      }
    }

    if (!wallet) {
      return res.status(500).json({
        success: false,
        message: '无法创建钱包'
      })
    }

    // 检查余额是否足够
    const availableBalance = (wallet as any).getAvailableBalance()
    if (availableBalance < parseFloat(amount)) {
      return res.status(400).json({
        success: false,
        message: `余额不足，当前可用余额: ¥${availableBalance}, 需要: ¥${amount}`
      })
    }

    // 添加消费交易记录
    const transaction = (wallet as any).addTransaction({
      type: 'consume',
      amount: parseFloat(amount),
      description,
      orderId,
      paymentMethod: 'balance',
      status: 'completed'
    })

    await wallet.save()

    res.json({
      success: true,
      data: {
        transactionId: transaction.id,
        remainingBalance: (wallet as any).getAvailableBalance()
      },
      message: '支付成功'
    })
  } catch (error) {
    console.error('余额支付失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    })
  }
})

export default router