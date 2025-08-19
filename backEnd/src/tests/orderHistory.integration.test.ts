import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import orderHistoryRoutes from '../routes/orderHistory';
import { authenticate } from '../middleware/auth';
import Order from '../models/Order';
import ChargingSession from '../models/ChargingSession';
import User from '../models/User';

// Mock authenticate middleware
jest.mock('../middleware/auth');
const mockedAuthenticate = authenticate as jest.MockedFunction<typeof authenticate>;

// Mock Redis service
jest.mock('../services/RedisService', () => ({
  RedisService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([])
  }))
}));

const app = express();
app.use(express.json());
app.use('/api/orders', orderHistoryRoutes);

describe('Order History Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testUserId: string;
  let testOrderId: string;
  let testSessionId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Mock authenticate middleware
    mockedAuthenticate.mockImplementation((req: any, res, next) => {
      req.user = { id: testUserId };
      next();
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await Order.deleteMany({});
    await ChargingSession.deleteMany({});
    await User.deleteMany({});

    // Create test user
    const testUser = new User({
      phone: '13800138000',
      nickName: '测试用户',
      balance: 100
    });
    await testUser.save();
    testUserId = testUser._id.toString();

    // Create test charging session
    const testSession = new ChargingSession({
      sessionId: 'SESSION123',
      userId: testUserId,
      stationId: new mongoose.Types.ObjectId(),
      chargerId: 'CHARGER001',
      status: 'completed',
      startTime: new Date('2023-01-01T10:00:00Z'),
      endTime: new Date('2023-01-01T11:00:00Z'),
      duration: 3600,
      energyDelivered: 25.5,
      totalCost: 50.00,
      paymentStatus: 'paid'
    });
    await testSession.save();
    testSessionId = testSession._id.toString();

    // Create test order
    const testOrder = new Order({
      orderId: 'ORD123456789',
      userId: testUserId,
      type: 'charging',
      amount: 50.00,
      status: 'paid',
      paymentMethod: 'balance',
      sessionId: testSessionId,
      description: '充电费用'
    });
    await testOrder.save();
    testOrderId = testOrder.orderId;
  });

  describe('GET /api/orders/history', () => {
    it('should get order history successfully', async () => {
      const response = await request(app)
        .get('/api/orders/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
      expect(response.body.data.orders[0].orderId).toBe(testOrderId);
      expect(response.body.data.orders[0].type).toBe('charging');
      expect(response.body.data.orders[0].amount).toBe(50.00);
      expect(response.body.data.orders[0].status).toBe('paid');
      expect(response.body.data.orders[0].session).toBeDefined();
      expect(response.body.data.orders[0].session.sessionId).toBe('SESSION123');

      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.total).toBe(1);
      expect(response.body.data.statistics).toBeDefined();
    });

    it('should filter orders by type', async () => {
      // Create a recharge order
      const rechargeOrder = new Order({
        orderId: 'ORD987654321',
        userId: testUserId,
        type: 'recharge',
        amount: 100.00,
        status: 'paid',
        paymentMethod: 'alipay',
        description: '账户充值'
      });
      await rechargeOrder.save();

      const response = await request(app)
        .get('/api/orders/history?type=charging')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
      expect(response.body.data.orders[0].type).toBe('charging');
    });

    it('should filter orders by status', async () => {
      // Create a pending order
      const pendingOrder = new Order({
        orderId: 'ORD111111111',
        userId: testUserId,
        type: 'charging',
        amount: 30.00,
        status: 'pending',
        paymentMethod: 'balance',
        description: '待支付订单'
      });
      await pendingOrder.save();

      const response = await request(app)
        .get('/api/orders/history?status=paid')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
      expect(response.body.data.orders[0].status).toBe('paid');
    });

    it('should filter orders by date range', async () => {
      const startDate = '2023-01-01T00:00:00Z';
      const endDate = '2023-01-01T23:59:59Z';

      const response = await request(app)
        .get(`/api/orders/history?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
    });

    it('should search orders by keyword', async () => {
      const response = await request(app)
        .get('/api/orders/history?keyword=ORD123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
      expect(response.body.data.orders[0].orderId).toContain('ORD123');
    });

    it('should handle pagination', async () => {
      // Create additional orders
      for (let i = 0; i < 5; i++) {
        const order = new Order({
          orderId: `ORD${Date.now()}${i}`,
          userId: testUserId,
          type: 'charging',
          amount: 25.00,
          status: 'paid',
          paymentMethod: 'balance',
          description: `订单${i}`
        });
        await order.save();
      }

      const response = await request(app)
        .get('/api/orders/history?page=1&limit=3')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(3);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(3);
      expect(response.body.data.pagination.total).toBe(6);
      expect(response.body.data.pagination.totalPages).toBe(2);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/orders/history?type=invalid&page=0')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/orders/:orderId', () => {
    it('should get order detail successfully', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrderId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.orderId).toBe(testOrderId);
      expect(response.body.data.order.type).toBe('charging');
      expect(response.body.data.order.amount).toBe(50.00);
      expect(response.body.data.order.session).toBeDefined();
      expect(response.body.data.order.session.sessionId).toBe('SESSION123');
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get('/api/orders/NONEXISTENT')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('订单不存在');
    });

    it('should include related orders', async () => {
      // Create a related order with the same session
      const relatedOrder = new Order({
        orderId: 'ORD999999999',
        userId: testUserId,
        type: 'recharge',
        amount: 100.00,
        status: 'paid',
        paymentMethod: 'alipay',
        sessionId: testSessionId,
        description: '相关订单'
      });
      await relatedOrder.save();

      const response = await request(app)
        .get(`/api/orders/${testOrderId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.relatedOrders).toBeDefined();
      expect(response.body.data.relatedOrders).toHaveLength(1);
      expect(response.body.data.relatedOrders[0].orderId).toBe('ORD999999999');
    });
  });

  describe('GET /api/orders/search', () => {
    it('should search orders successfully', async () => {
      const response = await request(app)
        .get('/api/orders/search?keyword=ORD123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
      expect(response.body.data.orders[0].orderId).toBe(testOrderId);
    });

    it('should handle empty search results', async () => {
      const response = await request(app)
        .get('/api/orders/search?keyword=NOTFOUND')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it('should validate search parameters', async () => {
      const response = await request(app)
        .get('/api/orders/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
    });
  });

  describe('GET /api/orders/statistics', () => {
    it('should get order statistics successfully', async () => {
      const response = await request(app)
        .get('/api/orders/statistics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics).toBeDefined();
      expect(response.body.data.statistics.totalOrders).toBe(1);
      expect(response.body.data.statistics.totalAmount).toBe(50.00);
      expect(response.body.data.statistics.paidOrders).toBe(1);
      expect(response.body.data.statistics.chargingOrders).toBe(1);
      expect(response.body.data.statistics.rechargeOrders).toBe(0);
    });

    it('should filter statistics by date range', async () => {
      const startDate = '2023-01-01T00:00:00Z';
      const endDate = '2023-01-01T23:59:59Z';

      const response = await request(app)
        .get(`/api/orders/statistics?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics.totalOrders).toBe(1);
    });
  });

  describe('POST /api/orders/export', () => {
    it('should export orders successfully', async () => {
      const response = await request(app)
        .post('/api/orders/export')
        .send({
          format: 'csv'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.downloadUrl).toBeDefined();
      expect(response.body.data.fileName).toBeDefined();
    });

    it('should validate export parameters', async () => {
      const response = await request(app)
        .post('/api/orders/export')
        .send({
          format: 'invalid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
    });

    it('should handle empty order list for export', async () => {
      // Delete all orders
      await Order.deleteMany({});

      const response = await request(app)
        .post('/api/orders/export')
        .send({
          format: 'csv'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('没有找到符合条件的订单数据');
    });
  });

  describe('GET /api/orders/filter-options', () => {
    it('should get filter options successfully', async () => {
      const response = await request(app)
        .get('/api/orders/filter-options')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filterOptions).toBeDefined();
      expect(response.body.data.filterOptions.types).toBeDefined();
      expect(response.body.data.filterOptions.statuses).toBeDefined();
      expect(response.body.data.filterOptions.paymentMethods).toBeDefined();
      expect(response.body.data.filterOptions.exportFormats).toBeDefined();
    });
  });

  describe('DELETE /api/orders/cache', () => {
    it('should clear order cache successfully', async () => {
      const response = await request(app)
        .delete('/api/orders/cache')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('订单缓存清除成功');
    });
  });
});