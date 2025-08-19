import { CouponService } from './CouponService';
import { RedisService } from './RedisService';

export class CouponCleanupService {
  private couponService: CouponService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(redisService: RedisService) {
    this.couponService = new CouponService(redisService);
  }

  /**
   * 启动定时清理任务
   */
  startCleanupSchedule(): void {
    // 每小时执行一次清理
    this.cleanupInterval = setInterval(async () => {
      try {
        console.log('开始执行优惠券清理任务...');
        const result = await this.couponService.cleanupExpiredCoupons();
        console.log(`优惠券清理完成，处理了 ${result.updated} 张过期优惠券`);
      } catch (error) {
        console.error('优惠券清理任务失败:', error);
      }
    }, 60 * 60 * 1000); // 1小时

    console.log('优惠券清理定时任务已启动');
  }

  /**
   * 停止定时清理任务
   */
  stopCleanupSchedule(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('优惠券清理定时任务已停止');
    }
  }

  /**
   * 手动执行清理任务
   */
  async manualCleanup(): Promise<{ updated: number }> {
    try {
      console.log('手动执行优惠券清理任务...');
      const result = await this.couponService.cleanupExpiredCoupons();
      console.log(`手动清理完成，处理了 ${result.updated} 张过期优惠券`);
      return result;
    } catch (error) {
      console.error('手动清理任务失败:', error);
      throw error;
    }
  }
}