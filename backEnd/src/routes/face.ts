import express, { Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler';
import { FaceRecognitionService } from '../services/FaceRecognitionService';
import FaceProfile from '../models/FaceProfile';
import FaceLoginRecord from '../models/FaceLoginRecord';
import {
  authenticateToken,
  userRateLimit,
  requireOwnership,
  logApiAccess
} from '../middleware/auth';

const router = express.Router();

// 人脸识别服务实例
const faceRecognitionService = new FaceRecognitionService();

// 配置multer用于处理人脸图片上传
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

// 人脸检测
router.post('/detect',
  upload.single('image'),
  authenticateToken,
  logApiAccess,
  userRateLimit(10, 60000), // 每分钟最多10次检测
  asyncHandler(async (req: Request, res: Response) => {
    console.log('🔍 收到人脸检测请求');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传人脸图片'
      });
    }

    try {
      const result = await faceRecognitionService.detectFace(req.file.buffer);

      res.json({
        success: result.success,
        message: result.message,
        data: result.data
      });

    } catch (error) {
      console.error('❌ 人脸检测失败:', error);
      res.status(500).json({
        success: false,
        message: '人脸检测服务暂时不可用'
      });
    }
  })
);

// 活体检测
router.post('/liveness',
  upload.single('image'),
  authenticateToken,
  logApiAccess,
  userRateLimit(5, 60000), // 每分钟最多5次活体检测
  asyncHandler(async (req: Request, res: Response) => {
    console.log('👁️ 收到活体检测请求');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传人脸图片'
      });
    }

    const { actions } = req.body;
    const actionList = actions ? JSON.parse(actions) : undefined;

    try {
      const result = await faceRecognitionService.detectLiveness(req.file.buffer, actionList);

      res.json({
        success: result.success,
        message: result.message,
        data: result.data
      });

    } catch (error) {
      console.error('❌ 活体检测失败:', error);
      res.status(500).json({
        success: false,
        message: '活体检测服务暂时不可用'
      });
    }
  })
);

// 注册人脸档案
router.post('/register',
  upload.single('image'),
  authenticateToken,
  logApiAccess,
  userRateLimit(3, 60000), // 每分钟最多3次注册
  asyncHandler(async (req: Request, res: Response) => {
    console.log('📝 收到人脸注册请求');
    const userId = req.user!.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传人脸图片'
      });
    }

    try {
      // 检查用户人脸档案数量限制
      const isLimitReached = await FaceProfile.checkProfileLimit(userId, 3);
      if (isLimitReached) {
        return res.status(400).json({
          success: false,
          message: '人脸档案数量已达上限（最多3个）'
        });
      }

      // 检测人脸
      const detectionResult = await faceRecognitionService.detectFace(req.file.buffer);
      if (!detectionResult.success || !detectionResult.data?.faceDetected) {
        return res.status(400).json({
          success: false,
          message: detectionResult.message || '未检测到人脸'
        });
      }

      const { features, confidence } = detectionResult.data;
      if (!features || confidence < 0.7) {
        return res.status(400).json({
          success: false,
          message: '人脸质量不佳，请重新拍摄'
        });
      }

      // 检查是否已存在相似的人脸档案
      const existingProfiles = await FaceProfile.getActiveProfiles(userId);
      for (const profile of existingProfiles) {
        const comparisonResult = await faceRecognitionService.compareFaces(
          features.encoding,
          profile.features.encoding
        );

        if (comparisonResult.success && comparisonResult.data?.similarity > 0.9) {
          return res.status(400).json({
            success: false,
            message: '检测到相似的人脸档案已存在'
          });
        }
      }

      // 创建人脸档案
      const faceId = faceRecognitionService.generateFaceId();
      const deviceInfo = {
        userAgent: req.get('User-Agent') || 'unknown',
        platform: req.get('X-Platform') || 'unknown',
        ip: req.ip || req.socket.remoteAddress || 'unknown'
      };

      const faceProfile = new FaceProfile({
        userId,
        faceId,
        features: {
          encoding: features.encoding,
          landmarks: features.landmarks,
          confidence
        },
        deviceInfo,
        isActive: true
      });

      await faceProfile.save();

      console.log('✅ 人脸档案注册成功:', faceId);

      res.json({
        success: true,
        message: '人脸档案注册成功',
        data: {
          faceId,
          confidence,
          profileCount: existingProfiles.length + 1
        }
      });

    } catch (error) {
      console.error('❌ 人脸注册失败:', error);
      res.status(500).json({
        success: false,
        message: '人脸注册过程中出现错误'
      });
    }
  })
);

