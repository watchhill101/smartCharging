import { NotificationService } from '../services/NotificationService';
import { SmsNotificationService } from '../services/SmsNotificationService';
import { INotification } from '../models/Notification';

/**
 * 短信通知集成工具
 * 将短信通知与现有通知系统集成
 */
export class SmsIntegrationUtil {
  private notificationService: NotificationService;
  private smsNotificationService: SmsNotificationService;
  private userPhoneNumbers: Map<string, string> = new Map();

  constructor(
    notificationService: NotificationService,
    smsNotificationService: SmsNotificationService
  ) {
    this.notificationService = notificationService;
    this.smsNotificationService = smsNotificationService;
    this.initializePhoneNumbers();
  }

  /**
   * 初始化用户手机号映射
   * 在实际应用中，这些数据应该从用户数据库中获取
   */
  private initializePhoneNumbers(): void {
    // 这里是示例数据，实际应该从数据库加载
    // 可以通过用户服务或数据库查询获取
  }

  /**
   * 设置用户手机号
   */
  setUserPhoneNumber(userId: string, phoneNumber: string): void {
    this.userPhoneNumbers.set(userId, phoneNumber);
  }

  /**
   * 获取用户手机号
   */
  getUserPhoneNumber(userId: string): string | undefined {
    return this.userPhoneNumbers.get(userId);
  }

  /**
   * 创建带短信通知的通知
   */
  async createNotificationWithSms(
    notificationData: {
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
    },
    phoneNumber?: string
  ): Promise<{ notification: INotification; smsSent: boolean }> {
    try {
      // 创建通知
      const notification = await this.notificationService.createNotification(notificationData);

      // 发送短信通知
      let smsSent = false;
      if (notificationData.channels?.includes('sms')) {
        const userPhone = phoneNumber || this.getUserPhoneNumber(notificationData.userId);
        if (userPhone) {
          smsSent = await this.smsNotificationService.handleNotificationSms(
            notification,
            userPhone
          );
        } else {
          console.log(`用户 ${notificationData.userId} 未设置手机号，跳过短信发送`);
        }
      }

      return { notification, smsSent };
    } catch (error) {
      console.error('创建带短信通知的通知失败:', error);
      throw error;
    }
  }

  /**
   * 创建充电相关通知（带短信）
   */
  async createChargingNotificationWithSms(
    userId: string,
    subType: 'started' | 'completed' | 'failed' | 'interrupted',
    data: any,
    phoneNumber?: string
  ): Promise<{ notification: INotification; smsSent: boolean }> {
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

    return this.createNotificationWithSms(
      {
        userId,
        type: 'charging',
        subType,
        title: titles[subType],
        content: contents[subType],
        data,
        priority: subType === 'failed' ? 'high' : 'medium',
        channels: ['websocket', 'sms']
      },
      phoneNumber
    );
  }

  /**
   * 创建支付相关通知（带短信）
   */
  async createPaymentNotificationWithSms(
    userId: string,
    subType: 'success' | 'failed' | 'refund',
    data: any,
    phoneNumber?: string
  ): Promise<{ notification: INotification; smsSent: boolean }> {
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

    return this.createNotificationWithSms(
      {
        userId,
        type: 'payment',
        subType,
        title: titles[subType],
        content: contents[subType],
        data,
        priority: subType === 'failed' ? 'high' : 'medium',
        channels: ['websocket', 'sms']
      },
      phoneNumber
    );
  }

  /**
   * 创建优惠券相关通知（带短信）
   */
  async createCouponNotificationWithSms(
    userId: string,
    subType: 'received' | 'expiry_warning' | 'expired',
    data: any,
    phoneNumber?: string
  ): Promise<{ notification: INotification; smsSent: boolean }> {
    const titles = {
      received: '优惠券到账',
      expiry_warning: '优惠券即将过期',
      expired: '优惠券已过期'
    };

    const contents = {
      received: `恭喜！您获得${data.couponName || '优惠券'}，面额¥${data.amount || 0}`,
      expiry_warning: `提醒：您的${data.couponName || '优惠券'}将在${data.days || 0}天后过期`,
      expired: `您的${data.couponName || '优惠券'}已过期，请及时关注新的优惠活动`
    };

    return this.createNotificationWithSms(
      {
        userId,
        type: 'coupon',
        subType,
        title: titles[subType],
        content: contents[subType],
        data,
        priority: 'low',
        channels: ['websocket', 'sms']
      },
      phoneNumber
    );
  }

