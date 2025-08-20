import express, { Request, Response } from 'express';
import { authenticate as auth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { NotificationService } from '../services/NotificationService';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  userId?: string;
}

// 获取用户通知列表
router.get('/', auth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, status = 'all' } = req.query;
  const userId = req.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: '用户未认证',
      data: null
    });
  }
  
  try {
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    const notifications = await NotificationService.getUserNotifications(userId, {
      page: pageNum,
      limit: limitNum,
      status: status as string
    });
    
    res.json({
      success: true,
      message: '获取通知列表成功',
      data: {
        notifications: notifications.notifications || [],
        total: notifications.total || 0,
        page: pageNum,
        totalPages: Math.ceil((notifications.total || 0) / limitNum),
        unreadCount: notifications.unreadCount || 0
      }
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      errorCode: 'NOTIFICATION_ERROR',
      message: '获取通知列表失败',
      data: null
    });
  }
}));

// 标记通知为已读
router.put('/:notificationId/read', auth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { notificationId } = req.params;
  const userId = req.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: '用户未认证',
      data: null
    });
  }
  
  if (!notificationId) {
    return res.status(400).json({
      success: false,
      errorCode: 'MISSING_NOTIFICATION_ID',
      message: '请提供通知ID',
      data: null
    });
  }
  
  try {
    const result = await NotificationService.markAsRead(notificationId, userId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        errorCode: 'NOTIFICATION_NOT_FOUND',
        message: '通知不存在或无权限',
        data: null
      });
    }
    
    res.json({
      success: true,
      message: '通知已标记为已读',
      data: {
        notificationId,
        readAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      errorCode: 'NOTIFICATION_UPDATE_ERROR',
      message: '标记通知失败',
      data: null
    });
  }
}));

// 批量标记通知为已读
router.put('/batch/read', auth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { notificationIds } = req.body;
  const userId = req.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: '用户未认证',
      data: null
    });
  }
  
  if (!notificationIds || !Array.isArray(notificationIds)) {
    return res.status(400).json({
      success: false,
      errorCode: 'INVALID_NOTIFICATION_IDS',
      message: '请提供有效的通知ID列表',
      data: null
    });
  }
  
  try {
    const result = await NotificationService.markMultipleAsRead(notificationIds, userId);
    
    res.json({
      success: true,
      message: `成功标记 ${result.updated} 条通知为已读`,
      data: {
        updated: result.updated,
        failed: result.failed,
        readAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error batch marking notifications as read:', error);
    res.status(500).json({
      success: false,
      errorCode: 'BATCH_UPDATE_ERROR',
      message: '批量标记通知失败',
      data: null
    });
  }
}));

// 删除通知
router.delete('/:notificationId', auth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { notificationId } = req.params;
  const userId = req.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: '用户未认证',
      data: null
    });
  }
  
  if (!notificationId) {
    return res.status(400).json({
      success: false,
      errorCode: 'MISSING_NOTIFICATION_ID',
      message: '请提供通知ID',
      data: null
    });
  }
  
  try {
    const result = await NotificationService.deleteNotification(notificationId, userId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        errorCode: 'NOTIFICATION_NOT_FOUND',
        message: '通知不存在或无权限',
        data: null
      });
    }
    
    res.json({
      success: true,
      message: '通知删除成功',
      data: {
        notificationId,
        deletedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      errorCode: 'NOTIFICATION_DELETE_ERROR',
      message: '删除通知失败',
      data: null
    });
  }
}));

// 获取未读通知数量
router.get('/unread/count', auth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: '用户未认证',
      data: null
    });
  }
  
  try {
    const count = await NotificationService.getUnreadCount(userId);
    
    res.json({
      success: true,
      message: '获取未读通知数量成功',
      data: {
        unreadCount: count || 0
      }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      errorCode: 'UNREAD_COUNT_ERROR',
      message: '获取未读通知数量失败',
      data: null
    });
  }
}));

export default router;
