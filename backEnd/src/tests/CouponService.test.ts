import { CouponService, CreateCouponData } from '../services/CouponService';
import { RedisService } from '../services/RedisService';
import { Coupon } from '../models/Coupon';
import { UserCoupon } from '../models/UserCoupon';

// Mock dependencies
jest.mock('../models/Coupon');
jest.mock('../models/UserCoupon');
jest.mock('../services/RedisService');

describe('CouponService', () => {
  let couponService: CouponService;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    mockRedisService = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    } as any;

    couponService = new CouponService(mockRedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCoupon', () => {
    it('应该成功创建优惠券', async () => {
      const mockCouponData: CreateCouponData = {
        name: '新用户优惠券',
        description: '首次充电立减10元',
        type: 'discount',
        value: 10,
        minAmount: 20,
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2024-12-31'),
        totalQuantity: 1000,
        applicableScenarios: ['charging'],
        createdBy: 'admin'
      };

      const mockSavedCoupon = {
        ...mockCouponData,
        couponId: 'CPN123456',
        usedQuantity: 0,
        remainingQuantity: 1000,
        save: jest.fn().mockResolvedValue(true)
      };

      (Coupon as any).mockImplementation(() => mockSavedCoupon);
      mockRedisService.keys.mockResolvedValue([]);

      const result = await couponService.createCoupon(mockCouponData);

      expect(result).toBeDefined();
      expect(result.couponId).toMatch(/^CPN[A-Z0-9]+$/);
      expect(mockSavedCoupon.save).toHaveBeenCalled();
    });
  });
});