  /**
   * 创建余额不足通知（带短信）
   */
  async createBalanceLowNotificationWithSms(
    userId: string,
    balance: number,
    phoneNumber?: string
  ): Promise<{ notification: INotification; smsSent: boolean }> {
    return this.createNotificationWithSms(
      {
        userId,
        type: 'payment',
        subType: 'balance_low',
        title: '余额不足提醒',
        content: `您的账户余额不足¥${balance}，请及时充值以免影响充电服务`,
        data: { balance },
        priority: 'high',
        channels: ['websocket', 'sms']
      },
      phoneNumber
    );
  }

  /**
   * 批量发送系统维护通知（带短信）
   */
  async sendMaintenanceNotificationWithSms(
    title: string,
    content: string,
    userPhoneMap: Map<string, string>, // userId -> phoneNumber
    scheduledAt?: Date
  ): Promise<{
    notifications: INotification[];
    smsResults: { success: number; failed: number };
  }> {
    try {
      const notifications: INotification[] = [];
      let smsSuccess = 0;
      let smsFailed = 0;

      // 为每个用户创建通知
      for (const [userId, phoneNumber] of userPhoneMap.entries()) {
        try {
          const result = await this.createNotificationWithSms(
            {
              userId,
              type: 'maintenance',
              subType: 'system_maintenance',
              title,
              content,
              priority: 'high',
              channels: ['websocket', 'sms'],
              scheduledAt
            },
            phoneNumber
          );

          notifications.push(result.notification);
          
          if (result.smsSent) {
            smsSuccess++;
          } else {
            smsFailed++;
          }
        } catch (error) {
          console.error(`为用户 ${userId} 创建维护通知失败:`, error);
          smsFailed++;
        }

        // 添加延迟以避免频率限制
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`系统维护通知发送完成: 通知 ${notifications.length} 条, 短信成功 ${smsSuccess} 条, 短信失败 ${smsFailed} 条`);

      return {
        notifications,
        smsResults: { success: smsSuccess, failed: smsFailed }
      };
    } catch (error) {
      console.error('批量发送维护通知失败:', error);
      throw error;
    }
  }

  /**
   * 监听通知事件并自动发送短信
   */
  setupNotificationListener(): void {
    // 这里可以设置事件监听器，当创建通知时自动检查是否需要发送短信
    // 在实际应用中，可以使用事件发射器或消息队列来实现
    console.log('短信通知监听器已设置');
  }

  /**
   * 获取短信发送统计
   */
  getSmsStatistics(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day') {
    return this.smsNotificationService.getStatistics(timeRange);
  }

  /**
   * 获取用户短信偏好设置
   */
  getUserSmsPreferences(userId: string) {
    return this.smsNotificationService.getUserPreferences(userId);
  }

  /**
   * 更新用户短信偏好设置
   */
  updateUserSmsPreferences(
    userId: string,
    config: any,
    phoneNumber?: string
  ) {
    const preferences = this.smsNotificationService.updateUserPreferences(
      userId,
      config,
      phoneNumber
    );
    
    // 同时更新本地手机号映射
    if (phoneNumber) {
      this.setUserPhoneNumber(userId, phoneNumber);
    }
    
    return preferences;
  }

  /**
   * 清理过期数据
   */
  cleanup(daysToKeep: number = 30): {
    smsHistoryDeleted: number;
  } {
    const smsHistoryDeleted = this.smsNotificationService.cleanupHistory(daysToKeep);
    
    return {
      smsHistoryDeleted
    };
  }
}

/**
 * 创建短信集成实例的工厂函数
 */
export function createSmsIntegration(
  notificationService: NotificationService,
  smsNotificationService: SmsNotificationService
): SmsIntegrationUtil {
  const integration = new SmsIntegrationUtil(notificationService, smsNotificationService);
  integration.setupNotificationListener();
  return integration;
}
