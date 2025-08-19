import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import paymentRoutes from '../routes/payment';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import Order from '../models/Order';
import User from '../models/User';
import ChargingSession from '../models/ChargingSession';
import { PaymentService } from '../services/PaymentService';

// Mock dependencies
jest.mock('../models/Order');
jest.mock('../models/User');
jest.mock('../models/ChargingSession');
jest.mock('../services/PaymentService');

const MockedOrder = Order as jest.Mocked<typeof Order>;
const MockedUser = User as jest.Mocked<typeof User>;
const MockedChargingSession = ChargingSession as jest.Mocked<typeof ChargingSession>;
const MockedPaymentService = PaymentService as jest.Mocked<typeof PaymentService>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/payments', paymentRoutes);

// Mock JWT secret
process.env.JWT_SECRET = 'test-secret';

// Helper function to create auth token
const createAuthToken = (userId: string) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
};

describe('Payment Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.API_BASE_URL = 'http://localhost:8080';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  describe('POST /api/payments/wallet/recharge', () => {
    it('should create alipay recharge order successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedPaymentService.validatePaymentParams = jest.fn().mockReturnValue({ valid: true });
      MockedPaymentService.createAlipayOrder = jest.fn().mockResolvedValue({
        success: true,
        orderId: 'RECHARGE_123456_user_ABC',
        payUrl: 'https://openapi.alipaydev.com/gateway.do?...',
        data: { amount: 100, type: 'recharge' }
      });

      const response = await request(app)
        .post('/api/payments/wallet/recharge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          paymentMethod: 'alipay'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.orderId).toBe('RECHARGE_123456_user_ABC');
      expect(response.body.data.payUrl).toBeDefined();
      expect(MockedPaymentService.validatePaymentParams).toHaveBeenCalledWith({
        userId,
        amount: 100,
        type: 'recharge'
      });
      expect(MockedPaymentService.createAlipayOrder).toHaveBeenCalled();
    });

    it('should reject invalid amount', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedPaymentService.validatePaymentParams = jest.fn().mockReturnValue({
        valid: false,
        message: '充值金额必须在1-1000元之间'
      });

      const response = await request(app)
        .post('/api/payments/wallet/recharge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 1500,
          paymentMethod: 'alipay'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('充值金额必须在1-1000元之间');
    });

    it('should reject balance payment for recharge', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedPaymentService.validatePaymentParams = jest.fn().mockReturnValue({ valid: true });

      const response = await request(app)
        .post('/api/payments/wallet/recharge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          paymentMethod: 'balance'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('钱包充值暂不支持余额支付');
    });

    it('should handle payment service error', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedPaymentService.validatePaymentParams = jest.fn().mockReturnValue({ valid: true });
      MockedPaymentService.createAlipayOrder = jest.fn().mockResolvedValue({
        success: false,
        orderId: '',
        message: '支付请求失败，请稍后重试'
      });

      const response = await request(app)
        .post('/api/payments/wallet/recharge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          paymentMethod: 'alipay'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('支付请求失败，请稍后重试');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/payments/wallet/recharge')
        .send({
          amount: 100,
          paymentMethod: 'alipay'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/payments/charging/pay', () => {
    it('should process balance payment successfully', async () => {
      const userId = 'user123';
      const sessionId = 'session123';
      const token = createAuthToken(userId);

      const mockSession = {
        sessionId,
        userId,
        status: 'completed',
        paymentStatus: 'pending',
        totalCost: 50,
        energyDelivered: 25
      };

      MockedChargingSession.findOne = jest.fn().mockResolvedValue(mockSession);
      MockedPaymentService.validatePaymentParams = jest.fn().mockReturnValue({ valid: true });
      MockedPaymentService.processBalancePayment = jest.fn().mockResolvedValue({
        success: true,
        orderId: 'CHARGE_123456_user_ABC',
        message: '余额支付成功',
        data: { remainingBalance: 50 }
      });

      const response = await request(app)
        .post('/api/payments/charging/pay')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sessionId,
          paymentMethod: 'balance'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('余额支付成功');
      expect(response.body.data.remainingBalance).toBe(50);
    });

    it('should create alipay payment successfully', async () => {
      const userId = 'user123';
      const sessionId = 'session123';
      const token = createAuthToken(userId);

      const mockSession = {
        sessionId,
        userId,
        status: 'completed',
        paymentStatus: 'pending',
        totalCost: 50,
        energyDelivered: 25
      };

      MockedChargingSession.findOne = jest.fn().mockResolvedValue(mockSession);
      MockedPaymentService.validatePaymentParams = jest.fn().mockReturnValue({ valid: true });
      MockedPaymentService.createAlipayOrder = jest.fn().mockResolvedValue({
        success: true,
        orderId: 'CHARGE_123456_user_ABC',
        payUrl: 'https://openapi.alipaydev.com/gateway.do?...',
        data: { amount: 50, type: 'charging' }
      });

      const response = await request(app)
        .post('/api/payments/charging/pay')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sessionId,
          paymentMethod: 'alipay'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.payUrl).toBeDefined();
    });

    it('should reject missing sessionId', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const response = await request(app)
        .post('/api/payments/charging/pay')
        .set('Authorization', `Bearer ${token}`)
        .send({
          paymentMethod: 'balance'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('充电会话ID不能为空');
    });

    it('should reject invalid charging session', async () => {
      const userId = 'user123';
      const sessionId = 'session123';
      const token = createAuthToken(userId);

      MockedChargingSession.findOne = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/payments/charging/pay')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sessionId,
          paymentMethod: 'balance'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('无效的充电会话或会话未完成');
    });

    it('should reject already paid session', async () => {
      const userId = 'user123';
      const sessionId = 'session123';
      const token = createAuthToken(userId);

      const mockSession = {
        sessionId,
        userId,
        status: 'completed',
        paymentStatus: 'paid',
        totalCost: 50
      };

      MockedChargingSession.findOne = jest.fn().mockResolvedValue(mockSession);

      const response = await request(app)
        .post('/api/payments/charging/pay')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sessionId,
          paymentMethod: 'balance'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('该充电会话已支付');
    });

    it('should reject unsupported payment method', async () => {
      const userId = 'user123';
      const sessionId = 'session123';
      const token = createAuthToken(userId);

      const mockSession = {
        sessionId,
        userId,
        status: 'completed',
        paymentStatus: 'pending',
        totalCost: 50
      };

      MockedChargingSession.findOne = jest.fn().mockResolvedValue(mockSession);
      MockedPaymentService.validatePaymentParams = jest.fn().mockReturnValue({ valid: true });

      const response = await request(app)
        .post('/api/payments/charging/pay')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sessionId,
          paymentMethod: 'wechat'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('不支持的支付方式');
    });
  });

  describe('POST /api/payments/alipay/notify', () => {
    it('should handle successful payment notification', async () => {
      MockedPaymentService.handleAlipayNotify = jest.fn().mockResolvedValue(true);

      const notifyParams = {
        out_trade_no: 'RECHARGE_123456_user_ABC',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '100.00',
        trade_no: 'alipay_trade_123'
      };

      const response = await request(app)
        .post('/api/payments/alipay/notify')
        .send(notifyParams);

      expect(response.status).toBe(200);
      expect(response.text).toBe('success');
      expect(MockedPaymentService.handleAlipayNotify).toHaveBeenCalledWith(notifyParams);
    });

    it('should handle failed payment notification', async () => {
      MockedPaymentService.handleAlipayNotify = jest.fn().mockResolvedValue(false);

      const notifyParams = {
        out_trade_no: 'INVALID_ORDER',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '100.00',
        trade_no: 'alipay_trade_123'
      };

      const response = await request(app)
        .post('/api/payments/alipay/notify')
        .send(notifyParams);

      expect(response.status).toBe(400);
      expect(response.text).toBe('error');
    });

    it('should handle service error', async () => {
      MockedPaymentService.handleAlipayNotify = jest.fn().mockRejectedValue(new Error('Service error'));

      const notifyParams = {
        out_trade_no: 'ORDER_123',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '100.00',
        trade_no: 'alipay_trade_123'
      };

      const response = await request(app)
        .post('/api/payments/alipay/notify')
        .send(notifyParams);

      expect(response.status).toBe(500);
      expect(response.text).toBe('error');
    });
  });

  describe('GET /api/payments/orders/:orderId', () => {
    it('should get order details successfully', async () => {
      const userId = 'user123';
      const orderId = 'ORDER_123';
      const token = createAuthToken(userId);

      const mockOrder = {
        orderId,
        userId,
        type: 'charging',
        amount: 50,
        status: 'paid',
        sessionId: {
          sessionId: 'session123',
          energyDelivered: 25,
          duration: 1800,
          totalCost: 50
        },
        userId: {
          nickName: 'TestUser',
          phone: '13800138000'
        }
      };

      MockedOrder.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockOrder)
        })
      });

      const response = await request(app)
        .get(`/api/payments/orders/${orderId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.order.orderId).toBe(orderId);
    });

    it('should handle order not found', async () => {
      const userId = 'user123';
      const orderId = 'NONEXISTENT';
      const token = createAuthToken(userId);

      MockedOrder.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null)
        })
      });

      const response = await request(app)
        .get(`/api/payments/orders/${orderId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('订单不存在');
    });
  });

  describe('POST /api/payments/orders/:orderId/cancel', () => {
    it('should cancel order successfully', async () => {
      const userId = 'user123';
      const orderId = 'ORDER_123';
      const token = createAuthToken(userId);

      MockedPaymentService.cancelOrder = jest.fn().mockResolvedValue({
        success: true,
        orderId,
        message: '订单取消成功'
      });

      const response = await request(app)
        .post(`/api/payments/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: '用户取消' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('订单取消成功');
      expect(MockedPaymentService.cancelOrder).toHaveBeenCalledWith(orderId, userId, '用户取消');
    });

    it('should handle cancel order failure', async () => {
      const userId = 'user123';
      const orderId = 'ORDER_123';
      const token = createAuthToken(userId);

      MockedPaymentService.cancelOrder = jest.fn().mockResolvedValue({
        success: false,
        orderId,
        message: '已支付的订单无法取消'
      });

      const response = await request(app)
        .post(`/api/payments/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: '用户取消' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('已支付的订单无法取消');
    });
  });

  describe('GET /api/payments/wallet/balance', () => {
    it('should get wallet balance successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockUser = {
        _id: userId,
        balance: 150.50
      };

      MockedUser.findById = jest.fn().mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/payments/wallet/balance')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe(150.50);
      expect(response.body.data.userId).toBe(userId);
    });

    it('should handle user not found', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedUser.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/payments/wallet/balance')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('用户不存在');
    });
  });
});