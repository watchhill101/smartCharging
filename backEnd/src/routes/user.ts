import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import User from '../models/User';

const router = express.Router();

// 获取用户信息
router.get('/profile', authenticate, asyncHandler(async (req: Request, res: Response) => {
  // TODO: 实现获取用户信息逻辑
  res.json({
    success: true,
    message: 'Get user profile endpoint - to be implemented',
    data: {
      user: req.user
    }
  });
}));

// 更新用户信息
router.put('/profile', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { nickName, avatarUrl } = req.body;
  const userId = req.user!.id;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { nickName, avatarUrl },
      { new: true }
    );

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
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '更新用户信息失败'
    });
  }
}));

// 获取用户余额
router.get('/balance', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('获取余额失败:', error);
    res.status(500).json({
      success: false,
      message: '获取余额失败'
    });
  }
}));

// 添加车辆
router.post('/vehicles', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { brand, model, licensePlate, batteryCapacity } = req.body;
  const userId = req.user!.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查车牌是否已存在
    const existingVehicle = user.vehicles.find(v => v.licensePlate === licensePlate);
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: '该车牌号已存在'
      });
    }

    const newVehicle = {
      brand,
      model,
      licensePlate,
      batteryCapacity: batteryCapacity || 60
    };

    user.vehicles.push(newVehicle);
    await user.save();

    res.json({
      success: true,
      message: '车辆添加成功',
      data: { vehicle: newVehicle }
    });
  } catch (error) {
    console.error('添加车辆失败:', error);
    res.status(500).json({
      success: false,
      message: '添加车辆失败'
    });
  }
}));

// 删除车辆
router.delete('/vehicles/:licensePlate', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { licensePlate } = req.params;
  const userId = req.user!.id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const vehicleIndex = user.vehicles.findIndex(v => v.licensePlate === licensePlate);
    if (vehicleIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '车辆不存在'
      });
    }

    user.vehicles.splice(vehicleIndex, 1);
    await user.save();

    res.json({
      success: true,
      message: '车辆删除成功'
    });
  } catch (error) {
    console.error('删除车辆失败:', error);
    res.status(500).json({
      success: false,
      message: '删除车辆失败'
    });
  }
}));

// 更新验证级别
router.post('/update-verification', authenticate, asyncHandler(async (req: Request, res: Response) => {
  console.log('🔐 收到更新验证级别请求:', req.body);
  const { userId, verificationToken, verificationType } = req.body;
  const currentUserId = req.user!.id;

  // 验证用户权限
  if (userId !== currentUserId) {
    return res.status(403).json({
      success: false,
      message: '无权限更新此用户信息'
    });
  }

  // 验证token格式（简化验证）
  if (!verificationToken || !verificationToken.startsWith('mock_token_')) {
    return res.status(400).json({
      success: false,
      message: '验证令牌无效'
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 根据验证类型更新验证级别
    let newVerificationLevel = 'basic';
    if (verificationType === 'face') {
      newVerificationLevel = 'face_verified';
      user.faceEnabled = true;
    }

    user.verificationLevel = newVerificationLevel as 'basic' | 'face_verified';
    user.updatedAt = new Date();
    await user.save();

    console.log('✅ 验证级别更新成功:', user.phone, newVerificationLevel);

    res.json({
      success: true,
      message: '验证级别更新成功',
      data: {
        user: {
          id: user._id,
          verificationLevel: user.verificationLevel,
          faceEnabled: user.faceEnabled
        }
      }
    });

  } catch (error) {
    console.error('❌ 更新验证级别失败:', error);
    res.status(500).json({
      success: false,
      message: '更新验证级别失败'
    });
  }
}));

export default router;