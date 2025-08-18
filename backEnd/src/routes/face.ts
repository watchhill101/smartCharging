import express, { Request, Response } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { FaceRecognitionService } from '../services/FaceRecognitionService';
import User from '../models/User';
import FaceProfile from '../models/FaceProfile';
import FaceLoginRecord from '../models/FaceLoginRecord';

const router = express.Router();
const faceService = new FaceRecognitionService();

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// 生成JWT token
const generateToken = (userId: string) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

// 生成刷新token
const generateRefreshToken = (userId: string) => {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
};

// 配置multer用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB限制
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  }
});

// 获取设备信息
const getDeviceInfo = (req: Request) => {
  const userAgent = req.get('User-Agent') || '';
  return {
    userAgent,
    platform: req.get('X-Platform') || 'web',
    ip: req.ip || req.connection.remoteAddress || ''
  };
};

// 人脸检测接口
router.post('/detect', upload.single('image'), asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传人脸图片'
      });
    }

    console.log('📷 收到人脸检测请求');

    // 验证图片质量
    const qualityResult = faceService.validateImageQuality(req.file.buffer);
    if (!qualityResult.success) {
      return res.status(400).json({
        success: false,
        message: qualityResult.message
      });
    }

    // 检测人脸
    const detectionResult = await faceService.detectFace(req.file.buffer);

    res.json({
      success: detectionResult.success,
      message: detectionResult.message,
      data: detectionResult.data
    });

  } catch (error: any) {
    console.error('❌ 人脸检测接口错误:', error);
    res.status(500).json({
      success: false,
      message: '人脸检测服务异常，请稍后重试'
    });
  }
}));

// 人脸注册接口（需要认证）
router.post('/register', authenticate, upload.single('image'), asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传人脸图片'
      });
    }

    const userId = (req as any).user.id;
    console.log(`👤 用户 ${userId} 请求注册人脸`);

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查用户已有的人脸档案数量
    const existingProfiles = await FaceProfile.find({ userId, isActive: true });
    if (existingProfiles.length >= 3) {
      return res.status(400).json({
        success: false,
        message: '每个用户最多只能注册3个人脸档案'
      });
    }

    // 验证图片质量
    const qualityResult = faceService.validateImageQuality(req.file.buffer);
    if (!qualityResult.success) {
      return res.status(400).json({
        success: false,
        message: qualityResult.message
      });
    }

    // 检测人脸
    const detectionResult = await faceService.detectFace(req.file.buffer);
    if (!detectionResult.success || !detectionResult.data?.features) {
      return res.status(400).json({
        success: false,
        message: detectionResult.message
      });
    }

    // 检查是否与现有人脸重复
    for (const profile of existingProfiles) {
      const comparisonResult = await faceService.compareFaces(
        detectionResult.data.features.encoding,
        profile.features.encoding
      );

      if (comparisonResult.success && comparisonResult.data?.isMatch) {
        return res.status(400).json({
          success: false,
          message: '该人脸已经注册过，请不要重复注册'
        });
      }
    }

    // 创建人脸档案
    const faceId = faceService.generateFaceId();
    const deviceInfo = getDeviceInfo(req);

    const faceProfile = new FaceProfile({
      userId,
      faceId,
      features: {
        encoding: detectionResult.data.features.encoding,
        landmarks: detectionResult.data.features.landmarks,
        confidence: detectionResult.data.confidence
      },
      deviceInfo
    });

    await faceProfile.save();

    // 更新用户信息
    user.faceEnabled = true;
    user.faceProfileCount = existingProfiles.length + 1;
    await user.save();

    console.log(`✅ 用户 ${userId} 人脸注册成功: ${faceId}`);

    res.json({
      success: true,
      message: '人脸注册成功',
      data: {
        faceId,
        confidence: detectionResult.data.confidence,
        quality: detectionResult.data.quality,
        profileCount: user.faceProfileCount
      }
    });

  } catch (error: any) {
    console.error('❌ 人脸注册失败:', error);
    res.status(500).json({
      success: false,
      message: '人脸注册服务异常，请稍后重试'
    });
  }
}));

