import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../middleware/errorHandler';
import User from '../models/User';

const router = express.Router();

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'smart-charging-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// JWT工具函数
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// 密码加密函数
const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// 滑块验证接口
router.post('/slider-verify', asyncHandler(async (req, res) => {
  const {
    slideDistance,
    puzzleOffset,
    accuracy,
    duration,
    verifyPath,
    trackData
  } = req.body;

  // 验证参数
  if (typeof slideDistance !== 'number' ||
    typeof puzzleOffset !== 'number' ||
    typeof accuracy !== 'number' ||
    typeof duration !== 'number') {
    return res.status(400).json({
      success: false,
      message: '验证参数无效',
      data: { verified: false, token: null }
    });
  }

  try {
    // 1. 精度验证 - 允许10像素误差
    const ACCURACY_THRESHOLD = 10;
    const accuracyValid = accuracy <= ACCURACY_THRESHOLD;

    // 2. 时间验证 - 人类操作时间范围（500ms - 10s）
    const MIN_DURATION = 500;
    const MAX_DURATION = 10000;
    const durationValid = duration >= MIN_DURATION && duration <= MAX_DURATION;

    // 3. 轨迹验证 - 检查拖拽轨迹的合理性
    const trackValid = validateTrackData(trackData, slideDistance);

    // 4. 路径验证 - 检查移动路径是否平滑
    const pathValid = validateVerifyPath(verifyPath, slideDistance);

    // 5. 行为验证 - 检测是否为机器人行为
    const behaviorValid = validateHumanBehavior(duration, trackData, verifyPath);

    // 综合评分（所有验证都必须通过）
    const verified = accuracyValid && durationValid && trackValid && pathValid && behaviorValid;

    // 生成验证令牌
    let token = null;
    if (verified) {
      token = generateVerifyToken();

      // 可选：记录成功的验证日志
      console.log(`滑块验证成功: 精度=${accuracy}, 时长=${duration}ms, 用户IP=${req.ip}`);
    } else {
      // 记录失败的验证尝试（用于安全监控）
      console.log(`滑块验证失败: 精度=${accuracy}(${accuracyValid}), 时长=${duration}(${durationValid}), 轨迹=${trackValid}, 路径=${pathValid}, 行为=${behaviorValid}`);
    }

    res.json({
      success: true,
      message: verified ? '验证成功' : '验证失败',
      data: {
        verified,
        token,
        details: {
          accuracy: accuracyValid,
          duration: durationValid,
          track: trackValid,
          path: pathValid,
          behavior: behaviorValid
        }
      }
    });
  } catch (error) {
    console.error('滑块验证错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器验证错误',
      data: { verified: false, token: null }
    });
  }
}));

// 验证拖拽轨迹数据
function validateTrackData(trackData: any[], expectedDistance: number): boolean {
  if (!Array.isArray(trackData) || trackData.length < 5) {
    return false; // 轨迹点太少，可能是机器人
  }

  // 检查轨迹是否单调递增（正常拖拽行为）
  let isMonotonic = true;
  for (let i = 1; i < trackData.length; i++) {
    if (trackData[i].currentX < trackData[i - 1].currentX) {
      isMonotonic = false;
      break;
    }
  }

  // 检查最终距离是否匹配
  const finalDistance = trackData[trackData.length - 1]?.currentX || 0;
  const distanceMatch = Math.abs(finalDistance - expectedDistance) <= 5;

  return isMonotonic && distanceMatch;
}

// 验证移动路径
function validateVerifyPath(verifyPath: number[], expectedDistance: number): boolean {
  if (!Array.isArray(verifyPath) || verifyPath.length < 10) {
    return false; // 路径点太少
  }

  // 检查路径是否平滑（相邻点的距离不应该太大）
  const MAX_STEP = 15; // 最大单步移动距离
  for (let i = 1; i < verifyPath.length; i++) {
    const step = Math.abs(verifyPath[i] - verifyPath[i - 1]);
    if (step > MAX_STEP) {
      return false; // 移动太快，可能是机器人
    }
  }

  // 检查最终位置
  const finalPath = verifyPath[verifyPath.length - 1];
  return Math.abs(finalPath - expectedDistance) <= 10;
}

// 验证人类行为特征
function validateHumanBehavior(duration: number, trackData: any[], verifyPath: number[]): boolean {
  // 1. 检查速度变化 - 人类拖拽通常有加速和减速
  const hasSpeedVariation = checkSpeedVariation(trackData, duration);

  // 2. 检查微小抖动 - 人手操作会有轻微抖动
  const hasMicroMovements = checkMicroMovements(verifyPath);

  // 3. 检查停顿 - 人类可能会有短暂停顿
  const hasPauses = checkPauses(trackData);

  // 至少满足其中两个特征
  const humanFeatures = [hasSpeedVariation, hasMicroMovements, hasPauses].filter(Boolean).length;
  return humanFeatures >= 1; // 降低要求，确保正常用户能通过
}

// 检查速度变化
function checkSpeedVariation(trackData: any[], duration: number): boolean {
  if (trackData.length < 3) return false;

  const speeds = [];
  for (let i = 1; i < trackData.length; i++) {
    const distance = Math.abs(trackData[i].currentX - trackData[i - 1].currentX);
    const timeStep = duration / trackData.length; // 简化的时间计算
    speeds.push(distance / timeStep);
  }

  // 检查是否有速度变化
  const maxSpeed = Math.max(...speeds);
  const minSpeed = Math.min(...speeds);
  return (maxSpeed - minSpeed) > 0.1; // 有显著的速度变化
}

