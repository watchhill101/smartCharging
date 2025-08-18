import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import User from '../models/User';
import Order from '../models/Order';

const router = express.Router();

// 获取用户信息
router.get('/profile', authenticate, asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user._id).select('-faceFeatures');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }

  res.json({
    success: true,
    message: '获取用户信息成功',
    data: { user }
  });
}));

// 更新用户信息
router.put('/profile', authenticate, asyncHandler(async (req: any, res: Response) => {
  const { nickName, avatarUrl } = req.body;
  const userId = req.user._id;

  // 验证输入
  if (nickName && (typeof nickName !== 'string' || nickName.trim().length === 0 || nickName.length > 50)) {
    return res.status(400).json({
      success: false,
      message: '昵称格式不正确，长度需在1-50字符之间'
    });
  }

  if (avatarUrl && (typeof avatarUrl !== 'string' || !avatarUrl.startsWith('http'))) {
    return res.status(400).json({
      success: false,
      message: '头像URL格式不正确'
    });
  }

  const updateData: any = {};
  if (nickName !== undefined) updateData.nickName = nickName.trim();
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  ).select('-faceFeatures');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }

  res.json({
    success: true,
    message: '用户信息更新成功',
    data: { user }
  });
}));

// 获取用户车辆列表
router.get('/vehicles', authenticate, asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user._id).select('vehicles');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }

  res.json({
    success: true,
    message: '获取车辆列表成功',
    data: {
      vehicles: user.vehicles || []
    }
  });
}));

// 添加车辆
router.post('/vehicles', authenticate, asyncHandler(async (req: any, res: Response) => {
  const { brand, model, licensePlate, batteryCapacity } = req.body;
  const userId = req.user._id;

  // 验证必填字段
  if (!brand || !model || !licensePlate) {
    return res.status(400).json({
      success: false,
      message: '品牌、型号和车牌号为必填项'
    });
  }

  // 验证车牌号格式（简单验证）
  const licensePlateRegex = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-Z0-9]{4}[A-Z0-9挂学警港澳]{1}$/;
  if (!licensePlateRegex.test(licensePlate.toUpperCase())) {
    return res.status(400).json({
      success: false,
      message: '车牌号格式不正确'
    });
  }

  // 检查车牌号是否已存在
  const existingUser = await User.findOne({
    'vehicles.licensePlate': licensePlate.toUpperCase()
  });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: '该车牌号已被注册'
    });
  }

  const vehicle = {
    brand: brand.trim(),
    model: model.trim(),
    licensePlate: licensePlate.toUpperCase(),
    batteryCapacity: batteryCapacity ? Number(batteryCapacity) : undefined
  };

  const user = await User.findByIdAndUpdate(
    userId,
    { $push: { vehicles: vehicle } },
    { new: true, runValidators: true }
  ).select('vehicles');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }

  // 返回新添加的车辆
  const addedVehicle = user.vehicles[user.vehicles.length - 1];

  res.json({
    success: true,
    message: '车辆添加成功',
    data: { vehicle: addedVehicle }
  });
}));

// 删除车辆
router.delete('/vehicles/:licensePlate', authenticate, asyncHandler(async (req: any, res: Response) => {
  const { licensePlate } = req.params;
  const userId = req.user._id;

  if (!licensePlate) {
    return res.status(400).json({
      success: false,
      message: '车牌号不能为空'
    });
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $pull: { vehicles: { licensePlate: licensePlate.toUpperCase() } } },
    { new: true }
  ).select('vehicles');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }

  res.json({
    success: true,
    message: '车辆删除成功',
    data: { vehicles: user.vehicles }
  });
}));

// 获取用户余额
router.get('/balance', authenticate, asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user._id).select('balance');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }

  res.json({
    success: true,
    message: '获取余额成功',
    data: {
      balance: user.balance,
      formattedBalance: `¥${user.balance.toFixed(2)}`
    }
  });
}));

// 获取用户订单列表
router.get('/orders', authenticate, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user._id;
  const { type, status, page = 1, limit = 20 } = req.query;

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 使用订单模型的静态方法获取订单
    const orders = await Order.findByUser(
      userId,
      type as string,
      status as string,
      parseInt(limit),
      skip
    );

    // 获取订单总数
    const query: any = { userId };
    if (type) query.type = type;
    if (status) query.status = status;
    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      message: '获取订单列表成功',
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error: any) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单列表失败',
      error: error.message
    });
  }
}));

// 获取用户订单统计
router.get('/orders/stats', authenticate, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user._id;
  const { startDate, endDate } = req.query;

  try {
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) start = new Date(startDate as string);
    if (endDate) end = new Date(endDate as string);

    const stats = await Order.getOrderStats(userId, start, end);

    res.json({
      success: true,
      message: '获取订单统计成功',
      data: { stats }
    });
  } catch (error: any) {
    console.error('获取订单统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单统计失败',
      error: error.message
    });
  }
}));

export default router;