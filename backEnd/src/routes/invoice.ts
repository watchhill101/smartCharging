import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { body, query, param, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { InvoiceService } from '../services/InvoiceService';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// 中间件：验证请求参数
const handleValidationErrors = (req: Request, res: Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }
  next();
};

// 创建发票申请
router.post('/apply', authenticate, [
  body('transactionIds').isArray({ min: 1 }).withMessage('交易记录ID列表不能为空'),
  body('transactionIds.*').isString().withMessage('交易记录ID必须为字符串'),
  body('invoiceType').isIn(['electronic', 'paper']).withMessage('发票类型无效'),
  body('invoiceInfoId').optional().isString().withMessage('发票信息ID必须为字符串')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const { transactionIds, invoiceType, invoiceInfoId } = req.body;

  const result = await InvoiceService.createInvoiceApplication({
    userId,
    transactionIds,
    invoiceType,
    invoiceInfoId
  });

  if (result.success) {
    res.json({
      success: true,
      data: {
        invoiceId: result.invoiceId,
        invoice: result.invoice
      },
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

// 获取发票列表
router.get('/list', authenticate, [
  query('status').optional().isIn(['pending', 'issued', 'sent', 'cancelled']).withMessage('发票状态无效'),
  query('type').optional().isIn(['electronic', 'paper']).withMessage('发票类型无效'),
  query('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
  query('endDate').optional().isISO8601().withMessage('结束日期格式无效'),
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须为正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const {
    status,
    type,
    startDate,
    endDate,
    page = 1,
    limit = 20
  } = req.query;

  const result = await InvoiceService.getInvoiceList({
    userId,
    status,
    type,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    page: parseInt(page),
    limit: parseInt(limit)
  });

  res.json({
    success: true,
    data: result
  });
}));

// 获取发票详情
router.get('/:invoiceId', authenticate, [
  param('invoiceId').isString().withMessage('发票ID无效')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const { invoiceId } = req.params;

  const invoice = await InvoiceService.getInvoiceDetail(userId, invoiceId);

  if (invoice) {
    res.json({
      success: true,
      data: { invoice }
    });
  } else {
    res.status(404).json({
      success: false,
      message: '发票不存在'
    });
  }
}));

// 处理发票（生成发票文件）
router.post('/:invoiceId/process', authenticate, [
  param('invoiceId').isString().withMessage('发票ID无效')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const { invoiceId } = req.params;

  const result = await InvoiceService.processInvoice(invoiceId);

  if (result.success) {
    res.json({
      success: true,
      data: {
        downloadUrl: result.downloadUrl
      },
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

// 发送发票邮件
router.post('/:invoiceId/send-email', authenticate, [
  param('invoiceId').isString().withMessage('发票ID无效'),
  body('recipientEmail').isEmail().withMessage('收件人邮箱格式无效'),
  body('subject').optional().isString().isLength({ max: 200 }).withMessage('邮件主题长度不能超过200字符'),
  body('message').optional().isString().isLength({ max: 1000 }).withMessage('邮件内容长度不能超过1000字符')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const { invoiceId } = req.params;
  const { recipientEmail, subject, message } = req.body;

  const result = await InvoiceService.sendInvoiceEmail({
    invoiceId,
    recipientEmail,
    subject,
    message
  });

  if (result.success) {
    res.json({
      success: true,
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

// 取消发票
router.post('/:invoiceId/cancel', authenticate, [
  param('invoiceId').isString().withMessage('发票ID无效'),
  body('reason').optional().isString().isLength({ max: 200 }).withMessage('取消原因长度不能超过200字符')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const { invoiceId } = req.params;
  const { reason } = req.body;

  const result = await InvoiceService.cancelInvoice(userId, invoiceId, reason);

  if (result.success) {
    res.json({
      success: true,
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

// 下载发票
router.get('/:invoiceId/download', authenticate, [
  param('invoiceId').isString().withMessage('发票ID无效')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const { invoiceId } = req.params;

  const downloadInfo = await InvoiceService.getInvoiceDownloadInfo(userId, invoiceId);

  if (!downloadInfo) {
    return res.status(404).json({
      success: false,
      message: '发票文件不存在'
    });
  }

  // 设置下载响应头
  res.setHeader('Content-Disposition', `attachment; filename="${downloadInfo.fileName}"`);
  res.setHeader('Content-Type', 'application/pdf');

  // 发送文件
  res.sendFile(downloadInfo.filePath, (err) => {
    if (err) {
      console.error('发票下载失败:', err);
      res.status(500).json({
        success: false,
        message: '发票下载失败'
      });
    }
  });
}));

// 直接下载发票文件（通过文件名）
router.get('/download/:fileName', asyncHandler(async (req: Request, res: Response) => {
  const { fileName } = req.params;
  
  // 验证文件名格式
  if (!/^invoice_[A-Z0-9]+\.pdf$/.test(fileName)) {
    return res.status(400).json({
      success: false,
      message: '无效的文件名'
    });
  }

  const filePath = path.join(process.cwd(), 'uploads', 'invoices', fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: '文件不存在'
    });
  }

  // 设置下载响应头
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', 'application/pdf');

  // 发送文件
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('文件下载失败:', err);
      res.status(500).json({
        success: false,
        message: '文件下载失败'
      });
    }
  });
}));

// 获取发票统计信息
router.get('/stats/:year?', authenticate, [
  param('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('年份必须在2020-2030之间')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const year = req.params.year ? parseInt(req.params.year) : undefined;

  const stats = await InvoiceService.getInvoiceStatistics(userId, year);

  if (stats) {
    res.json({
      success: true,
      data: stats
    });
  } else {
    res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }
}));

// 批量处理发票
router.post('/batch/process', authenticate, [
  body('invoiceIds').isArray({ min: 1 }).withMessage('发票ID列表不能为空'),
  body('invoiceIds.*').isString().withMessage('发票ID必须为字符串')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const { invoiceIds } = req.body;

  const result = await InvoiceService.batchProcessInvoices(invoiceIds);

  if (result.success) {
    res.json({
      success: true,
      data: {
        results: result.results
      },
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

// 管理员接口：清理过期发票
router.post('/admin/cleanup', authenticate, [
  body('expireDays').optional().isInt({ min: 1, max: 365 }).withMessage('过期天数必须在1-365之间')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  // 这里应该添加管理员权限验证
  const { expireDays = 30 } = req.body;

  const result = await InvoiceService.cleanupExpiredInvoices(expireDays);

  if (result.success) {
    res.json({
      success: true,
      data: {
        cleanedCount: result.cleanedCount
      },
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

// 验证发票信息
router.post('/validate-info', authenticate, [
  body('type').isIn(['personal', 'company']).withMessage('发票类型无效'),
  body('title').isString().isLength({ min: 1, max: 100 }).withMessage('发票抬头必填且不能超过100字符'),
  body('taxNumber').optional().isString().isLength({ max: 50 }).withMessage('税号长度不能超过50字符'),
  body('email').isEmail().withMessage('邮箱格式无效')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const invoiceInfo = req.body;

  const validation = InvoiceService.validateInvoiceInfo(invoiceInfo);

  if (validation.valid) {
    res.json({
      success: true,
      message: '发票信息验证通过'
    });
  } else {
    res.status(400).json({
      success: false,
      message: validation.message
    });
  }
}));

export default router;