import request from 'supertest';
import { app } from '../app';
import { connectDB } from '../config/database';
import { connectRedis } from '../config/redis';
import { Coupon } from '../models/Coupon';
import { UserCoupon } from '../models/UserCoupon';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';

describe('Coupon API Integration Tests', () => {
  let authToken: string;
  let testUserId: string;
  let testCouponId: string;

  beforeAll(async () => {
    // 连接测试数据库
    await connectDB();
    await connectRedis();

    // 创建测试用户
    const testUser = new User({
      phone: '13800138000',
      nickName: '测试用户',
      balance: 100,
      verificationLevel: 'basic'
    });
    await testUser.save();
    testUserId = testUser._id.toString();

    // 生成测试token
    authToken = jwt.sign(
      { id: testUserId, phone: testUser.phone },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // 清理测试数据
    await User.deleteMany({});
    await Coupon.deleteMany({});
    await UserCoupon.deleteMany({});
  });

  beforeEach(async () => {
    // 清理测试数据
    await Coupon.deleteMany({});
    await UserCoupon.deleteMany({});
  });

  describe('Coupon Management', () => {
    beforeEach(async () => {
      // 创建测试优惠券
      const testCoupon = new Coupon({
        couponId: 'TEST_COUPON_001',
        name: '测试优惠券',
        description: '测试用优惠券，立减10元',
        type: 'discount',
        value: 10,
        minAmount: 20,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
        totalQuantity: 100,
        usedQuantity: 0,
        remainingQuantity: 100,
        isActive: true,
        applicableScenarios: ['charging'],
        createdBy: 'admin'
      });
      await testCoupon.save();
      testCouponId = testCoupon.couponId;
    });

    describe('POST /api/coupon/claim/:couponId', () => {
      it('应该成功领取优惠券', async () => {
        const response = await request(app)
          .post(`/api/coupon/claim/${testCouponId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('优惠券领取成功');
        expect(response.body.data.couponCode).toBeDefined();
        expect(response.body.data.expiredAt).toBeDefined();

        // 验证数据库中的记录
        const userCoupon = await UserCoupon.findOne({
          userId: testUserId,
          couponId: testCouponId
        });
        expect(userCoupon).toBeTruthy();
        expect(userCoupon.status).toBe('available');
      });

      it('应该防止重复领取同一优惠券', async () => {
        // 先领取一次
        await request(app)
          .post(`/api/coupon/claim/${testCouponId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(201);

        // 再次领取应该失败
        const response = await request(app)
          .post(`/api/coupon/claim/${testCouponId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('已经领取过');
      });

      it('应该处理不存在的优惠券', async () => {
        const response = await request(app)
          .post('/api/coupon/claim/NONEXISTENT')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('不存在');
      });

      it('应该要求用户认证', async () => {
        const response = await request(app)
          .post(`/api/coupon/claim/${testCouponId}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/coupon/my-coupons', () => {
      beforeEach(async () => {
        // 创建测试用户优惠券
        const userCoupons = [
          {
            userId: testUserId,
            couponId: testCouponId,
            couponCode: 'TEST001',
            status: 'available',
            expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          },
          {
            userId: testUserId,
            couponId: testCouponId,
            couponCode: 'TEST002',
            status: 'used',
            expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            usedAt: new Date(),
            usedOrderId: 'ORDER001'
          }
        ];

        await UserCoupon.insertMany(userCoupons);
      });

      it('应该获取用户优惠券列表', async () => {
        const response = await request(app)
          .get('/api/coupon/my-coupons')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.coupons).toBeDefined();
        expect(response.body.data.total).toBeGreaterThan(0);
      });

      it('应该支持状态筛选', async () => {
        const response = await request(app)
          .get('/api/coupon/my-coupons?status=available')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.coupons.length).toBeGreaterThan(0);
      });

      it('应该支持分页', async () => {
        const response = await request(app)
          .get('/api/coupon/my-coupons?page=1&limit=1')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.page).toBe(1);
      });
    });

    describe('GET /api/coupon/available-for-order', () => {
      beforeEach(async () => {
        // 创建可用的用户优惠券
        const userCoupon = new UserCoupon({
          userId: testUserId,
          couponId: testCouponId,
          couponCode: 'AVAILABLE001',
          status: 'available',
          expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        await userCoupon.save();
      });

      it('应该获取订单可用优惠券', async () => {
        const response = await request(app)
          .get('/api/coupon/available-for-order?amount=50&scenario=charging')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('应该验证必需参数', async () => {
        const response = await request(app)
          .get('/api/coupon/available-for-order')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/coupon/use', () => {
      let availableCouponCode: string;

      beforeEach(async () => {
        // 创建可用的用户优惠券
        const userCoupon = new UserCoupon({
          userId: testUserId,
          couponId: testCouponId,
          couponCode: 'USABLE001',
          status: 'available',
          expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        await userCoupon.save();
        availableCouponCode = userCoupon.couponCode;
      });

      it('应该成功使用优惠券', async () => {
        const usageData = {
          couponCode: availableCouponCode,
          orderId: 'ORDER123',
          orderAmount: 50,
          scenario: 'charging'
        };

        const response = await request(app)
          .post('/api/coupon/use')
          .set('Authorization', `Bearer ${authToken}`)
          .send(usageData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.discount).toBe(10); // 立减10元
        expect(response.body.data.finalAmount).toBe(40); // 50-10=40

        // 验证优惠券状态已更新
        const usedCoupon = await UserCoupon.findOne({
          couponCode: availableCouponCode
        });
        expect(usedCoupon.status).toBe('used');
        expect(usedCoupon.usedOrderId).toBe('ORDER123');
      });

      it('应该验证最小使用金额', async () => {
        const usageData = {
          couponCode: availableCouponCode,
          orderId: 'ORDER124',
          orderAmount: 15, // 小于最小金额20
          scenario: 'charging'
        };

        const response = await request(app)
          .post('/api/coupon/use')
          .set('Authorization', `Bearer ${authToken}`)
          .send(usageData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('满20元');
      });

      it('应该处理不存在的优惠券', async () => {
        const usageData = {
          couponCode: 'NONEXISTENT',
          orderId: 'ORDER125',
          orderAmount: 50,
          scenario: 'charging'
        };

        const response = await request(app)
          .post('/api/coupon/use')
          .set('Authorization', `Bearer ${authToken}`)
          .send(usageData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('不存在');
      });
    });

    describe('GET /api/coupon/stats', () => {
      it('应该获取优惠券统计信息', async () => {
        const response = await request(app)
          .get('/api/coupon/stats')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.totalCoupons).toBeDefined();
        expect(response.body.data.activeCoupons).toBeDefined();
        expect(response.body.data.usedCoupons).toBeDefined();
        expect(response.body.data.usageRate).toBeDefined();
      });

      it('应该支持时间范围参数', async () => {
        const response = await request(app)
          .get('/api/coupon/stats?timeRange=day')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Admin Functions', () => {
    describe('POST /api/coupon/admin/create', () => {
      it('应该成功创建优惠券', async () => {
        const couponData = {
          name: '管理员创建的优惠券',
          description: '测试创建优惠券',
          type: 'percentage',
          value: 20,
          minAmount: 100,
          maxDiscount: 50,
          validFrom: new Date().toISOString(),
          validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          totalQuantity: 500,
          applicableScenarios: ['charging', 'recharge']
        };

        const response = await request(app)
          .post('/api/coupon/admin/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send(couponData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.couponId).toBeDefined();

        // 验证数据库中的记录
        const createdCoupon = await Coupon.findOne({
          couponId: response.body.data.couponId
        });
        expect(createdCoupon).toBeTruthy();
        expect(createdCoupon.name).toBe(couponData.name);
      });

      it('应该验证时间逻辑', async () => {
        const invalidCouponData = {
          name: '无效时间优惠券',
          description: '测试时间验证',
          type: 'discount',
          value: 10,
          validFrom: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 明天
          validTo: new Date().toISOString(), // 今天
          totalQuantity: 100,
          applicableScenarios: ['charging']
        };

        const response = await request(app)
          .post('/api/coupon/admin/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidCouponData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('开始时间必须早于结束时间');
      });
    });

    describe('GET /api/coupon/admin/list', () => {
      it('应该获取优惠券管理列表', async () => {
        const response = await request(app)
          .get('/api/coupon/admin/list')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.coupons).toBeDefined();
        expect(response.body.data.total).toBeDefined();
      });
    });
  });
});