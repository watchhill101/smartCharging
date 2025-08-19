import express from 'express';
import { authenticate } from '../middleware/auth';
import { OrderHistoryService } from '../services/OrderHistoryService';
import { asyncHandler } from '../middleware/errorHandler';
import { body, query, param, validationResult } from 'express-validator';

const router = express.Router();

/**
 * 获取订单历史列表
 * GET /api/orders/history
 */
router.get('/history', authenticate, [
  query('type').optional().isIn(['charging', 'recharge']).withMessage('订单类型无效'),
  query('status').optional().isIn(['pending', 'paid', 'cancelled', 'refunded']).withMessage('订单状态无效'),
  query('paymentMethod').optional().isIn(['balance', 'alipay']).withMessage('支付方式无效'),
  query('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
  query('endDate').optional().isISO8601().withMessage('结束日期格式无效'),
  query('keyword').optional().isString().isLength({ max: 100 }).withMessage('搜索关键词长度不能超过100字符'),
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
], asyncHandler(async (req: any, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const {
    type,
    status,
    paymentMethod,
    startDate,
    endDate,
    keyword,
    page = 1,
    limit = 20
  } = req.query;

  const searchParams = {
    userId,
    type,
    status,
    paymentMethod,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    keyword,
    page: parseInt(page as string),
    limit: parseInt(limit as string)
  };

  const result = await OrderHistoryService.getOrderHistory(searchParams);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * 获取订单详情
 * GET /api/orders/:orderId
 */
router.get('/:orderId', authenticate, [
  param('orderId').notEmpty().withMessage('订单ID不能为空')
], asyncHandler(async (req: any, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const { orderId } = req.params;

  const orderDetail = await OrderHistoryService.getOrderDetail(userId, orderId);

  if (!orderDetail) {
    return res.status(404).json({
      success: false,
      message: '订单不存在'
    });
  }

  res.json({
    success: true,
    data: orderDetail
  });
}));

/**
 * 搜索订单
 * GET /api/orders/search
 */
router.get('/search', authenticate, [
  query('keyword').notEmpty().withMessage('搜索关键词不能为空')
    .isLength({ min: 1, max: 100 }).withMessage('搜索关键词长度必须在1-100字符之间'),
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
], asyncHandler(async (req: any, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const {
    keyword,
    page = 1,
    limit = 20
  } = req.query;

  const result = await OrderHistoryService.searchOrders(
    userId,
    keyword as string,
    parseInt(page as string),
    parseInt(limit as string)
  );

  res.json({
    success: true,
    data: result
  });
}));

/**
 * 获取订单统计信息
 * GET /api/orders/statistics
 */
router.get('/statistics', authenticate, [
  query('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
  query('endDate').optional().isISO8601().withMessage('结束日期格式无效')
], asyncHandler(async (req: any, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const { startDate, endDate } = req.query;

  const statistics = await OrderHistoryService.getOrderStatistics(
    userId,
    startDate ? new Date(startDate as string) : undefined,
    endDate ? new Date(endDate as string) : undefined
  );

  res.json({
    success: true,
    data: { statistics }
  });
}));

/**
 * 导出订单数据
 * POST /api/orders/export
 */
router.post('/export', authenticate, [
  body('type').optional().isIn(['charging', 'recharge']).withMessage('订单类型无效'),
  body('status').optional().isIn(['pending', 'paid', 'cancelled', 'refunded']).withMessage('订单状态无效'),
  body('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
  body('endDate').optional().isISO8601().withMessage('结束日期格式无效'),
  body('format').isIn(['csv', 'excel', 'pdf']).withMessage('导出格式无效')
], asyncHandler(async (req: any, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const {
    type,
    status,
    startDate,
    endDate,
    format
  } = req.body;

  const exportParams = {
    userId,
    type,
    status,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    format
  };

  const result = await OrderHistoryService.exportOrders(exportParams);

  if (result.success) {
    res.json({
      success: true,
      message: result.message,
      data: {
        downloadUrl: result.downloadUrl,
        fileName: result.fileName
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

/**
 * 获取订单筛选选项
 * GET /api/orders/filter-options
 */
router.get('/filter-options', authenticate, asyncHandler(async (req: any, res) => {
  // 返回筛选选项的静态数据
  const filterOptions = {
    types: [
      { value: 'charging', label: '充电订单' },
      { value: 'recharge', label: '充值订单' }
    ],
    statuses: [
      { value: 'pending', label: '待支付' },
      { value: 'paid', label: '已支付' },
      { value: 'cancelled', label: '已取消' },
      { value: 'refunded', label: '已退款' }
    ],
    paymentMethods: [
      { value: 'balance', label: '余额支付' },
      { value: 'alipay', label: '支付宝' }
    ],
    exportFormats: [
      { value: 'csv', label: 'CSV文件' },
      { value: 'excel', label: 'Excel文件' },
      { value: 'pdf', label: 'PDF文件' }
    ]
  };

  res.json({
    success: true,
    data: { filterOptions }
  });
}));

/**
 * 清除订单缓存
 * DELETE /api/orders/cache
 */
router.delete('/cache', authenticate, asyncHandler(async (req: any, res) => {
  const userId = req.user.id;

  await OrderHistoryService.clearOrderCache(userId);

  res.json({
    success: true,
    message: '订单缓存清除成功'
  });
}));

export default router;