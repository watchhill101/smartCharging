import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import walletRoutes from '../routes/wallet';
import { WalletService } from '../services/WalletService';

// Mock dependencies
jest.mock('../services/WalletService');

const MockedWalletService = WalletService as jest.Mocked<typeof WalletService>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/wallet', walletRoutes);

// Mock JWT secret
process.env.JWT_SECRET = 'test-secret';

// Helper function to create auth token
const createAuthToken = (userId: string) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
};

describe('Wallet Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/wallet/info', () => {
    it('should get wallet info successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockWalletInfo = {
        balance: 100,
        frozenAmount: 10,
        availableBalance: 90,
        totalRecharge: 200,
        totalConsume: 100,
        paymentMethods: [],
        settings: {}
      };

      MockedWalletService.getWalletInfo = jest.fn().mockResolvedValue(mockWalletInfo);

      const response = await request(app)
        .get('/api/wallet/info')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockWalletInfo);
      expect(MockedWalletService.getWalletInfo).toHaveBeenCalledWith(userId);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/wallet/info');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/wallet/transactions', () => {
    it('should get transactions successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        transactions: [
          {
            id: 'trans1',
            type: 'recharge',
            amount: 100,
            status: 'completed',
            createdAt: new Date()
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      };

      MockedWalletService.getTransactions = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/wallet/transactions?type=recharge&page=1&limit=20')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(MockedWalletService.getTransactions).toHaveBeenCalledWith({
        userId,
        type: 'recharge',
        status: undefined,
        startDate: undefined,
        endDate: undefined,
        page: 1,
        limit: 20
      });
    });

    it('should validate query parameters', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const response = await request(app)
        .get('/api/wallet/transactions?type=invalid&page=0')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
    });
  });

  describe('POST /api/wallet/recharge', () => {
    it('should create recharge order successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        orderId: 'order123',
        transactionId: 'trans123',
        payUrl: 'https://pay.alipay.com/...',
        amount: 100,
        paymentMethod: 'alipay',
        status: 'pending'
      };

      MockedWalletService.createRechargeOrder = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          paymentMethod: 'alipay',
          description: '钱包充值'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(MockedWalletService.createRechargeOrder).toHaveBeenCalledWith({
        userId,
        amount: 100,
        paymentMethod: 'alipay',
        description: '钱包充值'
      });
    });

    it('should validate request body', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const response = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: -10,
          paymentMethod: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
    });

    it('should handle service errors', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedWalletService.createRechargeOrder = jest.fn().mockRejectedValue(
        new Error('充值金额必须大于0')
      );

      const response = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          paymentMethod: 'alipay'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/wallet/consume', () => {
    it('should consume balance successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        success: true,
        transactionId: 'trans123',
        message: '余额消费成功'
      };

      MockedWalletService.consumeBalance = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/wallet/consume')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 50,
          description: '充电支付',
          orderId: 'order123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBe('trans123');
      expect(MockedWalletService.consumeBalance).toHaveBeenCalledWith({
        userId,
        amount: 50,
        description: '充电支付',
        orderId: 'order123',
        sessionId: undefined
      });
    });

    it('should handle insufficient balance', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        success: false,
        message: '余额不足'
      };

      MockedWalletService.consumeBalance = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/wallet/consume')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 50,
          description: '充电支付'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('余额不足');
    });
  });

  describe('POST /api/wallet/freeze', () => {
    it('should freeze amount successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        success: true,
        message: '金额冻结成功'
      };

      MockedWalletService.freezeAmount = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/wallet/freeze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 30,
          reason: '充电预授权'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('金额冻结成功');
      expect(MockedWalletService.freezeAmount).toHaveBeenCalledWith(userId, 30, '充电预授权');
    });
  });

  describe('POST /api/wallet/unfreeze', () => {
    it('should unfreeze amount successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        success: true,
        message: '金额解冻成功'
      };

      MockedWalletService.unfreezeAmount = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/wallet/unfreeze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 30,
          reason: '充电完成'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('金额解冻成功');
      expect(MockedWalletService.unfreezeAmount).toHaveBeenCalledWith(userId, 30, '充电完成');
    });
  });

  describe('GET /api/wallet/balance-alert', () => {
    it('should get balance alert', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockAlert = {
        userId,
        currentBalance: 5,
        threshold: 10,
        alertType: 'low_balance',
        message: '账户余额较低（¥5），建议充值'
      };

      MockedWalletService.checkBalanceAndAlert = jest.fn().mockResolvedValue(mockAlert);

      const response = await request(app)
        .get('/api/wallet/balance-alert?threshold=10')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.alert).toEqual(mockAlert);
      expect(MockedWalletService.checkBalanceAndAlert).toHaveBeenCalledWith(userId, 10);
    });

    it('should return null if balance is sufficient', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedWalletService.checkBalanceAndAlert = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/wallet/balance-alert')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.alert).toBeNull();
    });
  });

  describe('GET /api/wallet/stats', () => {
    it('should get wallet statistics', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockStats = {
        currentBalance: 100,
        frozenAmount: 0,
        availableBalance: 100,
        stats: {
          totalRecharge: 200,
          totalConsume: 100,
          totalRefund: 0,
          totalWithdraw: 0,
          transactionCount: 3,
          rechargeCount: 2,
          consumeCount: 1,
          refundCount: 0,
          withdrawCount: 0
        },
        period: {
          startDate: undefined,
          endDate: undefined
        }
      };

      MockedWalletService.getWalletStats = jest.fn().mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/wallet/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(MockedWalletService.getWalletStats).toHaveBeenCalledWith(userId, undefined, undefined);
    });

    it('should handle date range parameters', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedWalletService.getWalletStats = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .get('/api/wallet/stats?startDate=2023-01-01T00:00:00.000Z&endDate=2023-12-31T23:59:59.999Z')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(MockedWalletService.getWalletStats).toHaveBeenCalledWith(
        userId,
        new Date('2023-01-01T00:00:00.000Z'),
        new Date('2023-12-31T23:59:59.999Z')
      );
    });

    it('should handle wallet not found', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedWalletService.getWalletStats = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/wallet/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('钱包不存在');
    });
  });

  describe('POST /api/wallet/invoice-info', () => {
    it('should add invoice info successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        success: true,
        message: '发票信息添加成功'
      };

      MockedWalletService.addInvoiceInfo = jest.fn().mockResolvedValue(mockResult);

      const invoiceInfo = {
        type: 'company',
        title: '测试公司',
        taxNumber: '123456789',
        email: 'test@company.com'
      };

      const response = await request(app)
        .post('/api/wallet/invoice-info')
        .set('Authorization', `Bearer ${token}`)
        .send(invoiceInfo);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('发票信息添加成功');
      expect(MockedWalletService.addInvoiceInfo).toHaveBeenCalledWith(userId, invoiceInfo);
    });

    it('should validate invoice info', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const response = await request(app)
        .post('/api/wallet/invoice-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'invalid',
          title: '',
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
    });
  });

  describe('POST /api/wallet/invoice', () => {
    it('should create invoice application successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        success: true,
        invoiceId: 'invoice123',
        message: '发票申请创建成功'
      };

      MockedWalletService.createInvoiceApplication = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/wallet/invoice')
        .set('Authorization', `Bearer ${token}`)
        .send({
          transactionIds: ['trans1', 'trans2'],
          type: 'electronic'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invoiceId).toBe('invoice123');
      expect(MockedWalletService.createInvoiceApplication).toHaveBeenCalledWith(
        userId,
        ['trans1', 'trans2'],
        'electronic'
      );
    });

    it('should validate transaction IDs', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const response = await request(app)
        .post('/api/wallet/invoice')
        .set('Authorization', `Bearer ${token}`)
        .send({
          transactionIds: [],
          type: 'electronic'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
    });
  });

  describe('POST /api/wallet/auto-recharge', () => {
    it('should set auto recharge successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        success: true,
        message: '自动充值已开启'
      };

      MockedWalletService.setAutoRecharge = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/wallet/auto-recharge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          enabled: true,
          threshold: 20,
          amount: 100
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('自动充值已开启');
      expect(MockedWalletService.setAutoRecharge).toHaveBeenCalledWith(userId, true, 20, 100);
    });

    it('should validate auto recharge parameters', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const response = await request(app)
        .post('/api/wallet/auto-recharge')
        .set('Authorization', `Bearer ${token}`)
        .send({
          enabled: 'invalid',
          threshold: -10
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
    });
  });
});