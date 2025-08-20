import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { body, query, param, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { UserProfileService } from '../services/UserProfileService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPG、PNG、GIF 格式的图片'));
    }
  }
});

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

// 获取用户档案信息
router.get('/profile', authenticate, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;

  const profile = await UserProfileService.getUserProfile(userId);

  if (profile) {
    res.json({
      success: true,
      data: { profile }
    });
  } else {
    res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }
}));

// 更新用户档案信息
router.put('/profile', authenticate, [
  body('nickName').optional().isString().isLength({ min: 1, max: 20 }).withMessage('昵称长度必须在1-20字符之间'),
  body('avatarUrl').optional().isURL().withMessage('头像URL格式不正确')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const { nickName, avatarUrl } = req.body;

  const result = await UserProfileService.updateUserProfile({
    userId,
    nickName,
    avatarUrl
  });

  if (result.success) {
    res.json({
      success: true,
      data: { profile: result.profile },
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

// 上传用户头像
router.post('/avatar', authenticate, upload.single('avatar'), asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: '请选择要上传的图片文件'
    });
  }

  const result = await UserProfileService.uploadAvatar({
    userId,
    file: {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname
    }
  });

  if (result.success) {
    res.json({
      success: true,
      data: { avatarUrl: result.avatarUrl },
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

// 发送手机号验证码
router.post('/phone/send-code', authenticate, [
  body('newPhone').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const { newPhone } = req.body;

  const result = await UserProfileService.sendPhoneVerificationCode(userId, newPhone);

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

// 验证并更新手机号
router.post('/phone/verify', authenticate, [
  body('newPhone').isMobilePhone('zh-CN').withMessage('手机号格式不正确'),
  body('verificationCode').isString().isLength({ min: 6, max: 6 }).withMessage('验证码必须为6位数字')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const { newPhone, verificationCode } = req.body;

  const result = await UserProfileService.verifyAndUpdatePhone({
    userId,
    newPhone,
    verificationCode
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

// 添加车辆信息
router.post('/vehicles', authenticate, [
  body('brand').isString().isLength({ min: 1, max: 50 }).withMessage('车辆品牌必填且不能超过50字符'),
  body('model').isString().isLength({ min: 1, max: 50 }).withMessage('车辆型号必填且不能超过50字符'),
  body('licensePlate').isString().isLength({ min: 7, max: 8 }).withMessage('车牌号格式不正确'),
  body('batteryCapacity').optional().isFloat({ min: 10, max: 200 }).withMessage('电池容量必须在10-200kWh之间')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const vehicleInfo = req.body;

  const result = await UserProfileService.addVehicle(userId, vehicleInfo);

  if (result.success) {
    res.json({
      success: true,
      data: { vehicle: result.vehicle },
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

// 更新车辆信息
router.put('/vehicles/:licensePlate', authenticate, [
  param('licensePlate').isString().withMessage('车牌号不能为空'),
  body('brand').optional().isString().isLength({ min: 1, max: 50 }).withMessage('车辆品牌不能超过50字符'),
  body('model').optional().isString().isLength({ min: 1, max: 50 }).withMessage('车辆型号不能超过50字符'),
  body('batteryCapacity').optional().isFloat({ min: 10, max: 200 }).withMessage('电池容量必须在10-200kWh之间')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const { licensePlate } = req.params;
  const vehicleInfo = req.body;

  const result = await UserProfileService.updateVehicle(userId, licensePlate, vehicleInfo);

  if (result.success) {
    res.json({
      success: true,
      data: { vehicle: result.vehicle },
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

// 删除车辆信息
router.delete('/vehicles/:licensePlate', authenticate, [
  param('licensePlate').isString().withMessage('车牌号不能为空')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const { licensePlate } = req.params;

  const result = await UserProfileService.removeVehicle(userId, licensePlate);

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

// 获取用户统计信息（管理员接口）
router.get('/stats', authenticate, asyncHandler(async (req: any, res: Response) => {
  // 这里应该添加管理员权限验证
  const stats = await UserProfileService.getUserStatistics();

  res.json({
    success: true,
    data: stats
  });
}));

// 搜索用户（管理员接口）
router.get('/search', authenticate, [
  query('q').isString().isLength({ min: 1 }).withMessage('搜索关键词不能为空'),
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须为正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  // 这里应该添加管理员权限验证
  const { q: query, page = 1, limit = 20 } = req.query;

  const result = await UserProfileService.searchUsers(
    query as string,
    parseInt(page as string),
    parseInt(limit as string)
  );

  res.json({
    success: true,
    data: result
  });
}));

// 更新最后登录时间
router.post('/login-time', authenticate, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;

  await UserProfileService.updateLastLoginTime(userId);

  res.json({
    success: true,
    message: '登录时间更新成功'
  });
}));

// 生成默认头像
router.get('/avatar/default', authenticate, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;

  const defaultAvatarUrl = UserProfileService.generateDefaultAvatarUrl(userId);

  res.json({
    success: true,
    data: { avatarUrl: defaultAvatarUrl }
  });
}));

// 验证用户权限
router.get('/permission/:level', authenticate, [
  param('level').isIn(['basic', 'face_verified']).withMessage('权限级别无效')
], handleValidationErrors, asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const { level } = req.params;

  const hasPermission = await UserProfileService.validateUserPermission(
    userId,
    level as 'basic' | 'face_verified'
  );

  res.json({
    success: true,
    data: { hasPermission }
  });
}));

// 清除用户缓存（管理员接口）
router.post('/cache/clear', authenticate, asyncHandler(async (req: any, res: Response) => {
  // 这里应该添加管理员权限验证
  await UserProfileService.clearAllUserCache();

  res.json({
    success: true,
    message: '用户缓存清除成功'
  });
}));

// 获取头像文件
router.get('/uploads/avatars/:fileName', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { fileName } = req.params;
  
  // 验证文件名格式
  if (!/^avatar_[a-f0-9]{24}_\d+\.(jpg|jpeg|png|gif)$/i.test(fileName)) {
    return res.status(400).json({
      success: false,
      message: '无效的文件名'
    });
  }

  const filePath = path.join(process.cwd(), 'uploads', 'avatars', fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: '文件不存在'
    });
  }

  // 设置响应头
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif'
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // 缓存1年

  // 发送文件
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('头像文件发送失败:', err);
      res.status(500).json({
        success: false,
        message: '文件发送失败'
      });
    }
  });
}));

export default router;