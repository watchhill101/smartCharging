import { Notification, INotification } from '../models/Notification';
import { RedisService } from './RedisService';
import { NotificationWebSocketService, NotificationMessage } from './NotificationWebSocketService';

export interface CreateNotificationData {
  userId: string;
  type: 'charging' | 'payment' | 'system' | 'coupon' | 'maintenance';
  subType: string;
  title: string;
  content: string;
  data?: any;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  channels?: ('websocket' | 'push' | 'sms' | 'email')[];
  scheduledAt?: Date;
  expiresAt?: Date;
}

export interface NotificationQuery {
  userId?: string;
  type?: string;
  subType?: string;
  isRead?: boolean;
  priority?: string;
  page?: number;
  limit?: number;
}

export class NotificationService {
  private redisService: RedisService;
  private webSocketService?: NotificationWebSocketService;

  constructor(redisService: RedisService, webSocketService?: NotificationWebSocketService) {
    this.redisService = redisService;
    this.webSocketService = webSocketService;
  }

  /**
   * 设置WebSocket服务
   */
  setWebSocketService(webSocketService: NotificationWebSocketService): void {
    this.webSocketService = webSocketService;
  }

  /**
   * 创建通知
   */
  async createNotification(data: CreateNotificationData): Promise<INotification> {
    try {
      const notification = new Notification({
        ...data,
        priority: data.priority || 'medium',
        channels: data.channels || ['websocket'],
        isRead: false
      });

      const savedNotification = await notification.save();

      // 立即发送通知（如果不是定时通知）
      if (!data.scheduledAt) {
        await this.sendNotification(savedNotification);
      }

      return savedNotification;
    } catch (error) {
      console.error('创建通知失败:', error);
      throw new Error('创建通知失败');
    }
  }

  /**
   * 发送通知
   */
  async sendNotification(notification: INotification): Promise<void> {
    try {
      const notificationMessage: NotificationMessage = {
        id: notification._id.toString(),
        userId: notification.userId,
        type: notification.type,
        subType: notification.subType,
        title: notification.title,
        content: notification.content,
        data: notification.data,
        priority: notification.priority,
        timestamp: new Date()
      };

      // 通过WebSocket发送
      if (notification.channels.includes('websocket') && this.webSocketService) {
        await this.webSocketService.sendNotificationToUser(
          notification.userId,
          notificationMessage
        );
      }

      // 更新发送时间
      await Notification.updateOne(
        { _id: notification._id },
        { sentAt: new Date() }
      );

      console.log(`通知已发送给用户 ${notification.userId}: ${notification.title}`);
    } catch (error) {
      console.error('发送通知失败:', error);
      throw error;
    }
  }

  /**
   * 批量创建通知
   */
  async createBulkNotifications(notifications: CreateNotificationData[]): Promise<INotification[]> {
    try {
      const createdNotifications = await Notification.insertMany(
        notifications.map(data => ({
          ...data,
          priority: data.priority || 'medium',
          channels: data.channels || ['websocket'],
          isRead: false
        }))
      );

      // 发送非定时通知
      const immediateNotifications = createdNotifications.filter(n => !n.scheduledAt);
      for (const notification of immediateNotifications) {
        await this.sendNotification(notification);
      }

      return createdNotifications;
    } catch (error) {
      console.error('批量创建通知失败:', error);
      throw new Error('批量创建通知失败');
    }
  }