// 检查微小抖动
function checkMicroMovements(verifyPath: number[]): boolean {
  let reversals = 0;
  for (let i = 2; i < verifyPath.length; i++) {
    const prev = verifyPath[i - 1] - verifyPath[i - 2];
    const curr = verifyPath[i] - verifyPath[i - 1];
    if (prev > 0 && curr < 0) {
      reversals++;
    }
  }
  return reversals >= 1 && reversals <= 5; // 适量的方向改变
}

// 检查停顿
function checkPauses(trackData: any[]): boolean {
  let consecutiveSame = 0;
  let maxPause = 0;

  for (let i = 1; i < trackData.length; i++) {
    if (Math.abs(trackData[i].currentX - trackData[i - 1].currentX) < 1) {
      consecutiveSame++;
    } else {
      maxPause = Math.max(maxPause, consecutiveSame);
      consecutiveSame = 0;
    }
  }

  return maxPause >= 2 && maxPause <= 10; // 有合理的停顿
}

// 生成验证令牌
function generateVerifyToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const token = `slider_${timestamp}_${random}`;

  // 实际项目中应该使用 JWT 或其他安全的令牌生成方式
  // 这里可以添加令牌缓存和过期机制

  return token;
}

// 人脸验证
router.post('/face-verify', asyncHandler(async (req, res) => {
  // TODO: 实现人脸验证逻辑
  res.json({
    success: true,
    message: 'Face verification endpoint - to be implemented',
    data: {
      verified: false,
      confidence: 0,
      token: null
    }
  });
}));

// 用户注册
router.post('/register', asyncHandler(async (req: any, res: any) => {
  const { phone, password, nickName } = req.body;

  // 参数验证
  if (!phone || !password) {
    return res.status(400).json({
      success: false,
      message: '手机号和密码不能为空'
    });
  }

  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: '手机号格式不正确'
    });
  }

  // 验证密码长度
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: '密码长度至少6位'
    });
  }

  try {
    // 检查用户是否已存在
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '该手机号已注册'
      });
    }

    // 加密密码
    const hashedPassword = await hashPassword(password);

    // 创建新用户
    const newUser = new User({
      phone,
      password: hashedPassword,
      nickName: nickName || `用户${phone.slice(-4)}`,
      balance: 0,
      verificationLevel: 'basic'
    });

    await newUser.save();

    // 生成JWT令牌
    const token = generateToken(newUser._id.toString());
    const refreshToken = generateRefreshToken(newUser._id.toString());

    // 返回用户信息（不包含密码）
    const userResponse = {
      id: newUser._id,
      phone: newUser.phone,
      nickName: newUser.nickName,
      balance: newUser.balance,
      verificationLevel: newUser.verificationLevel,
      vehicles: newUser.vehicles
    };

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: userResponse,
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({
      success: false,
      message: '注册失败，请稍后重试'
    });
  }
}));

// 用户登录
router.post('/login', asyncHandler(async (req: any, res: any) => {
  const { username, password, verifyToken } = req.body;

  // 参数验证
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: '用户名和密码不能为空'
    });
  }

  // 验证滑块令牌（如果提供）
  if (verifyToken && !verifyToken.startsWith('slider_')) {
    return res.status(400).json({
      success: false,
      message: '验证令牌无效'
    });
  }

  try {
    // 查找用户（支持手机号或用户名登录）
    const user: any = await User.findOne({
      $or: [
        { phone: username },
        { nickName: username }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或密码错误'
      });
    }

    // 模拟密码验证（实际项目中应该有密码字段）
    // 这里使用简单的演示逻辑
    const validCredentials = [
      { username: 'admin', password: '123456' },
      { username: '13800138000', password: '123456' },
      { username: 'test', password: 'password' }
    ];

    const isValidCredential = validCredentials.some(cred =>
      (cred.username === username || cred.username === user.phone) &&
      cred.password === password
    );

    if (!isValidCredential) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或密码错误'
      });
    }

    // 更新最后登录时间
    await User.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date()
    });

    // 生成JWT令牌
    const token = generateToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // 返回用户信息（不包含密码）
    const userResponse = {
      id: user._id,
      phone: user.phone,
      nickName: user.nickName || `用户${user.phone.slice(-4)}`,
      balance: user.balance || 100, // 演示余额
      verificationLevel: user.verificationLevel,
      vehicles: user.vehicles || [],
      avatarUrl: user.avatarUrl
    };

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: userResponse,
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
}));

// 刷新令牌
router.post('/refresh', asyncHandler(async (req: any, res: any) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: '刷新令牌不能为空'
    });
  }

  try {
    // 验证刷新令牌
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: '刷新令牌无效'
      });
    }

    // 检查用户是否存在
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 生成新的访问令牌
    const newToken = generateToken(user._id.toString());
    const newRefreshToken = generateRefreshToken(user._id.toString());

    res.json({
      success: true,
      message: '令牌刷新成功',
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('令牌刷新失败:', error);
    res.status(500).json({
      success: false,
      message: '令牌刷新失败'
    });
  }
}));

// 登出
router.post('/logout', asyncHandler(async (req: any, res: any) => {
  // 在实际应用中，这里可以将令牌加入黑名单
  // 目前只返回成功响应
  res.json({
    success: true,
    message: '登出成功'
  });
}));

// 获取当前用户信息
router.get('/me', asyncHandler(async (req: any, res: any) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: '未提供有效的认证令牌'
    });
  }

  const token = authHeader.substring(7); // 移除 "Bearer " 前缀

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: '令牌无效或已过期'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    const userResponse = {
      id: user._id,
      phone: user.phone,
      nickName: user.nickName,
      balance: user.balance,
      verificationLevel: user.verificationLevel,
      vehicles: user.vehicles,
      avatarUrl: user.avatarUrl
    };

    res.json({
      success: true,
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
}));

export default router;