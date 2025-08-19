import { SmsService, SendSmsOptions } from './SmsService';
import { NotificationService } from './NotificationService';
import { INotification } from '../models/Notification';

export interface SmsNotificationConfig {
  enabled: boolean;
  chargingNotifications: boolean;
  paymentNotifications: boolean;
  couponNotifications: boolean;
  systemNotifications: boolean;
  verificationCodes: boolean;
}

export interface UserSmsPreferences {
  userId: string;
  phoneNumber?: string;
  config: SmsNotificationConfig;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 短信通知服务
 * 集成短信服务和通知系统
 */
export class SmsNotificationService {
  private smsService: SmsService;
  private notificationService?: NotificationService;
  private userPreferences: Map<string, UserSmsPreferences> = new Map();

  constructor(smsService: SmsService, notificationService?: NotificationService) {
    this.smsService = smsService;
    this.notificationService = notificationService;
    this.initializeDefaultPreferences();
  }

  /**
   * 初始化默认用户偏好设置
   */
  private initializeDefaultPreferences(): void {
    // 这里可以从数据库加载用户偏好设置
    // 目前使用内存存储作为示例
  }

  /**
   * 设置通知服务
   */
  setNotificationService(notificationService: NotificationService): void {
    this.notificationService = notificationService;
  }

