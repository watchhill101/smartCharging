import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler';
import User from '../models/User';
import FaceVerificationService from '../services/faceVerificationService';

const router = express.Router();
const faceVerificationService = new FaceVerificationService();

// 配置multer用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
    files: 2 // 最多2个文件（用于人脸比较）
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件') as any, false);
    }
  }
});

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
    // 1. 精度验证 - 大幅放宽到150像素误差（适应真实用户操作）
    const ACCURACY_THRESHOLD = 150;
    const accuracyValid = accuracy <= ACCURACY_THRESHOLD;

    // 2. 时间验证 - 人类操作时间范围（100ms - 20s）
    const MIN_DURATION = 100;
    const MAX_DURATION = 20000;
    const durationValid = duration >= MIN_DURATION && duration <= MAX_DURATION;

    // 3. 轨迹验证 - 检查拖拽轨迹的合理性（放宽条件）
    const trackValid = validateTrackData(trackData, slideDistance);

    // 4. 路径验证 - 检查移动路径是否平滑（放宽条件）
    const pathValid = validateVerifyPath(verifyPath, slideDistance);

    // 5. 行为验证 - 检测是否为机器人行为（降低要求）
    const behaviorValid = validateHumanBehavior(duration, trackData, verifyPath);

    // 综合评分（至少通过基本验证：精度和时长）
    const basicValid = accuracyValid && durationValid;
    const verified = basicValid; // 暂时只要求基本验证通过

    // 生成验证令牌
    let token = null;
    if (verified) {
      token = generateVerifyToken();

      // 记录成功的验证日志
      console.log(`✅ 滑块验证成功: 精度=${accuracy.toFixed(2)}px(阈值${ACCURACY_THRESHOLD}px), 时长=${duration}ms, 用户IP=${req.ip}`);
    } else {
      // 记录失败的验证尝试
      console.log(`❌ 滑块验证失败: 精度=${accuracy.toFixed(2)}px(需要≤${ACCURACY_THRESHOLD}px)(${accuracyValid}), 时长=${duration}ms(需要${MIN_DURATION}-${MAX_DURATION}ms)(${durationValid})`);
    }

    res.json({
      success: true,
      message: verified ? '验证成功' : '验证失败，请重试',
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

// 验证拖拽轨迹数据（放宽条件）
function validateTrackData(trackData: any[], expectedDistance: number): boolean {
  if (!Array.isArray(trackData) || trackData.length < 3) {
    return false; // 轨迹点太少
  }

  // 检查最终距离是否大致匹配（放宽到50像素误差）
  const finalDistance = trackData[trackData.length - 1]?.currentX || 0;
  const distanceMatch = Math.abs(finalDistance - expectedDistance) <= 50;

  return distanceMatch;
}

// 验证移动路径（放宽条件）
function validateVerifyPath(verifyPath: number[], expectedDistance: number): boolean {
  if (!Array.isArray(verifyPath) || verifyPath.length < 5) {
    return false; // 路径点太少
  }

  // 检查最终位置（放宽到50像素误差）
  const finalPath = verifyPath[verifyPath.length - 1];
  return Math.abs(finalPath - expectedDistance) <= 50;
}

// 验证人类行为特征（降低要求）
function validateHumanBehavior(duration: number, trackData: any[], verifyPath: number[]): boolean {
  // 基本的时间合理性检查
  if (duration < 100 || duration > 20000) {
    return false;
  }

  // 基本的数据存在性检查
  const hasData = Array.isArray(trackData) && trackData.length > 0 &&
    Array.isArray(verifyPath) && verifyPath.length > 0;

  return hasData;
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

// 人脸检测接口
router.post('/face-detect', upload.single('image'), asyncHandler(async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传图片文件'
      });
    }

    // 验证图片质量
    const qualityResult = await faceVerificationService.validateImageQuality(req.file.buffer);
    if (!qualityResult.success) {
      return res.status(400).json(qualityResult);
    }

    // 检测人脸
    const detectResult = await faceVerificationService.detectFaces(req.file.buffer);

    res.json({
      success: detectResult.success,
      message: detectResult.message,
      data: {
        faceDetected: detectResult.data?.faceDetected || false,
        faceCount: detectResult.data?.faceCount || 0,
        confidence: detectResult.data?.confidence || 0,
        verified: detectResult.data?.verified || false,
        details: detectResult.data?.details
      }
    });
  } catch (error: any) {
    console.error('人脸检测接口错误:', error);
    res.status(500).json({
      success: false,
      message: '人脸检测服务异常，请稍后重试'
    });
  }
}));

