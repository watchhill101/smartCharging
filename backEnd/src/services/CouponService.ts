import { Coupon, ICoupon } from '../models/Coupon';
import { UserCoupon, IUserCoupon } from '../models/UserCoupon';
import { RedisService } from './RedisService';

export interface CreateCouponData {
  name: string;
  description: string;
  type: 'discount' | 'cashback' | 'free_charging' | 'percentage';
  value: number;
  minAmount?: number;
  maxDiscount?: number;
  validFrom: Date;
  validTo: Date;
  totalQuantity: number;
  applicableScenarios: string[];
  targetUsers?: string[];
  createdBy: string;
}

export interface CouponQuery {
  type?: string;
  scenario?: string;
  status?: 'active' | 'expired' | 'all';
  page?: number;
  limit?: number;
}

export interface UserCouponQuery {
  userId: string;
  status?: 'available' | 'used' | 'expired' | 'all';
  scenario?: string;
  page?: number;
  limit?: number;
}

export interface CouponUsageData {
  userId: string;
  couponCode: string;
  orderId: string;
  orderAmount: number;
  scenario: string;
}

export class CouponService {
  private redisService: RedisService;

  constructor(redisService: RedisService) {
    this.redisService = redisService;
  }

  /**
   * 生成优惠券ID
   */
  private generateCouponId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `CPN${timestamp}${random}`.toUpperCase();
  }

  /**
   * 生成优惠券码
   */
  private generateCouponCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 创建优惠券
   */
  async createCoupon(data: CreateCouponData): Promise<ICoupon> {
    try {
      const couponId = this.generateCouponId();
      
      const coupon = new Coupon({
        ...data,
        couponId,
        usedQuantity: 0,
        remainingQuantity: data.totalQuantity
      });

      const savedCoupon = await coupon.save();

      // 清除相关缓存
      await this.clearCouponCache();

      return savedCoupon;
    } catch (error) {
      console.error('创建优惠券失败:', error);
      throw new Error('创建优惠券失败');
    }
  }

  /**
   * 获取优惠券列表
   */
  async getCoupons(query: CouponQuery = {}): Promise<{
    coupons: ICoupon[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const filter: any = {};
      
      if (query.type) filter.type = query.type;
      if (query.scenario) filter.applicableScenarios = { $in: [query.scenario] };
      
      const now = new Date();
      if (query.status === 'active') {
        filter.isActive = true;
        filter.validTo = { $gte: now };
      } else if (query.status === 'expired') {
        filter.validTo = { $lt: now };
      }

      const [coupons, total] = await Promise.all([
        Coupon.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Coupon.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        coupons: coupons as ICoupon[],
        total,
        page,
        totalPages
      };
    } catch (error) {
      console.error('获取优惠券列表失败:', error);
      throw new Error('获取优惠券列表失败');
    }
  }

  /**
   * 发放优惠券给用户
   */
  async issueCouponToUser(couponId: string, userId: string): Promise<IUserCoupon> {
    try {
      const coupon = await Coupon.findOne({ couponId, isActive: true });
      
      if (!coupon) {
        throw new Error('优惠券不存在或已失效');
      }

      if (coupon.remainingQuantity <= 0) {
        throw new Error('优惠券已领完');
      }

      const now = new Date();
      if (now < coupon.validFrom || now > coupon.validTo) {
        throw new Error('优惠券不在有效期内');
      }

      // 检查用户是否已经领取过该优惠券
      const existingUserCoupon = await UserCoupon.findOne({
        userId,
        couponId
      });

      if (existingUserCoupon) {
        throw new Error('您已经领取过该优惠券');
      }

      // 生成优惠券码
      const couponCode = this.generateCouponCode();

      // 创建用户优惠券记录
      const userCoupon = new UserCoupon({
        userId,
        couponId,
        couponCode,
        expiredAt: coupon.validTo
      });

      // 更新优惠券剩余数量
      await Promise.all([
        userCoupon.save(),
        Coupon.updateOne(
          { couponId },
          { 
            $inc: { 
              usedQuantity: 1,
              remainingQuantity: -1
            }
          }
        )
      ]);

      // 清除相关缓存
      await this.clearUserCouponCache(userId);

      return userCoupon;
    } catch (error) {
      console.error('发放优惠券失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户优惠券列表
   */
  async getUserCoupons(query: UserCouponQuery): Promise<{
    coupons: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const filter: any = { userId: query.userId };
      
      if (query.status && query.status !== 'all') {
        filter.status = query.status;
      }

      // 聚合查询，关联优惠券信息
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: 'coupons',
            localField: 'couponId',
            foreignField: 'couponId',
            as: 'couponInfo'
          }
        },
        { $unwind: '$couponInfo' },
        {
          $match: query.scenario ? {
            'couponInfo.applicableScenarios': { $in: [query.scenario] }
          } : {}
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      ];

      const [coupons, totalResult] = await Promise.all([
        UserCoupon.aggregate(pipeline),
        UserCoupon.aggregate([
          { $match: filter },
          {
            $lookup: {
              from: 'coupons',
              localField: 'couponId',
              foreignField: 'couponId',
              as: 'couponInfo'
            }
          },
          { $unwind: '$couponInfo' },
          {
            $match: query.scenario ? {
              'couponInfo.applicableScenarios': { $in: [query.scenario] }
            } : {}
          },
          { $count: 'total' }
        ])
      ]);

      const total = totalResult[0]?.total || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        coupons,
        total,
        page,
        totalPages
      };
    } catch (error) {
      console.error('获取用户优惠券失败:', error);
      throw new Error('获取用户优惠券失败');
    }
  }

  /**
   * 使用优惠券
   */
  async useCoupon(data: CouponUsageData): Promise<{
    success: boolean;
    discount: number;
    finalAmount: number;
  }> {
    try {
      const userCoupon = await UserCoupon.findOne({
        userId: data.userId,
        couponCode: data.couponCode,
        status: 'available'
      });

      if (!userCoupon) {
        throw new Error('优惠券不存在或已使用');
      }

      if (new Date() > userCoupon.expiredAt) {
        // 自动标记为过期
        await UserCoupon.updateOne(
          { _id: userCoupon._id },
          { status: 'expired' }
        );
        throw new Error('优惠券已过期');
      }

      // 获取优惠券信息
      const coupon = await Coupon.findOne({ couponId: userCoupon.couponId });
      if (!coupon) {
        throw new Error('优惠券配置不存在');
      }

      // 检查适用场景
      if (!coupon.applicableScenarios.includes(data.scenario)) {
        throw new Error('优惠券不适用于当前场景');
      }

      // 检查最小使用金额
      if (coupon.minAmount && data.orderAmount < coupon.minAmount) {
        throw new Error(`订单金额需满${coupon.minAmount}元才能使用该优惠券`);
      }

      // 计算优惠金额
      let discount = 0;
      switch (coupon.type) {
        case 'discount':
          discount = Math.min(coupon.value, data.orderAmount);
          break;
        case 'percentage':
          discount = data.orderAmount * (coupon.value / 100);
          if (coupon.maxDiscount) {
            discount = Math.min(discount, coupon.maxDiscount);
          }
          break;
        case 'cashback':
          discount = coupon.value;
          break;
        case 'free_charging':
          discount = data.orderAmount;
          break;
      }

      const finalAmount = Math.max(0, data.orderAmount - discount);

      // 标记优惠券为已使用
      await UserCoupon.updateOne(
        { _id: userCoupon._id },
        {
          status: 'used',
          usedAt: new Date(),
          usedOrderId: data.orderId
        }
      );

      // 清除相关缓存
      await this.clearUserCouponCache(data.userId);

      return {
        success: true,
        discount,
        finalAmount
      };
    } catch (error) {
      console.error('使用优惠券失败:', error);
      throw error;
    }
  }

  /**
   * 获取可用优惠券（用于订单结算）
   */
  async getAvailableCouponsForOrder(
    userId: string, 
    orderAmount: number, 
    scenario: string
  ): Promise<any[]> {
    try {
      const now = new Date();
      
      const pipeline = [
        {
          $match: {
            userId,
            status: 'available',
            expiredAt: { $gte: now }
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
        { $unwind: '$couponInfo' },
        {
          $match: {
            'couponInfo.isActive': true,
            'couponInfo.applicableScenarios': { $in: [scenario] },
            $or: [
              { 'couponInfo.minAmount': { $exists: false } },
              { 'couponInfo.minAmount': { $lte: orderAmount } }
            ]
          }
        },
        {
          $addFields: {
            calculatedDiscount: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$couponInfo.type', 'discount'] },
                    then: { $min: ['$couponInfo.value', orderAmount] }
                  },
                  {
                    case: { $eq: ['$couponInfo.type', 'percentage'] },
                    then: {
                      $min: [
                        { $multiply: [orderAmount, { $divide: ['$couponInfo.value', 100] }] },
                        { $ifNull: ['$couponInfo.maxDiscount', orderAmount] }
                      ]
                    }
                  },
                  {
                    case: { $eq: ['$couponInfo.type', 'cashback'] },
                    then: '$couponInfo.value'
                  },
                  {
                    case: { $eq: ['$couponInfo.type', 'free_charging'] },
                    then: orderAmount
                  }
                ],
                default: 0
              }
            }
          }
        },
        { $sort: { calculatedDiscount: -1, expiredAt: 1 } }
      ];

      const availableCoupons = await UserCoupon.aggregate(pipeline);
      return availableCoupons;
    } catch (error) {
      console.error('获取可用优惠券失败:', error);
      throw new Error('获取可用优惠券失败');
    }
  }

  /**
   * 获取优惠券统计信息
   */
  async getCouponStats(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalCoupons: number;
    activeCoupons: number;
    usedCoupons: number;
    expiredCoupons: number;
    totalUsers: number;
    usageRate: number;
  }> {
    try {
      const cacheKey = `coupon:stats:${timeRange}`;
      const cached = await this.redisService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

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

      const [
        totalCoupons,
        activeCoupons,
        usedCoupons,
        expiredCoupons,
        totalUsers
      ] = await Promise.all([
        UserCoupon.countDocuments({ createdAt: { $gte: startDate } }),
        UserCoupon.countDocuments({ 
          createdAt: { $gte: startDate },
          status: 'available',
          expiredAt: { $gte: now }
        }),
        UserCoupon.countDocuments({ 
          createdAt: { $gte: startDate },
          status: 'used'
        }),
        UserCoupon.countDocuments({ 
          createdAt: { $gte: startDate },
          status: 'expired'
        }),
        UserCoupon.distinct('userId', { createdAt: { $gte: startDate } }).then(users => users.length)
      ]);

      const usageRate = totalCoupons > 0 ? (usedCoupons / totalCoupons) * 100 : 0;

      const stats = {
        totalCoupons,
        activeCoupons,
        usedCoupons,
        expiredCoupons,
        totalUsers,
        usageRate: Math.round(usageRate * 100) / 100
      };

      // 缓存30分钟
      await this.redisService.setex(cacheKey, 1800, JSON.stringify(stats));

      return stats;
    } catch (error) {
      console.error('获取优惠券统计失败:', error);
      throw new Error('获取统计数据失败');
    }
  }

  /**
   * 自动清理过期优惠券
   */
  async cleanupExpiredCoupons(): Promise<{ updated: number }> {
    try {
      const now = new Date();
      
      const result = await UserCoupon.updateMany(
        {
          status: 'available',
          expiredAt: { $lt: now }
        },
        {
          status: 'expired'
        }
      );

      console.log(`清理过期优惠券: ${result.modifiedCount} 张`);
      
      return { updated: result.modifiedCount };
    } catch (error) {
      console.error('清理过期优惠券失败:', error);
      throw new Error('清理过期优惠券失败');
    }
  }

  /**
   * 批量发放优惠券
   */
  async batchIssueCoupons(couponId: string, userIds: string[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        await this.issueCouponToUser(couponId, userId);
        success++;
      } catch (error) {
        failed++;
        errors.push(`用户 ${userId}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  /**
   * 清除优惠券缓存
   */
  private async clearCouponCache(): Promise<void> {
    try {
      const keys = await this.redisService.keys('coupon:*');
      if (keys.length > 0) {
        await this.redisService.del(...keys);
      }
    } catch (error) {
      console.error('清除优惠券缓存失败:', error);
    }
  }

  /**
   * 清除用户优惠券缓存
   */
  private async clearUserCouponCache(userId: string): Promise<void> {
    try {
      const keys = await this.redisService.keys(`user:${userId}:coupons:*`);
      if (keys.length > 0) {
        await this.redisService.del(...keys);
      }
    } catch (error) {
      console.error('清除用户优惠券缓存失败:', error);
    }
  }
}