  /**
   * 获取用户通知列表
   */
  async getUserNotifications(query: NotificationQuery): Promise<{
    notifications: INotification[];
    total: number;
    page: number;
    totalPages: number;
    unreadCount: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const filter: any = {};
      if (query.userId) filter.userId = query.userId;
      if (query.type) filter.type = query.type;
      if (query.subType) filter.subType = query.subType;
      if (query.isRead !== undefined) filter.isRead = query.isRead;
      if (query.priority) filter.priority = query.priority;

      // 排除已过期的通知
      filter.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: new Date() } }
      ];

      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter)
          .sort({ priority: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Notification.countDocuments(filter),
        query.userId ? Notification.countDocuments({
          userId: query.userId,
          isRead: false,
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gte: new Date() } }
          ]
        }) : 0
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        notifications: notifications as INotification[],
        total,
        page,
        totalPages,
        unreadCount
      };
    } catch (error) {
      console.error('获取用户通知失败:', error);
      throw new Error('获取通知列表失败');
    }
  }

  /**
   * 标记通知为已读
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await Notification.updateOne(
        { _id: notificationId, userId, isRead: false },
        { 
          isRead: true,
          readAt: new Date()
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('标记通知已读失败:', error);
      throw new Error('标记通知已读失败');
    }
  }

  /**
   * 批量标记通知为已读
   */
  async markNotificationsAsRead(notificationIds: string[], userId: string): Promise<number> {
    try {
      const result = await Notification.updateMany(
        { 
          _id: { $in: notificationIds },
          userId,
          isRead: false
        },
        { 
          isRead: true,
          readAt: new Date()
        }
      );

      return result.modifiedCount;
    } catch (error) {
      console.error('批量标记通知已读失败:', error);
      throw new Error('批量标记通知已读失败');
    }
  }

  /**
   * 标记所有通知为已读
   */
  async markAllNotificationsAsRead(userId: string): Promise<number> {
    try {
      const result = await Notification.updateMany(
        { userId, isRead: false },
        { 
          isRead: true,
          readAt: new Date()
        }
      );

      return result.modifiedCount;
    } catch (error) {
      console.error('标记所有通知已读失败:', error);
      throw new Error('标记所有通知已读失败');
    }
  }

  /**
   * 删除通知
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await Notification.deleteOne({
        _id: notificationId,
        userId
      });

      return result.deletedCount > 0;
    } catch (error) {
      console.error('删除通知失败:', error);
      throw new Error('删除通知失败');
    }
  }

  /**
   * 清理过期通知
   */
  async cleanupExpiredNotifications(): Promise<{ deleted: number }> {
    try {
      const result = await Notification.deleteMany({
        expiresAt: { $lt: new Date() }
      });

      console.log(`清理过期通知: ${result.deletedCount} 条`);
      
      return { deleted: result.deletedCount };
    } catch (error) {
      console.error('清理过期通知失败:', error);
      throw new Error('清理过期通知失败');
    }
  }

  /**
   * 处理定时通知
   */
  async processScheduledNotifications(): Promise<void> {
    try {
      const now = new Date();
      
      const scheduledNotifications = await Notification.find({
        scheduledAt: { $lte: now },
        sentAt: { $exists: false }
      });

      for (const notification of scheduledNotifications) {
        await this.sendNotification(notification);
      }

      console.log(`处理定时通知: ${scheduledNotifications.length} 条`);
    } catch (error) {
      console.error('处理定时通知失败:', error);
    }
  }

  /**
   * 获取通知统计
   */
  async getNotificationStats(userId?: string, timeRange: 'day' | 'week' | 'month' = 'week'): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const filter: any = {
        createdAt: { $gte: startDate }
      };
      if (userId) filter.userId = userId;

      const [total, unread, byType, byPriority] = await Promise.all([
        Notification.countDocuments(filter),
        Notification.countDocuments({ ...filter, isRead: false }),
        Notification.aggregate([
          { $match: filter },
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]),
        Notification.aggregate([
          { $match: filter },
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ])
      ]);

      return {
        total,
        unread,
        byType: byType.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        byPriority: byPriority.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {})
      };
    } catch (error) {
      console.error('获取通知统计失败:', error);
      throw new Error('获取统计数据失败');
    }
  }

  /**
   * 创建充电状态通知
   */
  async createChargingNotification(
    userId: string,
    subType: 'started' | 'completed' | 'failed' | 'interrupted',
    data: any
  ): Promise<INotification> {
    const titles = {
      started: '充电已开始',
      completed: '充电已完成',
      failed: '充电失败',
      interrupted: '充电中断'
    };

    const contents = {
      started: `您的充电会话已开始，预计充电时间 ${data.estimatedTime || '未知'}`,
      completed: `充电完成！本次充电 ${data.chargedAmount || 0}kWh，费用 ¥${data.totalCost || 0}`,
      failed: `充电启动失败：${data.reason || '未知原因'}，请重试或联系客服`,
      interrupted: `充电意外中断：${data.reason || '未知原因'}，已为您保存充电记录`
    };

    return this.createNotification({
      userId,
      type: 'charging',
      subType,
      title: titles[subType],
      content: contents[subType],
      data,
      priority: subType === 'failed' ? 'high' : 'medium',
      channels: ['websocket']
    });
  }

  /**
   * 创建支付通知
   */
  async createPaymentNotification(
    userId: string,
    subType: 'success' | 'failed' | 'refund',
    data: any
  ): Promise<INotification> {
    const titles = {
      success: '支付成功',
      failed: '支付失败',
      refund: '退款到账'
    };

    const contents = {
      success: `支付成功！金额 ¥${data.amount || 0}，订单号 ${data.orderId || ''}`,
      failed: `支付失败：${data.reason || '未知原因'}，请重试`,
      refund: `退款 ¥${data.amount || 0} 已到账，订单号 ${data.orderId || ''}`
    };

    return this.createNotification({
      userId,
      type: 'payment',
      subType,
      title: titles[subType],
      content: contents[subType],
      data,
      priority: 'medium',
      channels: ['websocket']
    });
  }

  /**
   * 创建系统维护通知
   */
  async createMaintenanceNotification(
    title: string,
    content: string,
    scheduledAt?: Date
  ): Promise<void> {
    try {
      // 获取所有活跃用户（这里简化处理，实际应该从用户表获取）
      const activeUsers = await this.getActiveUsers();
      
      const notifications = activeUsers.map(userId => ({
        userId,
        type: 'maintenance' as const,
        subType: 'system_maintenance',
        title,
        content,
        priority: 'high' as const,
        channels: ['websocket'] as const,
        scheduledAt
      }));

      await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error('创建系统维护通知失败:', error);
      throw error;
    }
  }

  /**
   * 获取活跃用户列表（简化实现）
   */
  private async getActiveUsers(): Promise<string[]> {
    try {
      // 从Redis获取在线用户
      const onlineUsers = this.webSocketService?.getOnlineUsers() || [];
      
      // 这里可以扩展为获取最近活跃的用户
      return onlineUsers;
    } catch (error) {
      console.error('获取活跃用户失败:', error);
      return [];
    }
  }

  /**
   * 启动定时任务
   */
  startScheduledTasks(): void {
    // 每分钟处理定时通知
    setInterval(async () => {
      try {
        await this.processScheduledNotifications();
      } catch (error) {
        console.error('定时通知处理失败:', error);
      }
    }, 60 * 1000);

    // 每小时清理过期通知
    setInterval(async () => {
      try {
        await this.cleanupExpiredNotifications();
      } catch (error) {
        console.error('清理过期通知失败:', error);
      }
    }, 60 * 60 * 1000);

    console.log('通知定时任务已启动');
  }
}