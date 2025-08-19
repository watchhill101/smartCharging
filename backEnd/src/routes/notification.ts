import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { NotificationService } from '../services/NotificationService';
import { RedisService } from '../services/RedisService';
import { authenticate as authMiddleware } from '../middleware/auth';

const router = express.Router();

// 初始化服务
const redisService = new RedisService({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

const notificationService = new NotificationService(redisService);

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
 * 获取用户通知列表
 */
router.get('/list', authMiddleware, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('unreadOnly').optional().isBoolean()
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const { page, limit, unreadOnly } = req.query;
    
    const result = await notificationService.getUserNotifications(
      userId,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20,
      unreadOnly === 'true'
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取通知列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取通知列表失败'
    });
  }
});

/**
 * 获取未读通知数量
 */
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('获取未读数量失败:', error);
    res.status(500).json({
      success: false,
      message: '获取未读数量失败'
    });
  }
});

/**
 * 标记通知为已读
 */
router.put('/read/:notificationId', authMiddleware, [
  param('notificationId').notEmpty().withMessage('通知ID不能为空')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const { notificationId } = req.params;
    
    await notificationService.markAsRead(userId, notificationId);

    res.json({
      success: true,
      message: '通知已标记为已读'
    });
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '标记已读失败'
    });
  }
});

/**
 * 标记所有通知为已读
 */
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: '所有通知已标记为已读'
    });
  } catch (error) {
    console.error('批量标记已读失败:', error);
    res.status(500).json({
      success: false,
      message: '批量标记已读失败'
    });
  }
});

/**
 * 删除通知
 */
router.delete('/:notificationId', authMiddleware, [
  param('notificationId').notEmpty().withMessage('通知ID不能为空')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const { notificationId } = req.params;
    
    await notificationService.deleteNotification(userId, notificationId);

    res.json({
      success: true,
      message: '通知已删除'
    });
  } catch (error) {
    console.error('删除通知失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '删除通知失败'
    });
  }
});

/**
 * 获取通知统计信息
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const stats = await notificationService.getNotificationStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取通知统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败'
    });
  }
});

// 管理员接口

/**
 * 发送通知给指定用户（管理员）
 */
router.post('/admin/send', authMiddleware, [
  body('userId').notEmpty().withMessage('用户ID不能为空'),
  body('type').notEmpty().withMessage('通知类型不能为空'),
  body('title').optional().isString(),
  body('content').optional().isString(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('channels').optional().isArray()
], handleValidationErrors, async (req, res) => {
  try {
    // 这里应该检查管理员权限
    const { userId, type, title, content, priority, channels, data } = req.body;
    
    const notification = await notificationService.sendNotification(userId, type, {
      title,
      content,
      priority,
      channels,
      data
    });

    res.status(201).json({
      success: true,
      message: '通知发送成功',
      data: notification
    });
  } catch (error) {
    console.error('发送通知失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '发送通知失败'
    });
  }
});

/**
 * 批量发送通知（管理员）
 */
router.post('/admin/send-bulk', authMiddleware, [
  body('userIds').isArray({ min: 1 }).withMessage('用户ID列表不能为空'),
  body('type').notEmpty().withMessage('通知类型不能为空'),
  body('title').optional().isString(),
  body('content').optional().isString(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('channels').optional().isArray()
], handleValidationErrors, async (req, res) => {
  try {
    const { userIds, type, title, content, priority, channels, data } = req.body;
    
    const notifications = await notificationService.sendBulkNotification(userIds, type, {
      title,
      content,
      priority,
      channels,
      data
    });

    res.status(201).json({
      success: true,
      message: `批量通知发送完成，成功 ${notifications.length} 个`,
      data: {
        total: userIds.length,
        success: notifications.length,
        failed: userIds.length - notifications.length
      }
    });
  } catch (error) {
    console.error('批量发送通知失败:', error);
    res.status(500).json({
      success: false,
      message: '批量发送通知失败'
    });
  }
});

/**
 * 发送系统广播通知（管理员）
 */
router.post('/admin/broadcast', authMiddleware, [
  body('type').notEmpty().withMessage('通知类型不能为空'),
  body('title').optional().isString(),
  body('content').optional().isString(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], handleValidationErrors, async (req, res) => {
  try {
    const { type, title, content, priority, data } = req.body;
    
    await notificationService.sendSystemBroadcast(type, {
      title,
      content,
      priority,
      data
    });

    res.json({
      success: true,
      message: '系统广播发送成功'
    });
  } catch (error) {
    console.error('发送系统广播失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '发送系统广播失败'
    });
  }
});

/**
 * 清理过期通知（管理员）
 */
router.post('/admin/cleanup', authMiddleware, async (req, res) => {
  try {
    const result = await notificationService.cleanupExpiredNotifications();

    res.json({
      success: true,
      message: `清理完成，共处理 ${result.cleaned} 条过期通知`,
      data: result
    });
  } catch (error) {
    console.error('清理过期通知失败:', error);
    res.status(500).json({
      success: false,
      message: '清理过期通知失败'
    });
  }
});

export default router;