// 人脸登录接口
router.post('/login', upload.single('image'), asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传人脸图片'
      });
    }

    console.log('🔐 收到人脸登录请求');
    const deviceInfo = getDeviceInfo(req);

    // 验证图片质量
    const qualityResult = faceService.validateImageQuality(req.file.buffer);
    if (!qualityResult.success) {
      return res.status(400).json({
        success: false,
        message: qualityResult.message
      });
    }

    // 检测人脸
    const detectionResult = await faceService.detectFace(req.file.buffer);
    if (!detectionResult.success || !detectionResult.data?.features) {
      return res.status(400).json({
        success: false,
        message: detectionResult.message || '人脸检测失败'
      });
    }

    // 获取所有活跃的人脸档案
    const faceProfiles = await FaceProfile.find({ isActive: true }).populate('userId');
    if (faceProfiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: '系统中暂无注册的人脸信息'
      });
    }

    // 与所有人脸档案进行比对
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const profile of faceProfiles) {
      const comparisonResult = await faceService.compareFaces(
        detectionResult.data.features.encoding,
        profile.features.encoding
      );

      if (comparisonResult.success && comparisonResult.data) {
        const { similarity, isMatch } = comparisonResult.data;

        if (isMatch && similarity > bestSimilarity) {
          bestMatch = {
            profile,
            similarity,
            confidence: comparisonResult.data.confidence
          };
          bestSimilarity = similarity;
        }
      }
    }

    // 记录登录尝试
    const loginRecord = {
      success: !!bestMatch,
      confidence: detectionResult.data.confidence,
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
      deviceInfo: {
        platform: deviceInfo.platform,
        browser: deviceInfo.userAgent.split(' ')[0] || 'unknown',
        version: '1.0'
      },
      attempts: 1
    };

    if (!bestMatch) {
      // 登录失败，记录失败日志
      await FaceLoginRecord.create({
        userId: null,
        faceId: 'unknown',
        failureReason: '未找到匹配的人脸档案',
        ...loginRecord
      });

      return res.status(401).json({
        success: false,
        message: '未找到匹配的用户，请先用手机验证码登录并注册人脸档案'
      });
    }

    // 登录成功
    const user = bestMatch.profile.userId as any;

    // 检查失败次数限制
    const recentFailures = await FaceLoginRecord.getFailedAttempts(user._id.toString(), 15);
    if (recentFailures >= 5) {
      await FaceLoginRecord.create({
        userId: user._id,
        faceId: bestMatch.profile.faceId,
        failureReason: '登录尝试次数过多，已被暂时锁定',
        ...loginRecord,
        success: false
      });

      return res.status(429).json({
        success: false,
        message: '登录尝试次数过多，请15分钟后再试'
      });
    }

    // 记录成功登录
    await FaceLoginRecord.create({
      userId: user._id,
      faceId: bestMatch.profile.faceId,
      ...loginRecord
    });

    // 更新人脸档案最后使用时间
    bestMatch.profile.lastUsedAt = new Date();
    await bestMatch.profile.save();

    // 更新用户最后登录时间
    user.lastLoginAt = new Date();
    await user.save();

    // 生成tokens
    const token = generateToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    console.log(`✅ 用户 ${user._id} 人脸登录成功，相似度: ${bestSimilarity.toFixed(3)}`);

    res.json({
      success: true,
      message: '人脸登录成功',
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          phone: user.phone,
          nickName: user.nickName,
          balance: user.balance
        },
        faceInfo: {
          faceId: bestMatch.profile.faceId,
          similarity: bestSimilarity,
          confidence: bestMatch.confidence
        }
      }
    });

  } catch (error: any) {
    console.error('❌ 人脸登录失败:', error);
    res.status(500).json({
      success: false,
      message: '人脸登录服务异常，请稍后重试'
    });
  }
}));

