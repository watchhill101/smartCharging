import express, { Request, Response } from 'express'
import { authenticate } from '../middleware/auth'
import { body, query, validationResult } from 'express-validator'
import { WalletService } from '../services/WalletService'
import { asyncHandler } from '../middleware/errorHandler'

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
router.get('/info', authenticate, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id

  const walletInfo = await WalletService.getWalletInfo(userId)

  res.json({
    success: true,
    data: walletInfo
  })
}))

// 获取交易记录
router.get('/transactions', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['recharge', 'consume', 'refund', 'withdraw']),
  query('status').optional().isIn(['pending', 'completed', 'failed', 'cancelled']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const type = req.query.type as string
  const status = req.query.status as string
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

  const result = await WalletService.getTransactions({
    userId,
    type: type as any,
    status: status as any,
    startDate,
    endDate,
    page,
    limit
  })

  res.json({
    success: true,
    data: result
  })
}))

// 创建充值订单
router.post('/recharge', authenticate, [
  body('amount').isFloat({ min: 0.01, max: 10000 }).withMessage('充值金额必须在0.01-10000元之间'),
  body('paymentMethod').isIn(['alipay', 'wechat', 'bank_card']).withMessage('支付方式无效'),
  body('description').optional().isString().isLength({ max: 200 }).withMessage('描述长度不能超过200字符')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id
  const { amount, paymentMethod, description } = req.body

  const result = await WalletService.createRechargeOrder({
    userId,
    amount: parseFloat(amount),
    paymentMethod,
    description
  })

  res.json({
    success: true,
    data: result,
    message: '充值订单创建成功'
  })
}))

// 余额消费
router.post('/consume', authenticate, [
  body('amount').isFloat({ min: 0.01 }).withMessage('消费金额必须大于0.01'),
  body('description').isString().isLength({ min: 1, max: 200 }).withMessage('描述必填且不能超过200字符'),
  body('orderId').optional().isString(),
  body('sessionId').optional().isString()
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id
  const { amount, description, orderId, sessionId } = req.body

  const result = await WalletService.consumeBalance({
    userId,
    amount: parseFloat(amount),
    description,
    orderId,
    sessionId
  })

  if (result.success) {
    res.json({
      success: true,
      data: { transactionId: result.transactionId },
      message: result.message
    })
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    })
  }
}))

// 冻结金额
router.post('/freeze', authenticate, [
  body('amount').isFloat({ min: 0.01 }).withMessage('冻结金额必须大于0.01'),
  body('reason').isString().isLength({ min: 1, max: 200 }).withMessage('冻结原因必填且不能超过200字符')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id
  const { amount, reason } = req.body

  const result = await WalletService.freezeAmount(userId, parseFloat(amount), reason)

  if (result.success) {
    res.json({
      success: true,
      message: result.message
    })
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    })
  }
}))

// 解冻金额
router.post('/unfreeze', authenticate, [
  body('amount').isFloat({ min: 0.01 }).withMessage('解冻金额必须大于0.01'),
  body('reason').isString().isLength({ min: 1, max: 200 }).withMessage('解冻原因必填且不能超过200字符')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id
  const { amount, reason } = req.body

  const result = await WalletService.unfreezeAmount(userId, parseFloat(amount), reason)

  if (result.success) {
    res.json({
      success: true,
      message: result.message
    })
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    })
  }
}))

// 检查余额并获取提醒
router.get('/balance-alert', authenticate, [
  query('threshold').optional().isFloat({ min: 0 }).withMessage('阈值必须大于等于0')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id
  const threshold = parseFloat(req.query.threshold as string) || 10

  const alert = await WalletService.checkBalanceAndAlert(userId, threshold)

  res.json({
    success: true,
    data: { alert }
  })
}))

// 获取钱包统计信息
router.get('/stats', authenticate, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

  const stats = await WalletService.getWalletStats(userId, startDate, endDate)

  if (stats) {
    res.json({
      success: true,
      data: stats
    })
  } else {
    res.status(404).json({
      success: false,
      message: '钱包不存在'
    })
  }
}))

// 添加发票信息
router.post('/invoice-info', authenticate, [
  body('type').isIn(['personal', 'company']).withMessage('发票类型无效'),
  body('title').isString().isLength({ min: 1, max: 100 }).withMessage('发票抬头必填且不能超过100字符'),
  body('taxNumber').optional().isString().isLength({ max: 50 }),
  body('address').optional().isString().isLength({ max: 200 }),
  body('phone').optional().isString().isLength({ max: 20 }),
  body('bankName').optional().isString().isLength({ max: 100 }),
  body('bankAccount').optional().isString().isLength({ max: 50 }),
  body('email').isEmail().withMessage('邮箱格式无效')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id
  const invoiceInfo = req.body

  const result = await WalletService.addInvoiceInfo(userId, invoiceInfo)

  if (result.success) {
    res.json({
      success: true,
      message: result.message
    })
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    })
  }
}))

// 获取发票信息列表
router.get('/invoice-info', authenticate, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id

  const invoiceInfoList = await WalletService.getInvoiceInfoList(userId)

  res.json({
    success: true,
    data: { invoiceInfoList }
  })
}))

// 创建发票申请
router.post('/invoice', authenticate, [
  body('transactionIds').isArray({ min: 1 }).withMessage('交易记录ID列表不能为空'),
  body('transactionIds.*').isString().withMessage('交易记录ID必须为字符串'),
  body('type').optional().isIn(['electronic', 'paper']).withMessage('发票类型无效')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id
  const { transactionIds, type = 'electronic' } = req.body

  const result = await WalletService.createInvoiceApplication(userId, transactionIds, type)

  if (result.success) {
    res.json({
      success: true,
      data: { invoiceId: result.invoiceId },
      message: result.message
    })
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    })
  }
}))

// 获取发票列表
router.get('/invoices', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20

  const result = await WalletService.getInvoiceList(userId, page, limit)

  res.json({
    success: true,
    data: result
  })
}))

// 设置自动充值
router.post('/auto-recharge', authenticate, [
  body('enabled').isBoolean().withMessage('enabled必须为布尔值'),
  body('threshold').optional().isFloat({ min: 0 }).withMessage('阈值必须大于等于0'),
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('充值金额必须大于0.01')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id
  const { enabled, threshold = 10, amount = 50 } = req.body

  const result = await WalletService.setAutoRecharge(userId, enabled, threshold, amount)

  if (result.success) {
    res.json({
      success: true,
      message: result.message
    })
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    })
  }
}))

export default router