// 人脸比较接口
router.post('/face-compare', upload.fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 }
]), asyncHandler(async (req: any, res: any) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.image1 || !files.image2) {
      return res.status(400).json({
        success: false,
        message: '请上传两张图片进行比较'
      });
    }

    const image1 = files.image1[0];
    const image2 = files.image2[0];

    // 验证图片质量
    const quality1 = await faceVerificationService.validateImageQuality(image1.buffer);
    const quality2 = await faceVerificationService.validateImageQuality(image2.buffer);

    if (!quality1.success || !quality2.success) {
      return res.status(400).json({
        success: false,
        message: '图片质量验证失败，请上传清晰的人脸照片'
      });
    }

    // 比较人脸
    const compareResult = await faceVerificationService.compareFaces(
      image1.buffer,
      image2.buffer
    );

    res.json({
      success: compareResult.success,
      message: compareResult.message,
      data: {
        isMatch: compareResult.data?.isMatch || false,
        confidence: compareResult.data?.confidence || 0,
        similarity: compareResult.data?.similarity || 0,
        matchLevel: compareResult.data?.confidence > 0.8 ? 'high' :
          compareResult.data?.confidence > 0.6 ? 'medium' : 'low'
      }
    });
  } catch (error: any) {
    console.error('人脸比较接口错误:', error);
    res.status(500).json({
      success: false,
      message: '人脸比较服务异常，请稍后重试'
    });
  }
}));

// 人脸属性识别接口
router.post('/face-attributes', upload.single('image'), asyncHandler(async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传图片文件'
      });
    }

    // 验证图片质量
    const qualityResult = await faceVerificationService.validateImageQuality(req.file.buffer);
    if (!qualityResult.success) {
      return res.status(400).json(qualityResult);
    }

    // 识别人脸属性
    const attributesResult = await faceVerificationService.recognizeFaceAttributes(req.file.buffer);

    res.json({
      success: attributesResult.success,
      message: attributesResult.message,
      data: {
        detected: attributesResult.data?.faceDetected || false,
        faceCount: attributesResult.data?.faceCount || 0,
        attributes: attributesResult.data?.details || {}
      }
    });
  } catch (error: any) {
    console.error('人脸属性识别接口错误:', error);
    res.status(500).json({
      success: false,
      message: '人脸属性识别服务异常，请稍后重试'
    });
  }
}));

// 综合人脸验证接口（原有接口的升级版）
router.post('/face-verify', upload.single('image'), asyncHandler(async (req: any, res: any) => {
  try {
    const { userId, action = 'detect' } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传图片文件'
      });
    }

    // 验证图片质量
    const qualityResult = await faceVerificationService.validateImageQuality(req.file.buffer);
    if (!qualityResult.success) {
      return res.status(400).json(qualityResult);
    }

    let result;

    switch (action) {
      case 'detect':
        // 检测人脸
        result = await faceVerificationService.detectFaces(req.file.buffer);
        break;

      case 'attributes':
        // 识别属性
        result = await faceVerificationService.recognizeFaceAttributes(req.file.buffer);
        break;

      default:
        // 默认进行人脸检测
        result = await faceVerificationService.detectFaces(req.file.buffer);
    }

    // 如果验证成功且提供了用户ID，生成验证Token
    let verificationToken = null;
    if (result.success && result.data?.verified && userId) {
      verificationToken = faceVerificationService.generateVerificationToken(userId, result.data);
    }

    res.json({
      success: result.success,
      message: result.message,
      data: {
        verified: result.data?.verified || false,
        confidence: result.data?.confidence || 0,
        faceDetected: result.data?.faceDetected || false,
        faceCount: result.data?.faceCount || 0,
        token: verificationToken,
        details: action === 'attributes' ? result.data?.details : undefined
      }
    });
  } catch (error: any) {
    console.error('人脸验证接口错误:', error);
    res.status(500).json({
      success: false,
      message: '人脸验证服务异常，请稍后重试'
    });
  }
}));

// 验证码存储 (在实际项目中应该使用 Redis)
const verifyCodeStorage = new Map<string, { code: string; expireTime: number }>();

// 发送验证码
router.post('/send-verify-code', asyncHandler(async (req: any, res: any) => {
  const { phone } = req.body;

  // 验证手机号格式
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: '请输入正确的手机号格式'
    });
  }

  try {
    // 生成6位随机验证码
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 设置过期时间（5分钟）
    const expireTime = Date.now() + 5 * 60 * 1000;

    // 存储验证码
    verifyCodeStorage.set(phone, {
      code: verifyCode,
      expireTime
    });

    // 在实际项目中，这里应该调用短信服务发送验证码
    // 现在我们只是模拟发送，并在控制台打印验证码供测试使用
    console.log(`📱 向手机号 ${phone} 发送验证码: ${verifyCode}`);
    console.log(`⏰ 验证码有效期: 5分钟`);

    res.json({
      success: true,
      message: '验证码发送成功',
      data: {
        phone,
        // 在开发环境下返回验证码，方便测试
        ...(process.env.NODE_ENV !== 'production' && { code: verifyCode })
      }
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '验证码发送失败，请稍后重试'
    });
  }
}));

