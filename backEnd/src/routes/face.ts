import express, { Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler';
import FaceRecognitionService from '../services/FaceRecognitionService';
import UserAuthService from '../services/UserAuthService';
import { authenticate, logApiAccess } from '../middleware/auth';
import { uploadRateLimit } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

const router = express.Router();

// 人脸识别服务实例
const faceRecognitionService = new FaceRecognitionService();
const userAuthService = new UserAuthService();

// 配置multer用于处理文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // 验证文件类型
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'));
    }
  }
});

// 人脸登录
router.post('/login',
  upload.single('faceImage'),
  logApiAccess,
  uploadRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.body;
    const faceImage = req.file;

    // 严格验证手机号格式
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({
        success: false,
        message: '手机号不能为空'
      });
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: '手机号格式不正确'
      });
    }

    if (!faceImage || !faceImage.buffer) {
      return res.status(400).json({
        success: false,
        message: '人脸图片不能为空'
      });
    }

    // 验证图片大小和格式
    if (faceImage.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: '图片大小不能超过5MB'
      });
    }

    if (!faceImage.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: '只支持图片格式文件'
      });
    }

    try {
      // 记录人脸登录尝试
      logger.info('人脸登录尝试', {
        phone,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        imageSize: faceImage.size,
        timestamp: new Date().toISOString()
      });

      // 首先检查用户是否存在
      const User = (await import('../models/User')).default;
      let user = await User.findOne({ phone });
      let needsRegistration = false;

      if (!user) {
        // 用户不存在，需要先注册
        user = new User({
          phone,
          nickName: `用户${phone.slice(-4)}`,
          balance: 0,
          verificationLevel: 'basic',
          faceEnabled: false,
          status: 'active',
          loginAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        await user.save();
        needsRegistration = true;
        logger.info('人脸登录：自动创建新用户', { phone, userId: user._id });
      }

      if (needsRegistration || !user.faceEnabled) {
        // 需要注册人脸或用户尚未启用人脸认证
        const faceRegisterResult = await faceRecognitionService.registerFace(user._id.toString(), faceImage.buffer);
        
        if (faceRegisterResult.success) {
          // 启用人脸认证
          user.faceEnabled = true;
          user.verificationLevel = 'face_verified';
          await user.save();
          
          logger.info('人脸注册成功', { 
            phone, 
            userId: user._id,
            faceId: faceRegisterResult.data?.faceId 
          });

          // 生成登录token
          const jwt = require('jsonwebtoken');
          const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
          const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
          
          const tokens = {
            token: jwt.sign(
              { userId: user._id.toString(), phone: user.phone },
              JWT_SECRET,
              { expiresIn: '24h' }
            ),
            refreshToken: jwt.sign(
              { userId: user._id.toString(), type: 'refresh' },
              JWT_REFRESH_SECRET,
              { expiresIn: '7d' }
            )
          };

          res.json({
            success: true,
            message: needsRegistration ? '欢迎新用户！人脸注册并登录成功' : '人脸注册并登录成功',
            data: {
              token: tokens.token,
              refreshToken: tokens.refreshToken,
              user: {
                id: user._id.toString(),
                phone: user.phone,
                nickName: user.nickName,
                balance: user.balance || 0,
                verificationLevel: user.verificationLevel,
                faceEnabled: user.faceEnabled,
                hasPassword: !!user.password
              },
              isNewUser: needsRegistration,
              faceRegistered: true
            }
          });
        } else {
          logger.warn('人脸注册失败', { 
            phone, 
            userId: user._id,
            reason: faceRegisterResult.message 
          });
          res.status(400).json({
            success: false,
            message: faceRegisterResult.message || '人脸注册失败，请重试'
          });
        }
      } else {
        // 用户已有人脸认证，直接进行人脸登录
        const loginResult = await userAuthService.login({
          phone,
          faceImage: faceImage.buffer,
          deviceInfo: {
            userAgent: req.get('User-Agent') || 'unknown',
            platform: req.get('X-Platform') || 'web',
            ip: req.ip || 'unknown'
          }
        });

        if (loginResult.success) {
          logger.info('人脸登录成功', { 
            phone, 
            userId: loginResult.data?.user.id,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          res.json(loginResult);
        } else {
          logger.warn('人脸登录失败', { 
            phone, 
            reason: loginResult.message,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          res.status(401).json(loginResult);
        }
      }

    } catch (error: any) {
      logger.error('人脸登录异常', { 
        phone, 
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }, error.stack);
      res.status(500).json({
        success: false,
        message: '人脸登录过程中出现错误，请稍后重试'
      });
    }
  })
);

// 人脸注册
router.post('/register',
  authenticate,
  upload.single('faceImage'),
  logApiAccess,
  uploadRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const faceImage = req.file;

    if (!faceImage) {
      return res.status(400).json({
        success: false,
        message: '人脸图片不能为空'
      });
    }

    try {
      const registerResult = await faceRecognitionService.registerFace(userId, faceImage.buffer);

      if (registerResult.success) {
        // 更新用户的人脸认证状态
        const User = (await import('../models/User')).default;
        await User.findByIdAndUpdate(userId, {
          faceAuthEnabled: true,
          verificationLevel: Math.max(req.user!.verificationLevel || 1, 2)
        });

        logger.info('人脸注册成功', { userId, faceId: registerResult.data?.faceId });
      } else {
        logger.warn('人脸注册失败', { userId, reason: registerResult.message });
      }

      res.json(registerResult);

    } catch (error: any) {
      logger.error('人脸注册异常', { userId, error: error.message }, error.stack);
      res.status(500).json({
        success: false,
        message: '人脸注册过程中出现错误，请稍后重试'
      });
    }
  })
);

// 人脸验证（不登录，只验证）
router.post('/verify',
  authenticate,
  upload.single('faceImage'),
  logApiAccess,
  uploadRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const faceImage = req.file;

    if (!faceImage) {
      return res.status(400).json({
        success: false,
        message: '人脸图片不能为空'
      });
    }

    try {
      const verifyResult = await faceRecognitionService.verifyFace(userId, faceImage.buffer);

      if (verifyResult.success) {
        logger.info('人脸验证成功', { userId, faceId: verifyResult.data?.faceId });
      } else {
        logger.warn('人脸验证失败', { userId, reason: verifyResult.message });
      }

      res.json(verifyResult);

    } catch (error: any) {
      logger.error('人脸验证异常', { userId, error: error.message }, error.stack);
      res.status(500).json({
        success: false,
        message: '人脸验证过程中出现错误，请稍后重试'
      });
    }
  })
);

