import { UserCoupon } from '../models/UserCoupon';
import { Coupon } from '../models/Coupon';
import { RedisService } from './RedisService';

export interface CouponNotification {
  userId: string;
  couponCode: string;
  couponName: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  type: 'expiry_warning' | 'new_coupon' | 'usage_reminder';
}

export class CouponNotificationService {
  private redisService: RedisService;

  constructor(redisService: RedisService) {
    this.redisService = redisService;
  }

  /**
   * 检查即将过期的优惠券并发送提醒
   */
  async checkExpiringCoupons(): Promise<CouponNotification[]> {
    try {
      const now = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const oneDayLater = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

      // 查找即将过期的优惠券（1-3天内过期）
      const expiringCoupons = await UserCoupon.aggregate([
        {
          $match: {
            status: 'available',
            expiredAt: {
              $gte: now,
              $lte: threeDaysLater
            }
          }
        },
        {
          $lookup: {
            from: 'coupons',
            localField: 'couponId',
            foreignField: 'couponId',
            as: 'couponInfo'
          }
        },
        { $unwind: '$couponInfo' }
      ]);

      const notifications: CouponNotification[] = [];

      for (const userCoupon of expiringCoupons) {
        const daysUntilExpiry = Math.ceil(
          (new Date(userCoupon.expiredAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

        // 检查是否已经发送过提醒
        const notificationKey = `coupon:notification:${userCoupon.userId}:${userCoupon.couponCode}:${daysUntilExpiry}`;
        const alreadySent = await this.redisService.get(notificationKey);

        if (!alreadySent) {
          const notification: CouponNotification = {
            userId: userCoupon.userId,
            couponCode: userCoupon.couponCode,
            couponName: userCoupon.couponInfo.name,
            expiryDate: new Date(userCoupon.expiredAt),
            daysUntilExpiry,
            type: 'expiry_warning'
          };

          notifications.push(notification);

          // 发送通知
          await this.sendExpiryNotification(notification);

          // 标记已发送，避免重复发送
          await this.redisService.setex(notificationKey, 24 * 60 * 60, 'sent'); // 24小时过期
        }
      }

      return notifications;
    } catch (error) {
      console.error('检查过期优惠券失败:', error);
      throw new Error('检查过期优惠券失败');
    }
  }

  /**
   * 发送新优惠券通知
   */
  async sendNewCouponNotification(userId: string, couponCode: string, couponName: string): Promise<void> {
    try {
      const notification: CouponNotification = {
        userId,
        couponCode,
        couponName,
        expiryDate: new Date(),
        daysUntilExpiry: 0,
        type: 'new_coupon'
      };

      await this.sendNotification(notification, {
        title: '新优惠券到账',
        content: `您获得了新的优惠券"${couponName}"，快去使用吧！`,
        action: 'view_coupons'
      });

      console.log(`新优惠券通知已发送给用户 ${userId}`);
    } catch (error) {
      console.error('发送新优惠券通知失败:', error);
    }
  }

  /**
   * 发送使用提醒通知
   */
  async sendUsageReminderNotification(userId: string): Promise<void> {
    try {
      // 查找用户未使用的优惠券数量
      const unusedCount = await UserCoupon.countDocuments({
        userId,
        status: 'available',
        expiredAt: { $gte: new Date() }
      });

      if (unusedCount > 0) {
        const notification: CouponNotification = {
          userId,
          couponCode: '',
          couponName: '',
          expiryDate: new Date(),
          daysUntilExpiry: 0,
          type: 'usage_reminder'
        };

        await this.sendNotification(notification, {
          title: '优惠券使用提醒',
          content: `您有 ${unusedCount} 张优惠券未使用，充电时记得使用哦！`,
          action: 'view_coupons'
        });

        console.log(`使用提醒通知已发送给用户 ${userId}`);
      }
    } catch (error) {
      console.error('发送使用提醒通知失败:', error);
    }
  }

  /**
   * 发送过期提醒通知
   */
  private async sendExpiryNotification(notification: CouponNotification): Promise<void> {
    let title = '';
    let content = '';

    if (notification.daysUntilExpiry === 1) {
      title = '优惠券即将过期';
      content = `您的优惠券"${notification.couponName}"将在明天过期，请及时使用！`;
    } else {
      title = '优惠券过期提醒';
      content = `您的优惠券"${notification.couponName}"将在${notification.daysUntilExpiry}天后过期，请及时使用！`;
    }

    await this.sendNotification(notification, {
      title,
      content,
      action: 'use_coupon',
      couponCode: notification.couponCode
    });
  }

  /**
   * 通用通知发送方法
   */
  private async sendNotification(
    notification: CouponNotification,
    messageData: {
      title: string;
      content: string;
      action: string;
      couponCode?: string;
    }
  ): Promise<void> {
    try {
      // 构建通知消息
      const notificationMessage = {
        userId: notification.userId,
        type: 'coupon_notification',
        subType: notification.type,
        title: messageData.title,
        content: messageData.content,
        data: {
          action: messageData.action,
          couponCode: messageData.couponCode || notification.couponCode,
          couponName: notification.couponName
        },
        createdAt: new Date(),
        isRead: false
      };

      // 存储到Redis通知队列
      await this.redisService.lpush(
        'notification:queue',
        JSON.stringify(notificationMessage)
      );

      // 存储到用户通知列表
      await this.redisService.lpush(
        `user:${notification.userId}:notifications`,
        JSON.stringify(notificationMessage)
      );

      // 设置用户通知列表过期时间（30天）
      await this.redisService.expire(
        `user:${notification.userId}:notifications`,
        30 * 24 * 60 * 60
      );

      console.log(`通知已发送给用户 ${notification.userId}: ${messageData.title}`);
    } catch (error) {
      console.error('发送通知失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的优惠券通知
   */
  async getUserCouponNotifications(userId: string, limit: number = 20): Promise<any[]> {
    try {
      const notifications = await this.redisService.lrange(
        `user:${userId}:notifications`,
        0,
        limit - 1
      );

      return notifications.map(notification => JSON.parse(notification));
    } catch (error) {
      console.error('获取用户通知失败:', error);
      throw new Error('获取用户通知失败');
    }
  }

  /**
   * 标记通知为已读
   */
  async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      // 这里可以实现更复杂的通知状态管理
      console.log(`标记通知 ${notificationId} 为已读，用户 ${userId}`);
    } catch (error) {
      console.error('标记通知已读失败:', error);
    }
  }

  /**
   * 启动定时通知检查
   */
  startNotificationSchedule(): void {
    // 每天检查一次即将过期的优惠券
    setInterval(async () => {
      try {
        console.log('开始检查即将过期的优惠券...');
        const notifications = await this.checkExpiringCoupons();
        console.log(`检查完成，发送了 ${notifications.length} 条过期提醒`);
      } catch (error) {
        console.error('优惠券过期检查失败:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24小时

    console.log('优惠券通知定时任务已启动');
  }
}