import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { CouponService } from '../services/CouponService';
import { RedisService } from '../services/RedisService';
import { authenticate as authMiddleware } from '../middleware/auth';

const router = express.Router();

// 初始化服务
const redisService = new RedisService({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

const couponService = new CouponService(redisService);

// 验证中间件
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }
  next();
};

/**
 * 获取用户优惠券列表
 */
router.get('/my-coupons', authMiddleware, [
  query('status').optional().isIn(['available', 'used', 'expired', 'all']),
  query('scenario').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const { status, scenario, page, limit } = req.query;
    
    const result = await couponService.getUserCoupons({
      userId,
      status: status as any,
      scenario: scenario as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取用户优惠券失败:', error);
    res.status(500).json({
      success: false,
      message: '获取优惠券列表失败'
    });
  }
});

/**
 * 领取优惠券
 */
router.post('/claim/:couponId', authMiddleware, [
  param('couponId').notEmpty().withMessage('优惠券ID不能为空')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const { couponId } = req.params;
    
    const userCoupon = await couponService.issueCouponToUser(couponId, userId);

    res.status(201).json({
      success: true,
      message: '优惠券领取成功',
      data: {
        couponCode: userCoupon.couponCode,
        expiredAt: userCoupon.expiredAt
      }
    });
  } catch (error) {
    console.error('领取优惠券失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '领取优惠券失败'
    });
  }
});

/**
 * 获取订单可用优惠券
 */
router.get('/available-for-order', authMiddleware, [
  query('amount').notEmpty().isFloat({ min: 0 }).withMessage('订单金额必须大于0'),
  query('scenario').notEmpty().withMessage('使用场景不能为空')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const { amount, scenario } = req.query;
    
    const availableCoupons = await couponService.getAvailableCouponsForOrder(
      userId,
      parseFloat(amount as string),
      scenario as string
    );

    res.json({
      success: true,
      data: availableCoupons
    });
  } catch (error) {
    console.error('获取可用优惠券失败:', error);
    res.status(500).json({
      success: false,
      message: '获取可用优惠券失败'
    });
  }
});

/**
 * 使用优惠券
 */
router.post('/use', authMiddleware, [
  body('couponCode').notEmpty().withMessage('优惠券码不能为空'),
  body('orderId').notEmpty().withMessage('订单ID不能为空'),
  body('orderAmount').isFloat({ min: 0 }).withMessage('订单金额必须大于0'),
  body('scenario').notEmpty().withMessage('使用场景不能为空')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const { couponCode, orderId, orderAmount, scenario } = req.body;
    
    const result = await couponService.useCoupon({
      userId,
      couponCode,
      orderId,
      orderAmount,
      scenario
    });

    res.json({
      success: true,
      message: '优惠券使用成功',
      data: result
    });
  } catch (error) {
    console.error('使用优惠券失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '使用优惠券失败'
    });
  }
});

/**
 * 获取优惠券统计信息
 */
router.get('/stats', authMiddleware, [
  query('timeRange').optional().isIn(['day', 'week', 'month'])
], handleValidationErrors, async (req, res) => {
  try {
    const timeRange = (req.query.timeRange as 'day' | 'week' | 'month') || 'week';
    
    const stats = await couponService.getCouponStats(timeRange);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取优惠券统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败'
    });
  }
});

// 管理员路由

/**
 * 创建优惠券（管理员）
 */
router.post('/admin/create', authMiddleware, [
  body('name').notEmpty().isLength({ max: 100 }).withMessage('优惠券名称不能为空且不超过100字符'),
  body('description').notEmpty().isLength({ max: 500 }).withMessage('描述不能为空且不超过500字符'),
  body('type').isIn(['discount', 'cashback', 'free_charging', 'percentage']).withMessage('无效的优惠券类型'),
  body('value').isFloat({ min: 0 }).withMessage('优惠券面值必须大于等于0'),
  body('validFrom').isISO8601().withMessage('开始时间格式不正确'),
  body('validTo').isISO8601().withMessage('结束时间格式不正确'),
  body('totalQuantity').isInt({ min: 1 }).withMessage('发行数量必须大于0'),
  body('applicableScenarios').isArray({ min: 1 }).withMessage('适用场景不能为空'),
  body('minAmount').optional().isFloat({ min: 0 }),
  body('maxDiscount').optional().isFloat({ min: 0 })
], handleValidationErrors, async (req, res) => {
  try {
    // 检查管理员权限
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足，仅管理员可以创建优惠券'
      });
    }
    const createdBy = req.user.id;
    
    const couponData = {
      ...req.body,
      validFrom: new Date(req.body.validFrom),
      validTo: new Date(req.body.validTo),
      createdBy
    };

    // 验证时间逻辑
    if (couponData.validFrom >= couponData.validTo) {
      return res.status(400).json({
        success: false,
        message: '开始时间必须早于结束时间'
      });
    }

    const coupon = await couponService.createCoupon(couponData);

    res.status(201).json({
      success: true,
      message: '优惠券创建成功',
      data: coupon
    });
  } catch (error) {
    console.error('创建优惠券失败:', error);
    res.status(500).json({
      success: false,
      message: '创建优惠券失败'
    });
  }
});

/**
 * 获取优惠券列表（管理员）
 */
router.get('/admin/list', authMiddleware, [
  query('type').optional().isString(),
  query('scenario').optional().isString(),
  query('status').optional().isIn(['active', 'expired', 'all']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, async (req, res) => {
  try {
    const { type, scenario, status, page, limit } = req.query;
    
    const result = await couponService.getCoupons({
      type: type as string,
      scenario: scenario as string,
      status: status as any,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取优惠券列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取优惠券列表失败'
    });
  }
});

/**
 * 批量发放优惠券（管理员）
 */
router.post('/admin/batch-issue', authMiddleware, [
  body('couponId').notEmpty().withMessage('优惠券ID不能为空'),
  body('userIds').isArray({ min: 1 }).withMessage('用户ID列表不能为空')
], handleValidationErrors, async (req, res) => {
  try {
    const { couponId, userIds } = req.body;
    
    const result = await couponService.batchIssueCoupons(couponId, userIds);

    res.json({
      success: true,
      message: `批量发放完成：成功 ${result.success} 个，失败 ${result.failed} 个`,
      data: result
    });
  } catch (error) {
    console.error('批量发放优惠券失败:', error);
    res.status(500).json({
      success: false,
      message: '批量发放优惠券失败'
    });
  }
});

/**
 * 清理过期优惠券（管理员）
 */
router.post('/admin/cleanup-expired', authMiddleware, async (req, res) => {
  try {
    const result = await couponService.cleanupExpiredCoupons();

    res.json({
      success: true,
      message: `清理完成，共处理 ${result.updated} 张过期优惠券`,
      data: result
    });
  } catch (error) {
    console.error('清理过期优惠券失败:', error);
    res.status(500).json({
      success: false,
      message: '清理过期优惠券失败'
    });
  }
});

export default router;