// 获取用户人脸档案列表
router.get('/profiles',
  authenticate,
  logApiAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();

    try {
      const profilesResult = await faceRecognitionService.getUserFaceProfiles(userId);

      if (profilesResult.success) {
        res.json({
          success: true,
          message: '获取人脸档案成功',
          data: {
            profiles: profilesResult.data || [],
            count: profilesResult.data?.length || 0,
            maxProfiles: 3
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: '获取人脸档案失败'
        });
      }

    } catch (error: any) {
      logger.error('获取人脸档案异常', { userId, error: error.message }, error.stack);
      res.status(500).json({
        success: false,
        message: '获取人脸档案过程中出现错误'
      });
    }
  })
);

// 删除人脸档案
router.delete('/profiles/:faceId',
  authenticate,
  logApiAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const { faceId } = req.params;

    if (!faceId) {
      return res.status(400).json({
        success: false,
        message: '人脸档案ID不能为空'
      });
    }

    try {
      const deleteResult = await faceRecognitionService.deleteFaceProfile(userId, faceId);

      if (deleteResult.success) {
        // 检查是否还有其他人脸档案
        const profilesResult = await faceRecognitionService.getUserFaceProfiles(userId);
        if (profilesResult.success && profilesResult.data?.length === 0) {
          // 如果没有人脸档案了，关闭人脸认证
          const User = (await import('../models/User')).default;
          await User.findByIdAndUpdate(userId, {
            faceAuthEnabled: false,
            verificationLevel: 1
          });
        }

        logger.info('人脸档案删除成功', { userId, faceId });
      } else {
        logger.warn('人脸档案删除失败', { userId, faceId, reason: deleteResult.message });
      }

      res.json(deleteResult);

    } catch (error: any) {
      logger.error('删除人脸档案异常', { userId, faceId, error: error.message }, error.stack);
      res.status(500).json({
        success: false,
        message: '删除人脸档案过程中出现错误'
      });
    }
  })
);

// 人脸识别服务健康检查
router.get('/health',
  logApiAccess,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const healthResult = await faceRecognitionService.healthCheck();
      res.json({
        success: true,
        data: healthResult
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '人脸识别服务健康检查失败',
        error: error.message
      });
    }
  })
);

// 获取人脸识别配置
router.get('/config',
  logApiAccess,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const config = faceRecognitionService.getConfiguration();
      res.json({
        success: true,
        data: config
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: '获取配置失败',
        error: error.message
      });
    }
  })
);

export default router;