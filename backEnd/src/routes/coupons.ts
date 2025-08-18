import express from 'express';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import Coupon, { CouponType, CouponStatus } from '../models/Coupon';

const router = express.Router();

// 测试端点 - 不需要认证
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '优惠券API测试成功',
    timestamp: new Date().toISOString()
  });
});

// 获取用户优惠券列表（按状态分类）
router.get('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status } = req.query;

  let query: any = { userId };
  
  if (status && Object.values(CouponStatus).includes(status as CouponStatus)) {
    query.status = status;
  }

  const coupons = await Coupon.find(query)
    .sort({ createdAt: -1 })
    .lean();

  // 统计各状态的数量
  const counts = await Promise.all([
    Coupon.countDocuments({ userId, status: CouponStatus.UNUSED }),
    Coupon.countDocuments({ userId, status: CouponStatus.USED }),
    Coupon.countDocuments({ userId, status: CouponStatus.EXPIRED })
  ]);

  res.json({
    success: true,
    data: {
      coupons,
      counts: {
        unused: counts[0],
        used: counts[1],
        expired: counts[2]
      }
    }
  });
}));

// 获取用户有效优惠券
router.get('/valid', auth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const coupons = await Coupon.findValidCoupons(userId);

  res.json({
    success: true,
    data: { coupons }
  });
}));

// 获取优惠券详情
router.get('/:couponId', auth, asyncHandler(async (req, res) => {
  const { couponId } = req.params;
  const userId = req.user.id;

  const coupon = await Coupon.findOne({ _id: couponId, userId });
  
  if (!coupon) {
    return res.status(404).json({
      success: false,
      message: '优惠券不存在'
    });
  }

  res.json({
    success: true,
    data: { coupon }
  });
}));

// 使用优惠券
router.post('/:couponId/use', auth, asyncHandler(async (req, res) => {
  const { couponId } = req.params;
  const { orderId } = req.body;
  const userId = req.user.id;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: '订单ID不能为空'
    });
  }

  const coupon = await Coupon.findOne({ _id: couponId, userId });
  
  if (!coupon) {
    return res.status(404).json({
      success: false,
      message: '优惠券不存在'
    });
  }

  if (!coupon.isValid()) {
    return res.status(400).json({
      success: false,
      message: '优惠券已过期或不可用'
    });
  }

  await coupon.use(orderId);

  res.json({
    success: true,
    message: '优惠券使用成功',
    data: { coupon }
  });
}));

// 创建优惠券（管理员功能）
router.post('/', auth, asyncHandler(async (req, res) => {
  const {
    type,
    title,
    description,
    value,
    minAmount,
    maxDiscount,
    validFrom,
    validUntil,
    conditions,
    applicableStations,
    applicableChargers
  } = req.body;

  // 验证必填字段
  if (!type || !title || !description || value === undefined || !validUntil) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段'
    });
  }

  // 验证优惠券类型
  if (!Object.values(CouponType).includes(type)) {
    return res.status(400).json({
      success: false,
      message: '无效的优惠券类型'
    });
  }

  const coupon = new Coupon({
    userId: req.user.id,
    type,
    title,
    description,
    value,
    minAmount: minAmount || 0,
    maxDiscount,
    validFrom: validFrom || new Date(),
    validUntil: new Date(validUntil),
    conditions: conditions || [],
    applicableStations: applicableStations || [],
    applicableChargers: applicableChargers || [],
    isActive: true
  });

  await coupon.save();

  res.json({
    success: true,
    message: '优惠券创建成功',
    data: { coupon }
  });
}));

// 更新优惠券状态
router.patch('/:couponId/status', auth, asyncHandler(async (req, res) => {
  const { couponId } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  if (!Object.values(CouponStatus).includes(status)) {
    return res.status(400).json({
      success: false,
      message: '无效的状态值'
    });
  }

  const coupon = await Coupon.findOne({ _id: couponId, userId });
  
  if (!coupon) {
    return res.status(404).json({
      success: false,
      message: '优惠券不存在'
    });
  }

  coupon.status = status;
  if (status === CouponStatus.USED) {
    coupon.usedAt = new Date();
  }

  await coupon.save();

  res.json({
    success: true,
    message: '优惠券状态更新成功',
    data: { coupon }
  });
}));

// 删除优惠券
router.delete('/:couponId', auth, asyncHandler(async (req, res) => {
  const { couponId } = req.params;
  const userId = req.user.id;

  const coupon = await Coupon.findOne({ _id: couponId, userId });
  
  if (!coupon) {
    return res.status(404).json({
      success: false,
      message: '优惠券不存在'
    });
  }

  await Coupon.deleteOne({ _id: couponId });

  res.json({
    success: true,
    message: '优惠券删除成功'
  });
}));

// 批量更新过期优惠券状态（定时任务）
router.post('/update-expired', auth, asyncHandler(async (req, res) => {
  // 检查用户权限（这里可以添加管理员权限检查）
  const result = await Coupon.updateExpiredStatus();

  res.json({
    success: true,
    message: '过期优惠券状态更新成功',
    data: { updatedCount: result.modifiedCount }
  });
}));

export default router;