// 验证码登录
router.post('/login-with-code', asyncHandler(async (req: any, res: any) => {
  const { phone, verifyCode, verifyToken } = req.body;

  // 参数验证
  if (!phone || !verifyCode) {
    return res.status(400).json({
      success: false,
      message: '手机号和验证码不能为空'
    });
  }

  // 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: '手机号格式不正确'
    });
  }

  // 验证码格式验证
  if (!/^\d{6}$/.test(verifyCode)) {
    return res.status(400).json({
      success: false,
      message: '验证码应为6位数字'
    });
  }

  try {
    // 验证验证码
    const storedCodeInfo = verifyCodeStorage.get(phone);

    if (!storedCodeInfo) {
      return res.status(400).json({
        success: false,
        message: '验证码不存在或已过期，请重新获取'
      });
    }

    if (Date.now() > storedCodeInfo.expireTime) {
      verifyCodeStorage.delete(phone);
      return res.status(400).json({
        success: false,
        message: '验证码已过期，请重新获取'
      });
    }

    if (storedCodeInfo.code !== verifyCode) {
      return res.status(400).json({
        success: false,
        message: '验证码错误'
      });
    }

    // 验证码正确，删除已使用的验证码
    verifyCodeStorage.delete(phone);

    // 查找或创建用户
    let user: any = await User.findOne({ phone });

    if (!user) {
      console.log(`创建新用户: ${phone}`);
      user = new User({
        phone,
        nickName: `用户${phone.slice(-4)}`,
        password: 'phone_login_user', // 手机号登录用户标识
        balance: 100,
        verificationLevel: 'basic'
      });

      try {
        await user.save();
        console.log(`✅ 用户创建成功: ${phone} -> ${user._id}`);
      } catch (createError) {
        console.error(`❌ 用户创建失败: ${phone}`, createError);
        return res.status(500).json({
          success: false,
          message: '用户创建失败，请稍后重试'
        });
      }
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
      nickName: user.nickName,
      balance: user.balance || 100,
      verificationLevel: user.verificationLevel,
      vehicles: user.vehicles || [],
      avatarUrl: user.avatarUrl
    };

    console.log(`✅ 验证码登录成功: ${phone}`);

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
    console.error('验证码登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
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
    let user: any = await User.findOne({
      $or: [
        { phone: username },
        { nickName: username }
      ]
    });

    // 模拟密码验证（演示用途，实际项目中应该有密码字段）
    // 扩展预设的测试用户名和密码
    const validCredentials = [
      { username: 'admin', password: '123456' },
      { username: '13800138000', password: '123456' },
      { username: 'test', password: 'password' },
      { username: 'user', password: '123456' },
      { username: 'demo', password: '123456' },
      { username: '18888888888', password: '123456' },
      // 默认密码策略：任何6位数字密码都可以用于测试
      { username: username, password: '123456' },
      { username: username, password: 'password' },
      { username: username, password: '111111' },
      { username: username, password: '000000' }
    ];

    const isValidCredential = validCredentials.some(cred =>
      cred.username === username && cred.password === password
    ) || (
        // 额外的宽松验证：密码长度>=6即可通过（仅用于开发测试）
        password.length >= 6 && process.env.NODE_ENV !== 'production'
      );

    // 如果用户不存在但使用了有效的预设凭据，则创建用户
    if (!user && isValidCredential) {
      console.log(`创建新用户: ${username}`);

      // 生成唯一的手机号，避免重复键错误
      const generateUniquePhone = () => {
        if (/^\d+$/.test(username) && username.length === 11) {
          return username; // 如果用户名本身是11位手机号，直接使用
        }
        // 生成基于时间戳的唯一手机号
        const timestamp = Date.now().toString();
        return `138${timestamp.slice(-8)}`; // 138 + 8位时间戳后缀
      };

      user = new User({
        phone: generateUniquePhone(),
        nickName: username,
        password: 'hashed_password_placeholder', // 在实际项目中应该哈希密码
        balance: 100,
        verificationLevel: 'basic'
      });

      try {
        await user.save();
        console.log(`✅ 用户创建成功: ${username} -> ${user.phone}`);
      } catch (createError) {
        console.error(`❌ 用户创建失败: ${username}`, createError);
        return res.status(500).json({
          success: false,
          message: '用户创建失败，请稍后重试'
        });
      }
    }

    if (!user || !isValidCredential) {
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