// 获取用户人脸档案列表
router.get('/profiles', authenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const profiles = await FaceProfile.find({ userId, isActive: true })
      .select('faceId createdAt lastUsedAt features.confidence')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        profiles: profiles.map(profile => ({
          faceId: profile.faceId,
          confidence: profile.features.confidence,
          createdAt: profile.createdAt,
          lastUsedAt: profile.lastUsedAt
        })),
        total: profiles.length,
        maxAllowed: 3
      }
    });

  } catch (error: any) {
    console.error('❌ 获取人脸档案失败:', error);
    res.status(500).json({
      success: false,
      message: '获取人脸档案失败'
    });
  }
}));

// 删除人脸档案
router.delete('/profiles/:faceId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { faceId } = req.params;
    const userId = (req as any).user.id;

    const profile = await FaceProfile.findOne({ faceId, userId, isActive: true });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: '人脸档案不存在'
      });
    }

    // 软删除
    profile.isActive = false;
    await profile.save();

    // 更新用户人脸档案数量
    const user = await User.findById(userId);
    if (user) {
      user.faceProfileCount = Math.max(0, user.faceProfileCount - 1);
      if (user.faceProfileCount === 0) {
        user.faceEnabled = false;
      }
      await user.save();
    }

    console.log(`🗑️ 用户 ${userId} 删除人脸档案: ${faceId}`);

    res.json({
      success: true,
      message: '人脸档案删除成功'
    });

  } catch (error: any) {
    console.error('❌ 删除人脸档案失败:', error);
    res.status(500).json({
      success: false,
      message: '删除人脸档案失败'
    });
  }
}));

// 获取人脸登录记录
router.get('/login-records', authenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const records = await FaceLoginRecord.find({ userId })
      .sort({ loginAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('faceId success confidence loginAt ipAddress deviceInfo failureReason');

    const total = await FaceLoginRecord.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          currentPage: Number(page),
          totalRecords: total,
          totalPages: Math.ceil(total / Number(limit)),
          hasMore: skip + records.length < total
        }
      }
    });

  } catch (error: any) {
    console.error('❌ 获取登录记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取登录记录失败'
    });
  }
}));

// 简化的人脸登录接口（跳过数据库，直接返回模拟用户）
router.post('/auto-register-login', upload.single('image'), asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传人脸图片'
      });
    }

    console.log('🆕 收到自动注册登录请求');
    
    // 验证图片质量
    const qualityResult = faceService.validateImageQuality(req.file.buffer);
    if (!qualityResult.success) {
      return res.status(400).json({
        success: false,
        message: qualityResult.message
      });
    }

    // 检测人脸
    const detectionResult = await faceService.detectFace(req.file.buffer);
    if (!detectionResult.success || !detectionResult.data?.features) {
      return res.status(400).json({
        success: false,
        message: detectionResult.message || '人脸检测失败'
      });
    }

    console.log('✅ 人脸检测成功，置信度:', detectionResult.data.confidence);

    // 生成模拟用户数据（无需数据库）
    const mockUserId = `user_${Date.now()}`;
    const mockFaceId = `face_${Date.now()}`;
    
    // 生成临时tokens
    const token = generateToken(mockUserId);
    const refreshToken = generateRefreshToken(mockUserId);

    console.log(`🎉 模拟自动注册登录成功: ${mockUserId}`);

    res.json({
      success: true,
      message: '欢迎新用户！账户已自动创建',
      data: {
        token,
        refreshToken,
        user: {
          id: mockUserId,
          phone: `temp_${Date.now()}`,
          nickName: `人脸用户${Date.now().toString().slice(-4)}`,
          balance: 100
        },
        faceInfo: {
          faceId: mockFaceId,
          similarity: 1.0,
          confidence: detectionResult.data.confidence
        },
        isNewUser: true
      }
    });

  } catch (error: any) {
    console.error('❌ 自动注册登录失败:', error);
    
    res.status(500).json({
      success: false,
      message: '自动注册失败，请稍后重试',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

export default router; 