// 人脸验证
router.post('/verify',
  upload.single('image'),
  authenticateToken,
  logApiAccess,
  userRateLimit(20, 60000), // 每分钟最多20次验证
  asyncHandler(async (req: Request, res: Response) => {
    console.log('🔐 收到人脸验证请求');
    const userId = req.user!.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传人脸图片'
      });
    }

    const startTime = Date.now();

    try {
      // 检测人脸
      const detectionResult = await faceRecognitionService.detectFace(req.file.buffer);
      if (!detectionResult.success || !detectionResult.data?.faceDetected) {
        await FaceLoginRecord.create({
          userId,
          faceId: 'unknown',
          success: false,
          confidence: 0,
          loginAt: new Date(),
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          deviceInfo: {
            platform: req.get('X-Platform') || 'unknown',
            browser: 'unknown',
            version: 'unknown'
          },
          failureReason: 'face_not_detected',
          processingTime: Date.now() - startTime
        });

        return res.status(400).json({
          success: false,
          message: detectionResult.message || '未检测到人脸'
        });
      }

      const { features, confidence } = detectionResult.data;
      if (!features || confidence < 0.6) {
        await FaceLoginRecord.create({
          userId,
          faceId: 'unknown',
          success: false,
          confidence,
          loginAt: new Date(),
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          deviceInfo: {
            platform: req.get('X-Platform') || 'unknown',
            browser: 'unknown',
            version: 'unknown'
          },
          failureReason: 'low_confidence',
          processingTime: Date.now() - startTime
        });

        return res.status(400).json({
          success: false,
          message: '人脸质量不佳，请重新拍摄'
        });
      }

      // 查找匹配的人脸档案
      const faceProfiles = await FaceProfile.getActiveProfiles(userId);
      if (faceProfiles.length === 0) {
        await FaceLoginRecord.create({
          userId,
          faceId: 'unknown',
          success: false,
          confidence,
          loginAt: new Date(),
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          deviceInfo: {
            platform: req.get('X-Platform') || 'unknown',
            browser: 'unknown',
            version: 'unknown'
          },
          failureReason: 'no_matching_profile',
          processingTime: Date.now() - startTime
        });

        return res.status(400).json({
          success: false,
          message: '未找到人脸档案，请先注册'
        });
      }

      let bestMatch: { profile: any; similarity: number } | null = null;

      for (const profile of faceProfiles) {
        const comparisonResult = await faceRecognitionService.compareFaces(
          features.encoding,
          profile.features.encoding
        );

        if (comparisonResult.success && comparisonResult.data?.isMatch) {
          if (!bestMatch || comparisonResult.data.similarity > bestMatch.similarity) {
            bestMatch = {
              profile,
              similarity: comparisonResult.data.similarity
            };
          }
        }
      }

      if (!bestMatch) {
        await FaceLoginRecord.create({
          userId,
          faceId: 'unknown',
          success: false,
          confidence,
          loginAt: new Date(),
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          deviceInfo: {
            platform: req.get('X-Platform') || 'unknown',
            browser: 'unknown',
            version: 'unknown'
          },
          failureReason: 'no_matching_profile',
          processingTime: Date.now() - startTime
        });

        return res.status(400).json({
          success: false,
          message: '人脸验证失败，未找到匹配的档案'
        });
      }

      // 更新人脸档案使用记录
      await bestMatch.profile.updateLastUsed();

      // 记录成功的验证
      await FaceLoginRecord.create({
        userId,
        faceId: bestMatch.profile.faceId,
        success: true,
        confidence,
        loginAt: new Date(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        deviceInfo: {
          platform: req.get('X-Platform') || 'unknown',
          browser: 'unknown',
          version: 'unknown'
        },
        livenessScore: detectionResult.data.livenessScore,
        processingTime: Date.now() - startTime
      });

      console.log('✅ 人脸验证成功:', bestMatch.profile.faceId);

      res.json({
        success: true,
        message: '人脸验证成功',
        data: {
          faceId: bestMatch.profile.faceId,
          similarity: bestMatch.similarity,
          confidence,
          processingTime: Date.now() - startTime
        }
      });

    } catch (error) {
      console.error('❌ 人脸验证失败:', error);
      res.status(500).json({
        success: false,
        message: '人脸验证过程中出现错误'
      });
    }
  })
);

