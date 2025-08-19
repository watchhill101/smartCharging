import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler';
import User from '../models/User';
import SliderVerifyService from '../services/SliderVerifyService';
import UserAuthService from '../services/UserAuthService';
import {
  sliderVerifyRateLimit,
  sliderVerifyLogger,
  sliderVerifyValidator,
  sliderVerifySecurityCheck
} from '../middleware/sliderVerifyMiddleware';
import { authenticate as authenticateToken, userRateLimit, requireOwnership, logApiAccess } from '../middleware/auth';

const router = express.Router();

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// 服务实例
const sliderVerifyService = new SliderVerifyService();
const userAuthService = new UserAuthService();

// 配置multer用于处理文件上传（人脸图片）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 生成JWT token
const generateToken = (userId: string) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

// 生成刷新token
const generateRefreshToken = (userId: string) => {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
};

// 验证码存储（生产环境应该使用Redis或数据库）
const verificationCodes = new Map();

// 发送验证码
router.post('/send-verify-code', asyncHandler(async (req: Request, res: Response) => {
  console.log('📱 收到发送验证码请求:', req.body);
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: '手机号不能为空'
    });
  }

  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({
      success: false,
      message: '手机号格式不正确'
    });
  }

  // 生成6位数验证码
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // 存储验证码（5分钟过期）
  verificationCodes.set(phone, {
    code,
    expires: Date.now() + 5 * 60 * 1000,
    attempts: 0
  });

  console.log(`📨 为手机号 ${phone} 生成验证码: ${code}`);

  // 这里应该调用短信服务发送验证码
  // 开发环境下直接返回验证码
  res.json({
    success: true,
    message: '验证码发送成功',
    data: {
      code: code // 生产环境中不应该返回验证码
    }
  });
}));

// 用户登录（支持密码、滑块验证、人脸识别）
router.post('/login', 
  upload.single('faceImage'),
  logApiAccess,
  userRateLimit(10, 60000), // 每分钟最多10次登录尝试
  asyncHandler(async (req: Request, res: Response) => {
  console.log('🔐 收到登录请求:', { 
    phone: req.body.phone, 
    hasVerifyToken: !!req.body.verifyToken,
    hasPassword: !!req.body.password,
    hasFaceImage: !!req.file
  });
  
  const { phone, password, verifyToken, userInfo } = req.body;
  const faceImage = req.file?.buffer;
  
  // 获取设备信息
  const deviceInfo = {
    userAgent: req.get('User-Agent') || 'unknown',
    platform: req.get('X-Platform') || 'unknown',
    ip: req.ip || req.socket.remoteAddress || 'unknown'
  };

  try {
    const result = await userAuthService.login({
      phone,
      password,
      verificationToken: verifyToken,
      faceImage,
      deviceInfo
    });

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ 登录处理失败:', error);
    res.status(500).json({
      success: false,
      message: '登录过程中出现错误，请稍后重试'
    });
  }
}));

// 用户注册
router.post('/register', 
  upload.single('faceImage'),
  logApiAccess,
  userRateLimit(5, 60000), // 每分钟最多5次注册尝试
  asyncHandler(async (req: Request, res: Response) => {
  console.log('📝 收到注册请求:', { 
    phone: req.body.phone,
    hasPassword: !!req.body.password,
    hasVerifyToken: !!req.body.verifyToken,
    hasFaceImage: !!req.file
  });
  
  const { phone, password, nickName, avatarUrl, verifyToken } = req.body;
  const faceImage = req.file?.buffer;
  
  // 获取设备信息
  const deviceInfo = {
    userAgent: req.get('User-Agent') || 'unknown',
    platform: req.get('X-Platform') || 'unknown',
    ip: req.ip || req.socket.remoteAddress || 'unknown'
  };

  try {
    const result = await userAuthService.register({
      phone,
      password,
      nickName,
      avatarUrl,
      verificationToken: verifyToken,
      faceImage,
      deviceInfo
    });

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ 注册处理失败:', error);
    res.status(500).json({
      success: false,
      message: '注册过程中出现错误，请稍后重试'
    });
  }
}));