  /**
   * 获取用户短信偏好设置
   */
  getUserPreferences(userId: string): UserSmsPreferences {
    let preferences = this.userPreferences.get(userId);
    
    if (!preferences) {
      // 创建默认偏好设置
      preferences = {
        userId,
        config: {
          enabled: true,
          chargingNotifications: true,
          paymentNotifications: true,
          couponNotifications: false,
          systemNotifications: true,
          verificationCodes: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.userPreferences.set(userId, preferences);
    }
    
    return preferences;
  }

  /**
   * 更新用户短信偏好设置
   */
  updateUserPreferences(
    userId: string, 
    config: Partial<SmsNotificationConfig>,
    phoneNumber?: string
  ): UserSmsPreferences {
    const preferences = this.getUserPreferences(userId);
    
    preferences.config = { ...preferences.config, ...config };
    if (phoneNumber) {
      preferences.phoneNumber = phoneNumber;
    }
    preferences.updatedAt = new Date();
    
    this.userPreferences.set(userId, preferences);
    
    console.log(`更新用户 ${userId} 短信偏好设置:`, preferences.config);
    
    return preferences;
  }

  /**
   * 发送充电开始短信通知
   */
  async sendChargingStartedSms(
    userId: string,
    phoneNumber: string,
    data: {
      stationName: string;
      estimatedTime: string;
    }
  ): Promise<boolean> {
    const preferences = this.getUserPreferences(userId);
    
    if (!preferences.config.enabled || !preferences.config.chargingNotifications) {
      console.log(`用户 ${userId} 已禁用充电短信通知`);
      return false;
    }

    const result = await this.smsService.sendSms({
      phoneNumber,
      templateId: 'CHARGING_STARTED',
      variables: {
        stationName: data.stationName,
        estimatedTime: data.estimatedTime
      }
    });

    return result.success;
  }

  /**
   * 发送充电完成短信通知
   */
  async sendChargingCompletedSms(
    userId: string,
    phoneNumber: string,
    data: {
      chargedAmount: string;
      totalCost: string;
    }
  ): Promise<boolean> {
    const preferences = this.getUserPreferences(userId);
    
    if (!preferences.config.enabled || !preferences.config.chargingNotifications) {
      console.log(`用户 ${userId} 已禁用充电短信通知`);
      return false;
    }

    const result = await this.smsService.sendSms({
      phoneNumber,
      templateId: 'CHARGING_COMPLETED',
      variables: {
        chargedAmount: data.chargedAmount,
        totalCost: data.totalCost
      }
    });

    return result.success;
  }

  /**
   * 发送充电异常短信通知
   */
  async sendChargingFailedSms(
    userId: string,
    phoneNumber: string,
    data: {
      reason: string;
      servicePhone: string;
    }
  ): Promise<boolean> {
    const preferences = this.getUserPreferences(userId);
    
    if (!preferences.config.enabled || !preferences.config.chargingNotifications) {
      console.log(`用户 ${userId} 已禁用充电短信通知`);
      return false;
    }

    const result = await this.smsService.sendSms({
      phoneNumber,
      templateId: 'CHARGING_FAILED',
      variables: {
        reason: data.reason,
        servicePhone: data.servicePhone
      },
      priority: 'high'
    });

    return result.success;
  }

  /**
   * 发送支付成功短信通知
   */
  async sendPaymentSuccessSms(
    userId: string,
    phoneNumber: string,
    data: {
      orderId: string;
      amount: string;
    }
  ): Promise<boolean> {
    const preferences = this.getUserPreferences(userId);
    
    if (!preferences.config.enabled || !preferences.config.paymentNotifications) {
      console.log(`用户 ${userId} 已禁用支付短信通知`);
      return false;
    }

    const result = await this.smsService.sendSms({
      phoneNumber,
      templateId: 'PAYMENT_SUCCESS',
      variables: {
        orderId: data.orderId,
        amount: data.amount
      }
    });

    return result.success;
  }

  /**
   * 发送支付失败短信通知
   */
  async sendPaymentFailedSms(
    userId: string,
    phoneNumber: string,
    data: {
      orderId: string;
      servicePhone: string;
    }
  ): Promise<boolean> {
    const preferences = this.getUserPreferences(userId);
    
    if (!preferences.config.enabled || !preferences.config.paymentNotifications) {
      console.log(`用户 ${userId} 已禁用支付短信通知`);
      return false;
    }

    const result = await this.smsService.sendSms({
      phoneNumber,
      templateId: 'PAYMENT_FAILED',
      variables: {
        orderId: data.orderId,
        servicePhone: data.servicePhone
      },
      priority: 'high'
    });

    return result.success;
  }

  /**
   * 发送余额不足短信提醒
   */
  async sendBalanceLowSms(
    userId: string,
    phoneNumber: string,
    data: {
      balance: string;
    }
  ): Promise<boolean> {
    const preferences = this.getUserPreferences(userId);
    
    if (!preferences.config.enabled || !preferences.config.paymentNotifications) {
      console.log(`用户 ${userId} 已禁用支付短信通知`);
      return false;
    }

    const result = await this.smsService.sendSms({
      phoneNumber,
      templateId: 'BALANCE_LOW',
      variables: {
        balance: data.balance
      },
      priority: 'high'
    });

    return result.success;
  }

  /**
   * 发送优惠券到账短信通知
   */
  async sendCouponReceivedSms(
    userId: string,
    phoneNumber: string,
    data: {
      couponName: string;
      amount: string;
      expiryDate: string;
    }
  ): Promise<boolean> {
    const preferences = this.getUserPreferences(userId);
    
    if (!preferences.config.enabled || !preferences.config.couponNotifications) {
      console.log(`用户 ${userId} 已禁用优惠券短信通知`);
      return false;
    }

    const result = await this.smsService.sendSms({
      phoneNumber,
      templateId: 'COUPON_RECEIVED',
      variables: {
        couponName: data.couponName,
        amount: data.amount,
        expiryDate: data.expiryDate
      }
    });

    return result.success;
  }

  /**
   * 发送优惠券过期提醒短信
   */
  async sendCouponExpiringSms(
    userId: string,
    phoneNumber: string,
    data: {
      couponName: string;
      days: string;
    }
  ): Promise<boolean> {
    const preferences = this.getUserPreferences(userId);
    
    if (!preferences.config.enabled || !preferences.config.couponNotifications) {
      console.log(`用户 ${userId} 已禁用优惠券短信通知`);
      return false;
    }

    const result = await this.smsService.sendSms({
      phoneNumber,
      templateId: 'COUPON_EXPIRING',
      variables: {
        couponName: data.couponName,
        days: data.days
      }
    });

    return result.success;
  }

  /**
   * 发送验证码短信
   */
  async sendVerificationCodeSms(
    phoneNumber: string,
    code: string
  ): Promise<boolean> {
    const result = await this.smsService.sendSms({
      phoneNumber,
      templateId: 'VERIFICATION_CODE',
      variables: {
        code
      },
      priority: 'high'
    });

    return result.success;
  }

  /**
   * 发送系统维护通知短信
   */
  async sendSystemMaintenanceSms(
    phoneNumbers: string[],
    data: {
      startTime: string;
      duration: string;
    }
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    const messages: SendSmsOptions[] = phoneNumbers.map(phoneNumber => ({
      phoneNumber,
      templateId: 'SYSTEM_MAINTENANCE',
      variables: {
        startTime: data.startTime,
        duration: data.duration
      },
      priority: 'normal'
    }));

    const results = await this.smsService.sendBulkSms(messages);
    
    results.forEach(result => {
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    });

    console.log(`系统维护通知发送完成: 成功 ${success} 条, 失败 ${failed} 条`);
    
    return { success, failed };
  }

  /**
   * 根据通知自动发送短信
   */
  async handleNotificationSms(notification: INotification, phoneNumber?: string): Promise<boolean> {
    if (!phoneNumber) {
      console.log(`用户 ${notification.userId} 未设置手机号，跳过短信发送`);
      return false;
    }

    const preferences = this.getUserPreferences(notification.userId);
    
    if (!preferences.config.enabled) {
      console.log(`用户 ${notification.userId} 已禁用短信通知`);
      return false;
    }

    try {
      switch (notification.type) {
        case 'charging':
          if (!preferences.config.chargingNotifications) return false;
          return await this.handleChargingNotificationSms(notification, phoneNumber);
          
        case 'payment':
          if (!preferences.config.paymentNotifications) return false;
          return await this.handlePaymentNotificationSms(notification, phoneNumber);
          
        case 'coupon':
          if (!preferences.config.couponNotifications) return false;
          return await this.handleCouponNotificationSms(notification, phoneNumber);
          
        case 'system':
        case 'maintenance':
          if (!preferences.config.systemNotifications) return false;
          return await this.handleSystemNotificationSms(notification, phoneNumber);
          
        default:
          console.log(`未知通知类型: ${notification.type}`);
          return false;
      }
    } catch (error) {
      console.error('处理通知短信失败:', error);
      return false;
    }
  }

  /**
   * 处理充电通知短信
   */
  private async handleChargingNotificationSms(
    notification: INotification,
    phoneNumber: string
  ): Promise<boolean> {
    const data = notification.data || {};
    
    switch (notification.subType) {
      case 'started':
        return await this.sendChargingStartedSms(notification.userId, phoneNumber, {
          stationName: data.stationName || '充电站',
          estimatedTime: data.estimatedTime || '未知'
        });
        
      case 'completed':
        return await this.sendChargingCompletedSms(notification.userId, phoneNumber, {
          chargedAmount: data.chargedAmount?.toString() || '0',
          totalCost: data.totalCost?.toString() || '0'
        });
        
      case 'failed':
      case 'interrupted':
        return await this.sendChargingFailedSms(notification.userId, phoneNumber, {
          reason: data.reason || '未知原因',
          servicePhone: process.env.SERVICE_PHONE || '400-000-0000'
        });
        
      default:
        return false;
    }
  }

  /**
   * 处理支付通知短信
   */
  private async handlePaymentNotificationSms(
    notification: INotification,
    phoneNumber: string
  ): Promise<boolean> {
    const data = notification.data || {};
    
    switch (notification.subType) {
      case 'success':
        return await this.sendPaymentSuccessSms(notification.userId, phoneNumber, {
          orderId: data.orderId || '未知',
          amount: data.amount?.toString() || '0'
        });
        
      case 'failed':
        return await this.sendPaymentFailedSms(notification.userId, phoneNumber, {
          orderId: data.orderId || '未知',
          servicePhone: process.env.SERVICE_PHONE || '400-000-0000'
        });
        
      default:
        return false;
    }
  }

  /**
   * 处理优惠券通知短信
   */
  private async handleCouponNotificationSms(
    notification: INotification,
    phoneNumber: string
  ): Promise<boolean> {
    const data = notification.data || {};
    
    switch (notification.subType) {
      case 'received':
        return await this.sendCouponReceivedSms(notification.userId, phoneNumber, {
          couponName: data.couponName || '优惠券',
          amount: data.amount?.toString() || '0',
          expiryDate: data.expiryDate || '未知'
        });
        
      case 'expiry_warning':
        return await this.sendCouponExpiringSms(notification.userId, phoneNumber, {
          couponName: data.couponName || '优惠券',
          days: data.days?.toString() || '0'
        });
        
      default:
        return false;
    }
  }

  /**
   * 处理系统通知短信
   */
  private async handleSystemNotificationSms(
    notification: INotification,
    phoneNumber: string
  ): Promise<boolean> {
    // 系统通知通常不发送短信，除非是紧急情况
    if (notification.priority === 'urgent') {
      const result = await this.smsService.sendSms({
        phoneNumber,
        templateId: 'SYSTEM_MAINTENANCE',
        variables: {
          startTime: '立即',
          duration: '未知'
        },
        priority: 'high'
      });
      
      return result.success;
    }
    
    return false;
  }

  /**
   * 获取短信发送统计
   */
  getStatistics(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day') {
    return this.smsService.getStatistics(timeRange);
  }

  /**
   * 获取短信模板列表
   */
  getTemplates() {
    return this.smsService.getAllTemplates();
  }

  /**
   * 获取消息历史
   */
  getMessageHistory(limit: number = 100) {
    return this.smsService.getMessageHistory(limit);
  }

  /**
   * 清理历史记录
   */
  cleanupHistory(daysToKeep: number = 30): number {
    return this.smsService.cleanupHistory(daysToKeep);
  }
}
