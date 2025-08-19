import { Router } from 'express';
import multer from 'multer';
import { QRCodeService } from '../services/QRCodeService';
import { RedisService } from '../services/RedisService';
import { authenticate as authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const redisService = new RedisService();
const qrCodeService = new QRCodeService(redisService);

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'));
    }
  }
});

/**
 * 生成二维码
 * POST /api/qrcode/generate
 */
router.post('/generate',
  authMiddleware,
  [
    body('data').notEmpty().withMessage('二维码数据不能为空'),
    body('size').optional().isInt({ min: 50, max: 1000 }).withMessage('尺寸必须在50-1000之间'),
    body('errorCorrectionLevel').optional().isIn(['L', 'M', 'Q', 'H']).withMessage('容错级别无效'),
    body('margin').optional().isInt({ min: 0, max: 10 }).withMessage('边距必须在0-10之间')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        data,
        size,
        errorCorrectionLevel,
        margin,
        color,
        logo
      } = req.body;

      const result = await qrCodeService.generateQRCode({
        data,
        size,
        errorCorrectionLevel,
        margin,
        color,
        logo
      });

      res.json({
        success: true,
        data: result,
        message: '二维码生成成功'
      });

    } catch (error) {
      console.error('❌ 生成二维码失败:', error);
      res.status(500).json({
        success: false,
        message: '生成二维码失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
);

/**
 * 扫描二维码（上传图片）
 * POST /api/qrcode/scan
 */
router.post('/scan',
  authMiddleware,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传图片文件'
        });
      }

      // 将图片转换为base64
      const imageBase64 = req.file.buffer.toString('base64');
      const imageData = `data:${req.file.mimetype};base64,${imageBase64}`;

      const result = await qrCodeService.scanQRCode({
        imageData,
        format: 'base64'
      });

      if (result.success) {
        res.json({
          success: true,
          data: {
            content: result.data,
            format: result.format,
            location: result.location
          },
          message: '扫描成功'
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || '扫描失败'
        });
      }

    } catch (error) {
      console.error('❌ 扫描二维码失败:', error);
      res.status(500).json({
        success: false,
        message: '扫描二维码失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
);

/**
 * 验证二维码
 * POST /api/qrcode/validate
 */
router.post('/validate',
  authMiddleware,
  [
    body('qrCodeId').notEmpty().withMessage('二维码ID不能为空'),
    body('data').notEmpty().withMessage('二维码数据不能为空'),
    body('scanLocation').optional().isObject().withMessage('扫描位置格式错误'),
    body('deviceInfo').optional().isObject().withMessage('设备信息格式错误')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        qrCodeId,
        data,
        scanLocation,
        deviceInfo
      } = req.body;

      const result = await qrCodeService.validateQRCode({
        qrCodeId,
        data,
        scanLocation,
        deviceInfo
      });

      if (result.valid) {
        res.json({
          success: true,
          data: {
            valid: result.valid,
            data: result.data,
            expireTime: result.expireTime
          },
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }

    } catch (error) {
      console.error('❌ 验证二维码失败:', error);
      res.status(500).json({
        success: false,
        message: '验证二维码失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
);

/**
 * 生成充电桩二维码
 * POST /api/qrcode/charging-pile
 */
router.post('/charging-pile',
  authMiddleware,
  [
    body('pileId').notEmpty().withMessage('充电桩ID不能为空'),
    body('stationId').notEmpty().withMessage('充电站ID不能为空'),
    body('pileNumber').notEmpty().withMessage('充电桩编号不能为空'),
    body('operatorId').notEmpty().withMessage('运营商ID不能为空')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        pileId,
        stationId,
        pileNumber,
        operatorId
      } = req.body;

      const result = await qrCodeService.generateChargingPileQR(
        pileId,
        stationId,
        pileNumber,
        operatorId
      );

      res.json({
        success: true,
        data: result,
        message: '充电桩二维码生成成功'
      });

    } catch (error) {
      console.error('❌ 生成充电桩二维码失败:', error);
      res.status(500).json({
        success: false,
        message: '生成充电桩二维码失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
);

/**
 * 验证充电桩二维码
 * POST /api/qrcode/charging-pile/validate
 */
router.post('/charging-pile/validate',
  authMiddleware,
  [
    body('qrData').notEmpty().withMessage('二维码数据不能为空')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { qrData } = req.body;

      const result = await qrCodeService.validateChargingPileQR(qrData);

      if (result.valid) {
        res.json({
          success: true,
          data: {
            valid: result.valid,
            pileInfo: result.pileInfo
          },
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }

    } catch (error) {
      console.error('❌ 验证充电桩二维码失败:', error);
      res.status(500).json({
        success: false,
        message: '验证充电桩二维码失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
);

/**
 * 批量生成充电桩二维码
 * POST /api/qrcode/charging-pile/batch
 */
router.post('/charging-pile/batch',
  authMiddleware,
  [
    body('piles').isArray({ min: 1, max: 100 }).withMessage('充电桩列表必须是1-100个元素的数组'),
    body('piles.*.pileId').notEmpty().withMessage('充电桩ID不能为空'),
    body('piles.*.stationId').notEmpty().withMessage('充电站ID不能为空'),
    body('piles.*.pileNumber').notEmpty().withMessage('充电桩编号不能为空'),
    body('piles.*.operatorId').notEmpty().withMessage('运营商ID不能为空')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { piles } = req.body;

      const results = await qrCodeService.batchGenerateChargingPileQR(piles);

      res.json({
        success: true,
        data: {
          qrCodes: results,
          total: results.length
        },
        message: `批量生成${results.length}个充电桩二维码成功`
      });

    } catch (error) {
      console.error('❌ 批量生成充电桩二维码失败:', error);
      res.status(500).json({
        success: false,
        message: '批量生成充电桩二维码失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
);

/**
 * 获取二维码统计信息
 * GET /api/qrcode/:qrCodeId/stats
 */
router.get('/:qrCodeId/stats',
  authMiddleware,
  [
    param('qrCodeId').notEmpty().withMessage('二维码ID不能为空')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { qrCodeId } = req.params;

      const stats = await qrCodeService.getQRCodeStats(qrCodeId);

      if (stats) {
        res.json({
          success: true,
          data: stats,
          message: '获取统计信息成功'
        });
      } else {
        res.status(404).json({
          success: false,
          message: '二维码不存在'
        });
      }

    } catch (error) {
      console.error('❌ 获取二维码统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
);

/**
 * 清理过期二维码
 * POST /api/qrcode/cleanup
 */
router.post('/cleanup',
  authMiddleware,
  async (req, res) => {
    try {
      const cleanedCount = await qrCodeService.cleanupExpiredQRCodes();

      res.json({
        success: true,
        data: {
          cleanedCount
        },
        message: `清理了${cleanedCount}个过期二维码`
      });

    } catch (error) {
      console.error('❌ 清理过期二维码失败:', error);
      res.status(500).json({
        success: false,
        message: '清理过期二维码失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
);

export default router;