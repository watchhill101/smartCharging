import { NotificationService } from '../services/NotificationService';
import { RedisService } from '../services/RedisService';

/**
 * 通知系统测试工具
 */
export class NotificationTestUtil {
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  /**
   * 测试充电通知
   */
  async testChargingNotifications(userId: string): Promise<void> {
    console.log('🧪 测试充电通知...');

    // 充电开始通知
    await this.notificationService.createChargingNotification(
      userId,
      'started',
      {
        stationName: '测试充电站A',
        connectorId: 'A001',
        estimatedTime: '2小时30分钟',
        startTime: new Date().toISOString()
      }
    );

    // 延迟发送充电完成通知
    setTimeout(async () => {
      await this.notificationService.createChargingNotification(
        userId,
        'completed',
        {
          stationName: '测试充电站A',
          connectorId: 'A001',
          chargedAmount: 25.6,
          totalCost: 38.40,
          duration: '2小时15分钟'
        }
      );
    }, 5000);

    console.log('✅ 充电通知测试完成');
  }

  /**
   * 测试支付通知
   */
  async testPaymentNotifications(userId: string): Promise<void> {
    console.log('🧪 测试支付通知...');

    // 支付成功通知
    await this.notificationService.createPaymentNotification(
      userId,
      'success',
      {
        amount: 38.40,
        orderId: 'TEST' + Date.now(),
        paymentMethod: '微信支付',
        transactionId: 'WX' + Date.now()
      }
    );

    console.log('✅ 支付通知测试完成');
  }

  /**
   * 测试系统维护通知
   */
  async testMaintenanceNotification(): Promise<void> {
    console.log('🧪 测试系统维护通知...');

    await this.notificationService.createMaintenanceNotification(
      '系统维护通知',
      '系统将于今晚23:00-01:00进行维护升级，期间可能影响充电服务，请提前安排充电计划。',
      new Date(Date.now() + 10000) // 10秒后发送
    );

    console.log('✅ 系统维护通知测试完成');
  }

  /**
   * 测试批量通知
   */
  async testBulkNotifications(userIds: string[]): Promise<void> {
    console.log('🧪 测试批量通知...');

    const notifications = userIds.map(userId => ({
      userId,
      type: 'coupon' as const,
      subType: 'received',
      title: '新用户福利',
      content: '恭喜您获得新用户专享优惠券，立减10元！',
      data: {
        couponId: 'NEWUSER10',
        discount: 10,
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      priority: 'medium' as const,
      channels: ['websocket'] as const
    }));

    await this.notificationService.createBulkNotifications(notifications);

    console.log('✅ 批量通知测试完成');
  }

  /**
   * 测试定时通知
   */
  async testScheduledNotification(userId: string): Promise<void> {
    console.log('🧪 测试定时通知...');

    // 创建30秒后发送的定时通知
    await this.notificationService.createNotification({
      userId,
      type: 'system',
      subType: 'reminder',
      title: '充电提醒',
      content: '您的车辆已充电完成，请及时移走车辆避免产生超时费用。',
      priority: 'high',
      scheduledAt: new Date(Date.now() + 30000), // 30秒后
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
    });

    console.log('✅ 定时通知测试完成');
  }

  /**
   * 测试通知优先级
   */
  async testNotificationPriorities(userId: string): Promise<void> {
    console.log('🧪 测试通知优先级...');

    const priorities = ['low', 'medium', 'high', 'urgent'] as const;
    
    for (const priority of priorities) {
      await this.notificationService.createNotification({
        userId,
        type: 'system',
        subType: 'test',
        title: `${priority.toUpperCase()}优先级测试`,
        content: `这是一条${priority}优先级的测试通知`,
        priority,
        channels: ['websocket']
      });

      // 间隔1秒发送
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ 通知优先级测试完成');
  }

  /**
   * 运行完整测试套件
   */
  async runFullTestSuite(userId: string): Promise<void> {
    console.log('🚀 开始运行通知系统完整测试套件...');
    console.log(`👤 测试用户ID: ${userId}`);

    try {
      // 基础通知测试
      await this.testChargingNotifications(userId);
      await new Promise(resolve => setTimeout(resolve, 2000));

      await this.testPaymentNotifications(userId);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 优先级测试
      await this.testNotificationPriorities(userId);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 定时通知测试
      await this.testScheduledNotification(userId);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 批量通知测试
      await this.testBulkNotifications([userId]);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 系统维护通知测试
      await this.testMaintenanceNotification();

      console.log('🎉 通知系统测试套件运行完成！');
      console.log('📊 请检查前端应用是否收到了所有测试通知');
      
    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 获取通知统计信息
   */
  async getTestStats(userId: string): Promise<void> {
    console.log('📊 获取通知统计信息...');

    try {
      const stats = await this.notificationService.getNotificationStats(userId, 'day');
      
      console.log('📈 今日通知统计:');
      console.log(`   总计: ${stats.total}`);
      console.log(`   未读: ${stats.unread}`);
      console.log('   按类型分布:', stats.byType);
      console.log('   按优先级分布:', stats.byPriority);
      
    } catch (error) {
      console.error('❌ 获取统计信息失败:', error);
    }
  }

  /**
   * 清理测试数据
   */
  async cleanupTestData(): Promise<void> {
    console.log('🧹 清理测试数据...');

    try {
      const result = await this.notificationService.cleanupExpiredNotifications();
      console.log(`✅ 清理完成，删除了 ${result.deleted} 条过期通知`);
    } catch (error) {
      console.error('❌ 清理测试数据失败:', error);
    }
  }
}

/**
 * 创建测试实例的工厂函数
 */
export function createNotificationTestUtil(redisService: RedisService): NotificationTestUtil {
  const notificationService = new NotificationService(redisService);
  return new NotificationTestUtil(notificationService);
}

/**
 * 快速测试函数
 */
export async function quickTest(userId: string, redisService: RedisService): Promise<void> {
  const testUtil = createNotificationTestUtil(redisService);
  await testUtil.runFullTestSuite(userId);
}