// 验证码登录（兼容旧版本）
router.post('/login-with-code', asyncHandler(async (req: Request, res: Response) => {
  console.log('🔐 收到验证码登录请求:', { ...req.body, verifyCode: '***' });
  const { phone, verifyCode, verifyToken } = req.body;

  if (!phone || !verifyCode) {
    return res.status(400).json({
      success: false,
      message: '手机号和验证码不能为空'
    });
  }

  // 验证滑块验证token
  if (!verifyToken) {
    return res.status(400).json({
      success: false,
      message: '请先完成安全验证'
    });
  }

  // 使用滑块验证服务验证token
  try {
    const isTokenValid = await sliderVerifyService.validateToken(verifyToken);
    if (!isTokenValid) {
      console.log('❌ 验证token无效或已过期:', verifyToken);
      return res.status(400).json({
        success: false,
        message: '验证令牌无效或已过期，请重新验证'
      });
    }
    console.log('✅ 验证token有效:', verifyToken);
  } catch (error) {
    console.error('❌ 验证token检查失败:', error);
    return res.status(500).json({
      success: false,
      message: '验证令牌检查失败，请重试'
    });
  }

  // 检查验证码
  const storedVerification = verificationCodes.get(phone);
  if (!storedVerification) {
    return res.status(400).json({
      success: false,
      message: '验证码不存在或已过期'
    });
  }

  if (Date.now() > storedVerification.expires) {
    verificationCodes.delete(phone);
    return res.status(400).json({
      success: false,
      message: '验证码已过期'
    });
  }

  if (storedVerification.code !== verifyCode) {
    storedVerification.attempts++;
    if (storedVerification.attempts >= 3) {
      verificationCodes.delete(phone);
      return res.status(400).json({
        success: false,
        message: '验证码错误次数过多，请重新获取'
      });
    }
    return res.status(400).json({
      success: false,
      message: `验证码错误，还可以尝试 ${3 - storedVerification.attempts} 次`
    });
  }

  // 验证码正确，删除已使用的验证码
  verificationCodes.delete(phone);

  try {
    // 查找或创建用户
    let user = await User.findOne({ phone });
    let isNewUser = false;

    if (!user) {
      // 创建新用户
      user = new User({
        phone,
        nickName: `用户${phone.slice(-4)}`,
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await user.save();
      isNewUser = true;
      console.log('👤 创建新用户:', user.phone);
    } else {
      // 更新最后登录时间
      user.updatedAt = new Date();
      await user.save();
      console.log('👤 用户登录:', user.phone);
    }

    // 生成tokens
    const token = generateToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    console.log('✅ 登录成功，用户ID:', user._id);

    res.json({
      success: true,
      message: isNewUser ? '注册并登录成功' : '登录成功',
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          phone: user.phone,
          nickName: user.nickName,
          balance: user.balance
        },
        isNewUser
      }
    });

  } catch (error) {
  const err: any = error;
  console.error('❌ 登录过程出错:', err, err && (err.stack || err.message));
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
}));

// 生成滑块验证挑战
router.post('/slider-challenge', 
  sliderVerifyRateLimit(),
  sliderVerifyLogger,
  sliderVerifySecurityCheck,
  asyncHandler(async (req: Request, res: Response) => {
  console.log('🎯 收到生成滑块验证挑战请求');
  const { width } = req.body;

  try {
    const challenge = await sliderVerifyService.generateChallenge(width);
    
    res.json({
      success: true,
      message: '挑战生成成功',
      data: {
        sessionId: challenge.sessionId,
        puzzleOffset: challenge.puzzleOffset,
        timestamp: challenge.timestamp
      }
    });
  } catch (error) {
    console.error('❌ 生成滑块验证挑战失败:', error);
    res.status(500).json({
      success: false,
      message: '生成挑战失败，请稍后重试'
    });
  }
}));

// 滑动验证
router.post('/slider-verify',
  sliderVerifyRateLimit(),
  sliderVerifyLogger,
  sliderVerifySecurityCheck,
  sliderVerifyValidator,
  asyncHandler(async (req: Request, res: Response) => {
  console.log('🎯 收到滑动验证请求:', req.body);
  const { slideDistance, puzzleOffset, accuracy, duration, verifyPath, trackData, sessionId } = req.body;

  try {
    // 获取客户端信息
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    const result = await sliderVerifyService.verifySlider({
      slideDistance,
      puzzleOffset,
      accuracy,
      duration,
      verifyPath,
      trackData,
      sessionId
    }, clientIp, userAgent);

    if (result.verified) {
      console.log('✅ 滑动验证成功, token:', result.token);
      res.json({
        success: true,
        message: '验证成功',
        data: {
          verified: true,
          token: result.token,
          accuracy: result.accuracy,
          duration: result.duration,
          sessionId: result.sessionId
        }
      });
    } else {
      console.log('❌ 滑动验证失败:', result.reason);
      res.status(400).json({
        success: false,
        message: '验证失败，请重试',
        data: {
          verified: false,
          accuracy: result.accuracy,
          duration: result.duration,
          reason: result.reason,
          sessionId: result.sessionId
        }
      });
    }
  } catch (error) {
    console.error('❌ 滑动验证处理失败:', error);
    res.status(500).json({
      success: false,
      message: '验证处理失败，请稍后重试'
    });
  }
}));

// 验证滑块验证令牌
router.post('/validate-slider-token',
  sliderVerifyRateLimit(),
  sliderVerifyLogger,
  asyncHandler(async (req: Request, res: Response) => {
  console.log('🔍 收到验证滑块令牌请求');
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: '令牌不能为空'
    });
  }

  try {
    const isValid = await sliderVerifyService.validateToken(token);
    
    res.json({
      success: true,
      data: {
        valid: isValid,
        token: isValid ? token : null
      }
    });
  } catch (error) {
    console.error('❌ 验证滑块令牌失败:', error);
    res.status(500).json({
      success: false,
      message: '令牌验证失败'
    });
  }
}));

