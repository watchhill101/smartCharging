import express from 'express';
import { body, validationResult } from 'express-validator';
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
 * 测试充电开始短信
 */
router.post('/test-charging-started', authMiddleware, [
  body('phoneNumber').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user?.id || 'test_user';

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const success = await smsNotificationService.sendChargingStartedSms(
      userId,
      phoneNumber,
      {
        stationName: '测试充电站A',
        estimatedTime: '2小时30分钟'
      }
    );

    res.json({
      success,
      message: success ? '充电开始短信发送成功' : '充电开始短信发送失败',
      data: {
        userId,
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        templateType: 'charging_started'
      }
    });
  } catch (error) {
    console.error('测试充电开始短信失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试充电完成短信
 */
router.post('/test-charging-completed', authMiddleware, [
  body('phoneNumber').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user?.id || 'test_user';

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const success = await smsNotificationService.sendChargingCompletedSms(
      userId,
      phoneNumber,
      {
        chargedAmount: '25.6',
        totalCost: '38.40'
      }
    );

    res.json({
      success,
      message: success ? '充电完成短信发送成功' : '充电完成短信发送失败',
      data: {
        userId,
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        templateType: 'charging_completed'
      }
    });
  } catch (error) {
    console.error('测试充电完成短信失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试充电异常短信
 */
router.post('/test-charging-failed', authMiddleware, [
  body('phoneNumber').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user?.id || 'test_user';

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const success = await smsNotificationService.sendChargingFailedSms(
      userId,
      phoneNumber,
      {
        reason: '充电桩故障',
        servicePhone: '400-000-0000'
      }
    );

    res.json({
      success,
      message: success ? '充电异常短信发送成功' : '充电异常短信发送失败',
      data: {
        userId,
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        templateType: 'charging_failed'
      }
    });
  } catch (error) {
    console.error('测试充电异常短信失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试支付成功短信
 */
router.post('/test-payment-success', authMiddleware, [
  body('phoneNumber').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user?.id || 'test_user';

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const success = await smsNotificationService.sendPaymentSuccessSms(
      userId,
      phoneNumber,
      {
        orderId: 'TEST' + Date.now(),
        amount: '38.40'
      }
    );

    res.json({
      success,
      message: success ? '支付成功短信发送成功' : '支付成功短信发送失败',
      data: {
        userId,
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        templateType: 'payment_success'
      }
    });
  } catch (error) {
    console.error('测试支付成功短信失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试支付失败短信
 */
router.post('/test-payment-failed', authMiddleware, [
  body('phoneNumber').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user?.id || 'test_user';

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const success = await smsNotificationService.sendPaymentFailedSms(
      userId,
      phoneNumber,
      {
        orderId: 'TEST' + Date.now(),
        servicePhone: '400-000-0000'
      }
    );

    res.json({
      success,
      message: success ? '支付失败短信发送成功' : '支付失败短信发送失败',
      data: {
        userId,
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        templateType: 'payment_failed'
      }
    });
  } catch (error) {
    console.error('测试支付失败短信失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试优惠券到账短信
 */
router.post('/test-coupon-received', authMiddleware, [
  body('phoneNumber').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user?.id || 'test_user';

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const success = await smsNotificationService.sendCouponReceivedSms(
      userId,
      phoneNumber,
      {
        couponName: '新用户立减券',
        amount: '10',
        expiryDate: '2024-02-20'
      }
    );

    res.json({
      success,
      message: success ? '优惠券到账短信发送成功' : '优惠券到账短信发送失败',
      data: {
        userId,
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        templateType: 'coupon_received'
      }
    });
  } catch (error) {
    console.error('测试优惠券到账短信失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试优惠券过期提醒短信
 */
router.post('/test-coupon-expiring', authMiddleware, [
  body('phoneNumber').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user?.id || 'test_user';

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const success = await smsNotificationService.sendCouponExpiringSms(
      userId,
      phoneNumber,
      {
        couponName: '新用户立减券',
        days: '3'
      }
    );

    res.json({
      success,
      message: success ? '优惠券过期提醒短信发送成功' : '优惠券过期提醒短信发送失败',
      data: {
        userId,
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        templateType: 'coupon_expiring'
      }
    });
  } catch (error) {
    console.error('测试优惠券过期提醒短信失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试验证码短信
 */
router.post('/test-verification-code', [
  body('phoneNumber').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber } = req.body;

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const success = await smsNotificationService.sendVerificationCodeSms(phoneNumber, code);

    res.json({
      success,
      message: success ? '验证码短信发送成功' : '验证码短信发送失败',
      data: {
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        templateType: 'verification_code',
        code: process.env.NODE_ENV === 'development' ? code : '******' // 开发环境显示验证码
      }
    });
  } catch (error) {
    console.error('测试验证码短信失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试余额不足提醒短信
 */
router.post('/test-balance-low', authMiddleware, [
  body('phoneNumber').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user?.id || 'test_user';

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const success = await smsNotificationService.sendBalanceLowSms(
      userId,
      phoneNumber,
      {
        balance: '5.20'
      }
    );

    res.json({
      success,
      message: success ? '余额不足提醒短信发送成功' : '余额不足提醒短信发送失败',
      data: {
        userId,
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        templateType: 'balance_low'
      }
    });
  } catch (error) {
    console.error('测试余额不足提醒短信失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试系统维护通知短信
 */
router.post('/test-system-maintenance', authMiddleware, [
  body('phoneNumbers').isArray({ min: 1 }).withMessage('手机号列表不能为空'),
  body('phoneNumbers.*').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumbers } = req.body;

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const result = await smsNotificationService.sendSystemMaintenanceSms(
      phoneNumbers,
      {
        startTime: '今晚23:00',
        duration: '2'
      }
    );

    res.json({
      success: result.success > 0,
      message: `系统维护通知发送完成: 成功 ${result.success} 条, 失败 ${result.failed} 条`,
      data: {
        ...result,
        phoneNumbers: phoneNumbers.map((phone: string) => 
          phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
        ),
        templateType: 'system_maintenance'
      }
    });
  } catch (error) {
    console.error('测试系统维护通知短信失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 运行完整短信测试套件
 */
router.post('/run-full-suite', authMiddleware, [
  body('phoneNumber').isMobilePhone('zh-CN').withMessage('手机号格式不正确')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user?.id || 'test_user';

    const smsNotificationService = req.app.locals.smsNotificationService;
    if (!smsNotificationService) {
      return res.status(500).json({
        success: false,
        message: '短信服务未初始化'
      });
    }

    const results = [];
    
    // 测试验证码短信
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationResult = await smsNotificationService.sendVerificationCodeSms(phoneNumber, code);
    results.push({ type: 'verification_code', success: verificationResult });
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试充电开始短信
    const chargingStartResult = await smsNotificationService.sendChargingStartedSms(
      userId, phoneNumber, { stationName: '测试充电站', estimatedTime: '2小时' }
    );
    results.push({ type: 'charging_started', success: chargingStartResult });
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试充电完成短信
    const chargingCompleteResult = await smsNotificationService.sendChargingCompletedSms(
      userId, phoneNumber, { chargedAmount: '25.6', totalCost: '38.40' }
    );
    results.push({ type: 'charging_completed', success: chargingCompleteResult });
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试支付成功短信
    const paymentResult = await smsNotificationService.sendPaymentSuccessSms(
      userId, phoneNumber, { orderId: 'TEST' + Date.now(), amount: '38.40' }
    );
    results.push({ type: 'payment_success', success: paymentResult });
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    res.json({
      success: successCount > 0,
      message: `短信测试套件完成: ${successCount}/${totalCount} 成功`,
      data: {
        userId,
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        results,
        summary: {
          total: totalCount,
          success: successCount,
          failed: totalCount - successCount,
          successRate: ((successCount / totalCount) * 100).toFixed(1) + '%'
        }
      }
    });
  } catch (error) {
    console.error('运行短信测试套件失败:', error);
    res.status(500).json({
      success: false,
      message: '测试套件运行失败'
    });
  }
});

export default router;
