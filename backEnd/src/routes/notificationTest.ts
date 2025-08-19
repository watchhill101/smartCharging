import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticate as authMiddleware } from '../middleware/auth';
import { NotificationTestUtil } from '../utils/notificationTest';

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
 * 运行完整测试套件
 */
router.post('/run-full-suite', authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const notificationService = req.app.locals.notificationService;
    if (!notificationService) {
      return res.status(500).json({
        success: false,
        message: '通知服务未初始化'
      });
    }

    const testUtil = new NotificationTestUtil(notificationService);
    
    // 异步运行测试套件
    testUtil.runFullTestSuite(userId).catch(error => {
      console.error('测试套件运行失败:', error);
    });

    res.json({
      success: true,
      message: '测试套件已开始运行，请查看控制台输出和前端通知',
      data: {
        userId,
        testStartTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('启动测试套件失败:', error);
    res.status(500).json({
      success: false,
      message: '启动测试失败'
    });
  }
});

/**
 * 测试充电通知
 */
router.post('/test-charging', authMiddleware, [
  body('userId').optional().isString()
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.body.userId || req.user?.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const notificationService = req.app.locals.notificationService;
    const testUtil = new NotificationTestUtil(notificationService);
    
    await testUtil.testChargingNotifications(userId);

    res.json({
      success: true,
      message: '充电通知测试完成'
    });
  } catch (error) {
    console.error('充电通知测试失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试支付通知
 */
router.post('/test-payment', authMiddleware, [
  body('userId').optional().isString()
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.body.userId || req.user?.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const notificationService = req.app.locals.notificationService;
    const testUtil = new NotificationTestUtil(notificationService);
    
    await testUtil.testPaymentNotifications(userId);

    res.json({
      success: true,
      message: '支付通知测试完成'
    });
  } catch (error) {
    console.error('支付通知测试失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试系统维护通知
 */
router.post('/test-maintenance', authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const notificationService = req.app.locals.notificationService;
    const testUtil = new NotificationTestUtil(notificationService);
    
    await testUtil.testMaintenanceNotification();

    res.json({
      success: true,
      message: '系统维护通知测试完成'
    });
  } catch (error) {
    console.error('系统维护通知测试失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试定时通知
 */
router.post('/test-scheduled', authMiddleware, [
  body('userId').optional().isString(),
  body('delaySeconds').optional().isInt({ min: 1, max: 300 })
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.body.userId || req.user?.id;
    const delaySeconds = req.body.delaySeconds || 30;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const notificationService = req.app.locals.notificationService;
    
    // 创建定时通知
    await notificationService.createNotification({
      userId,
      type: 'system',
      subType: 'test_scheduled',
      title: '定时通知测试',
      content: `这是一条${delaySeconds}秒后发送的定时通知测试`,
      priority: 'medium',
      scheduledAt: new Date(Date.now() + delaySeconds * 1000),
      channels: ['websocket']
    });

    res.json({
      success: true,
      message: `定时通知已创建，将在${delaySeconds}秒后发送`,
      data: {
        userId,
        delaySeconds,
        scheduledAt: new Date(Date.now() + delaySeconds * 1000).toISOString()
      }
    });
  } catch (error) {
    console.error('定时通知测试失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试批量通知
 */
router.post('/test-bulk', authMiddleware, [
  body('userIds').isArray({ min: 1 }).withMessage('用户ID列表不能为空'),
  body('userIds.*').isString().withMessage('用户ID必须是字符串')
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { userIds } = req.body;

    const notificationService = req.app.locals.notificationService;
    const testUtil = new NotificationTestUtil(notificationService);
    
    await testUtil.testBulkNotifications(userIds);

    res.json({
      success: true,
      message: `批量通知测试完成，已向${userIds.length}个用户发送通知`,
      data: {
        userCount: userIds.length,
        userIds
      }
    });
  } catch (error) {
    console.error('批量通知测试失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 测试通知优先级
 */
router.post('/test-priorities', authMiddleware, [
  body('userId').optional().isString()
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.body.userId || req.user?.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const notificationService = req.app.locals.notificationService;
    const testUtil = new NotificationTestUtil(notificationService);
    
    await testUtil.testNotificationPriorities(userId);

    res.json({
      success: true,
      message: '通知优先级测试完成'
    });
  } catch (error) {
    console.error('通知优先级测试失败:', error);
    res.status(500).json({
      success: false,
      message: '测试失败'
    });
  }
});

/**
 * 获取测试统计
 */
router.get('/stats', authMiddleware, [
  query('userId').optional().isString(),
  query('timeRange').optional().isIn(['day', 'week', 'month'])
], handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.query.userId as string || req.user?.id;
    const timeRange = (req.query.timeRange as 'day' | 'week' | 'month') || 'day';
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    const notificationService = req.app.locals.notificationService;
    const testUtil = new NotificationTestUtil(notificationService);
    
    const stats = await notificationService.getNotificationStats(userId, timeRange);

    res.json({
      success: true,
      message: '获取统计信息成功',
      data: {
        userId,
        timeRange,
        stats
      }
    });
  } catch (error) {
    console.error('获取测试统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败'
    });
  }
});

/**
 * 清理测试数据
 */
router.post('/cleanup', authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const notificationService = req.app.locals.notificationService;
    const testUtil = new NotificationTestUtil(notificationService);
    
    await testUtil.cleanupTestData();

    res.json({
      success: true,
      message: '测试数据清理完成'
    });
  } catch (error) {
    console.error('清理测试数据失败:', error);
    res.status(500).json({
      success: false,
      message: '清理失败'
    });
  }
});

/**
 * 获取WebSocket连接状态
 */
router.get('/websocket-status', authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const webSocketService = req.app.locals.webSocketService;
    
    if (!webSocketService) {
      return res.json({
        success: true,
        data: {
          isInitialized: false,
          onlineUsers: 0,
          connections: []
        }
      });
    }

    const onlineUsers = webSocketService.getOnlineUsers();
    const onlineCount = webSocketService.getOnlineUserCount();

    res.json({
      success: true,
      data: {
        isInitialized: true,
        onlineUsers: onlineCount,
        connections: onlineUsers,
        currentUser: req.user?.id,
        isCurrentUserOnline: webSocketService.isUserOnline(req.user?.id)
      }
    });
  } catch (error) {
    console.error('获取WebSocket状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取状态失败'
    });
  }
});

export default router;