// 获取当前用户信息
router.get('/me', 
  authenticateToken,
  logApiAccess,
  asyncHandler(async (req: Request, res: Response) => {
  console.log('👤 收到获取用户信息请求');

  try {
    const user = req.user!;

    console.log('✅ 获取用户信息成功:', user.phone);

    res.json({
      success: true,
      message: '获取用户信息成功',
      data: {
        user: {
          id: user._id.toString(),
          phone: user.phone,
          nickName: user.nickName,
          balance: user.balance,
          verificationLevel: user.verificationLevel || 1,
          faceAuthEnabled: user.faceAuthEnabled || false,
          avatarUrl: user.avatarUrl,
          hasPassword: !!user.password
        }
      }
    });

  } catch (error) {
    console.error('❌ 获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
}));

// 用户登出
router.post('/logout', 
  authenticateToken,
  logApiAccess,
  asyncHandler(async (req: Request, res: Response) => {
  console.log('👋 收到退出登录请求');
  const { refreshToken } = req.body;
  const userId = req.user!._id.toString();

  try {
    const result = await userAuthService.logout(userId, refreshToken);

    res.json({
      success: result.success,
      message: result.message
    });

  } catch (error) {
    console.error('❌ 用户登出失败:', error);
    res.status(500).json({
      success: false,
      message: '登出过程中出现错误'
    });
  }
}));

// 刷新token
router.post('/refresh-token', 
  logApiAccess,
  userRateLimit(20, 60000), // 每分钟最多20次刷新
  asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token不能为空'
    });
  }

  try {
    const result = await userAuthService.refreshToken(refreshToken);

    if (result.success) {
      res.json({
        success: true,
        message: 'Token刷新成功',
        data: result.data
      });
    } else {
      res.status(401).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ Token刷新失败:', error);
    res.status(500).json({
      success: false,
      message: 'Token刷新过程中出现错误'
    });
  }
}));

// 更新密码
router.post('/update-password', 
  authenticateToken,
  logApiAccess,
  userRateLimit(5, 60000), // 每分钟最多5次密码更新
  asyncHandler(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user!._id.toString();

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: '新密码长度至少6位'
    });
  }

  try {
    const result = await userAuthService.updatePassword(userId, oldPassword, newPassword);

    res.json({
      success: result.success,
      message: result.message
    });

  } catch (error) {
    console.error('❌ 更新密码失败:', error);
    res.status(500).json({
      success: false,
      message: '更新密码过程中出现错误'
    });
  }
}));

// 重置密码
router.post('/reset-password', 
  logApiAccess,
  userRateLimit(3, 60000), // 每分钟最多3次密码重置
  asyncHandler(async (req: Request, res: Response) => {
  const { phone, newPassword, verifyToken } = req.body;

  if (!phone || !newPassword || !verifyToken) {
    return res.status(400).json({
      success: false,
      message: '参数不完整'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: '密码长度至少6位'
    });
  }

  try {
    const result = await userAuthService.resetPassword(phone, newPassword, verifyToken);

    res.json({
      success: result.success,
      message: result.message
    });

  } catch (error) {
    console.error('❌ 重置密码失败:', error);
    res.status(500).json({
      success: false,
      message: '重置密码过程中出现错误'
    });
  }
}));

// 获取登录历史
router.get('/login-history', 
  authenticateToken,
  logApiAccess,
  requireOwnership('userId'),
  asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const limit = parseInt(req.query.limit as string) || 10;

  try {
    const history = await userAuthService.getLoginHistory(userId, limit);

    res.json({
      success: true,
      message: '获取登录历史成功',
      data: {
        history,
        total: history.length
      }
    });

  } catch (error) {
    console.error('❌ 获取登录历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取登录历史过程中出现错误'
    });
  }
}));

export default router;