// 获取用户人脸档案列表
router.get('/profiles',
  authenticateToken,
  logApiAccess,
  asyncHandler(async (req: Request, res: Response) => {
    console.log('📋 收到获取人脸档案列表请求');
    const userId = req.user!.userId;

    try {
      const profiles = await FaceProfile.getActiveProfiles(userId);

      const profileList = profiles.map(profile => ({
        faceId: profile.faceId,
        confidence: profile.features.confidence,
        createdAt: profile.createdAt,
        lastUsedAt: profile.lastUsedAt,
        usageCount: profile.usageCount,
        deviceInfo: {
          platform: profile.deviceInfo.platform,
          ip: profile.deviceInfo.ip
        }
      }));

      res.json({
        success: true,
        message: '获取人脸档案列表成功',
        data: {
          profiles: profileList,
          total: profileList.length,
          maxProfiles: 3
        }
      });

    } catch (error) {
      console.error('❌ 获取人脸档案列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取人脸档案列表失败'
      });
    }
  })
);

// 删除人脸档案
router.delete('/profiles/:faceId',
  authenticateToken,
  logApiAccess,
  userRateLimit(5, 60000), // 每分钟最多5次删除
  asyncHandler(async (req: Request, res: Response) => {
    console.log('🗑️ 收到删除人脸档案请求');
    const userId = req.user!.userId;
    const { faceId } = req.params;

    try {
      const profile = await FaceProfile.findOne({
        userId,
        faceId,
        isActive: true
      });

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: '人脸档案不存在'
        });
      }

      await profile.deactivate();

      console.log('✅ 人脸档案删除成功:', faceId);

      res.json({
        success: true,
        message: '人脸档案删除成功'
      });

    } catch (error) {
      console.error('❌ 删除人脸档案失败:', error);
      res.status(500).json({
        success: false,
        message: '删除人脸档案失败'
      });
    }
  })
);

// 获取人脸登录历史
router.get('/login-history',
  authenticateToken,
  logApiAccess,
  requireOwnership('userId'),
  asyncHandler(async (req: Request, res: Response) => {
    console.log('📊 收到获取人脸登录历史请求');
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;

    try {
      const history = await FaceLoginRecord.getLoginHistory(userId, limit);

      res.json({
        success: true,
        message: '获取人脸登录历史成功',
        data: {
          history,
          total: history.length
        }
      });

    } catch (error) {
      console.error('❌ 获取人脸登录历史失败:', error);
      res.status(500).json({
        success: false,
        message: '获取人脸登录历史失败'
      });
    }
  })
);

// 获取人脸验证统计
router.get('/stats',
  authenticateToken,
  logApiAccess,
  asyncHandler(async (req: Request, res: Response) => {
    console.log('📈 收到获取人脸验证统计请求');
    const userId = req.user!.userId;
    const hours = parseInt(req.query.hours as string) || 24;

    try {
      const stats = await FaceLoginRecord.getFailureStats(userId, hours);
      const securityReport = await FaceLoginRecord.getSecurityReport(userId, 7); // 7天安全报告

      res.json({
        success: true,
        message: '获取人脸验证统计成功',
        data: {
          recentStats: stats,
          securityReport,
          timeRange: `${hours}小时`
        }
      });

    } catch (error) {
      console.error('❌ 获取人脸验证统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取人脸验证统计失败'
      });
    }
  })
);

// 获取服务配置
router.get('/config',
  logApiAccess,
  asyncHandler(async (req: Request, res: Response) => {
    console.log('⚙️ 收到获取服务配置请求');

    try {
      const config = faceRecognitionService.getConfiguration();

      res.json({
        success: true,
        message: '获取服务配置成功',
        data: config
      });

    } catch (error) {
      console.error('❌ 获取服务配置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取服务配置失败'
      });
    }
  })
);

// 健康检查
router.get('/health',
  logApiAccess,
  asyncHandler(async (req: Request, res: Response) => {
    console.log('🏥 收到健康检查请求');

    try {
      const health = await faceRecognitionService.healthCheck();

      res.json({
        success: true,
        message: '健康检查完成',
        data: health
      });

    } catch (error) {
      console.error('❌ 健康检查失败:', error);
      res.status(500).json({
        success: false,
        message: '健康检查失败'
      });
    }
  })
);

export default router;