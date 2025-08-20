import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticate as authMiddleware } from '../middleware/auth';

const router = express.Router();

// 验证中间件
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }
  next();
};

/**
 * 发送验证码短信
 */
router.post('/send-verification-code', [
  body('phoneNumber').isMobilePhone('zh-CN').withMessage('手机号格式不正确'),
  body('type').optional().isIn(['login', 'register', 'reset_password']).withMessage('验证码类型无效')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber } = req.body;
    
    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 获取短信服务
    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }
    
    // 发送验证码
    const success = await smsNotificationService.sendVerificationCodeSms(phoneNumber, code);
    
    if (success) {
      // 在实际应用中，应该将验证码存储到Redis中，设置过期时间
      // 这里简化处理，只返回成功状态
      
      res.json({
        success: true,
        message: '验证码发送成功',
        data: {
          phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
          expiresIn: 300 // 5分钟
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: '验证码发送失败'
      });
    }
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '发送验证码失败'
    });
  }
});

/**
 * 获取用户短信偏好设置
 */
router.get('/preferences', authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const preferences = smsNotificationService.getUserPreferences(userId);

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('获取短信偏好设置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取偏好设置失败'
    });
  }
});

/**
 * 更新用户短信偏好设置
 */
router.put('/preferences', authMiddleware, [
  body('config').isObject().withMessage('配置信息格式错误'),
  body('config.enabled').optional().isBoolean(),
  body('config.chargingNotifications').optional().isBoolean(),
  body('config.paymentNotifications').optional().isBoolean(),
  body('config.couponNotifications').optional().isBoolean(),
  body('config.systemNotifications').optional().isBoolean(),
  body('config.verificationCodes').optional().isBoolean(),
  body('phoneNumber').optional().isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const { config, phoneNumber } = req.body;

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const preferences = smsNotificationService.updateUserPreferences(
      userId,
      config,
      phoneNumber
    );

    res.json({
      success: true,
      message: '偏好设置更新成功',
      data: preferences
    });
  } catch (error) {
    console.error('更新短信偏好设置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新偏好设置失败'
    });
  }
});

/**
 * 获取短信模板列表
 */
router.get('/templates', authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const templates = smsNotificationService.getTemplates();

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('获取短信模板失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模板列表失败'
    });
  }
});

/**
 * 获取短信发送历史
 */
router.get('/history', authMiddleware, [
  query('limit').optional().isInt({ min: 1, max: 100 })
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const history = smsNotificationService.getMessageHistory(limit);

    // 过滤敏感信息
    const filteredHistory = history.map((msg: any) => ({
      ...msg,
      phoneNumber: msg.phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    }));

    res.json({
      success: true,
      data: {
        messages: filteredHistory,
        total: filteredHistory.length
      }
    });
  } catch (error) {
    console.error('获取短信历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取发送历史失败'
    });
  }
});

/**
 * 获取短信发送统计
 */
router.get('/statistics', authMiddleware, [
  query('timeRange').optional().isIn(['hour', 'day', 'week', 'month'])
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const timeRange = (req.query.timeRange as 'hour' | 'day' | 'week' | 'month') || 'day';

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const statistics = smsNotificationService.getStatistics(timeRange);

    res.json({
      success: true,
      data: {
        timeRange,
        statistics
      }
    });
  } catch (error) {
    console.error('获取短信统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
});

// 管理员路由

/**
 * 发送自定义短信（管理员）
 */
router.post('/admin/send-custom', authMiddleware, [
  body('phoneNumbers').isArray({ min: 1 }).withMessage('手机号列表不能为空'),
  body('phoneNumbers.*').isMobilePhone('zh-CN').withMessage('手机号格式不正确'),
  body('templateId').notEmpty().withMessage('模板ID不能为空'),
  body('variables').optional().isObject()
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    // 这里应该添加管理员权限验证
    // if (!req.user?.isAdmin) { ... }

    const { phoneNumbers, templateId, variables = {} } = req.body;

    const smsService = req.app.locals.smsService;
    if (!smsService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const messages = phoneNumbers.map((phoneNumber: string) => ({
      phoneNumber,
      templateId,
      variables
    }));

    const results = await smsService.sendBulkSms(messages);
    
    const successCount = results.filter((r: any) => r.success).length;
    const failedCount = results.filter((r: any) => !r.success).length;

    res.json({
      success: true,
      message: `短信发送完成: 成功 ${successCount} 条, 失败 ${failedCount} 条`,
      data: {
        total: results.length,
        success: successCount,
        failed: failedCount,
        results
      }
    });
  } catch (error) {
    console.error('发送自定义短信失败:', error);
    res.status(500).json({
      success: false,
      message: '发送短信失败'
    });
  }
});

/**
 * 发送系统维护通知（管理员）
 */
router.post('/admin/send-maintenance', authMiddleware, [
  body('phoneNumbers').isArray({ min: 1 }).withMessage('手机号列表不能为空'),
  body('phoneNumbers.*').isMobilePhone('zh-CN').withMessage('手机号格式不正确'),
  body('startTime').notEmpty().withMessage('开始时间不能为空'),
  body('duration').notEmpty().withMessage('维护时长不能为空')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumbers, startTime, duration } = req.body;

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const result = await smsNotificationService.sendSystemMaintenanceSms(
      phoneNumbers,
      { startTime, duration }
    );

    res.json({
      success: true,
      message: `系统维护通知发送完成: 成功 ${result.success} 条, 失败 ${result.failed} 条`,
      data: result
    });
  } catch (error) {
    console.error('发送系统维护通知失败:', error);
    res.status(500).json({
      success: false,
      message: '发送维护通知失败'
    });
  }
});

/**
 * 清理短信历史记录（管理员）
 */
router.post('/admin/cleanup-history', authMiddleware, [
  body('daysToKeep').optional().isInt({ min: 1, max: 365 })
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const daysToKeep = req.body.daysToKeep || 30;

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const deletedCount = smsNotificationService.cleanupHistory(daysToKeep);

    res.json({
      success: true,
      message: `历史记录清理完成，删除了 ${deletedCount} 条记录`,
      data: {
        deletedCount,
        daysToKeep
      }
    });
  } catch (error) {
    console.error('清理短信历史失败:', error);
    res.status(500).json({
      success: false,
      message: '清理历史记录失败'
    });
  }
});

export default router;
