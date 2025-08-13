import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../middleware/errorHandler';
import User from '../models/User';

const router = express.Router();

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// 生成JWT token
const generateToken = (userId: string) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// 生成刷新token
const generateRefreshToken = (userId: string) => {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
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

// 验证码登录
router.post('/login-with-code', asyncHandler(async (req: Request, res: Response) => {
  console.log('🔐 收到验证码登录请求:', { ...req.body, verifyCode: '***' });
  const { phone, verifyCode, verifyToken } = req.body;

  if (!phone || !verifyCode) {
    return res.status(400).json({
      success: false,
      message: '手机号和验证码不能为空'
    });
  }

  // 验证滑块验证token（简化实现）
  if (!verifyToken) {
    return res.status(400).json({
      success: false,
      message: '请先完成安全验证'
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
    console.error('❌ 登录过程出错:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
}));

// 刷新token
router.post('/refresh-token', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: '刷新令牌不能为空'
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 生成新的tokens
    const newToken = generateToken(user._id.toString());
    const newRefreshToken = generateRefreshToken(user._id.toString());

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      message: '刷新令牌无效'
    });
  }
}));

export default router;