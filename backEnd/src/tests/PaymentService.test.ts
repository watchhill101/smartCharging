import { PaymentService } from '../services/PaymentService';
import Order from '../models/Order';
import User from '../models/User';
import ChargingSession from '../models/ChargingSession';
import { alipaySdk } from '../config/alipay';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../models/Order');
jest.mock('../models/User');
jest.mock('../models/ChargingSession');
jest.mock('../config/alipay');

const MockedOrder = Order as jest.Mocked<typeof Order>;
const MockedUser = User as jest.Mocked<typeof User>;
const MockedChargingSession = ChargingSession as jest.Mocked<typeof ChargingSession>;
const mockedAlipaySdk = alipaySdk as jest.Mocked<typeof alipaySdk>;

describe('PaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.API_BASE_URL = 'http://localhost:8080';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  describe('validatePaymentParams', () => {
    it('should validate correct payment parameters', () => {
      const params = {
        userId: 'user123',
        amount: 50,
        type: 'charging' as const
      };

      const result = PaymentService.validatePaymentParams(params);
      expect(result.valid).toBe(true);
    });

    it('should reject empty userId', () => {
      const params = {
        userId: '',
        amount: 50,
        type: 'charging' as const
      };

      const result = PaymentService.validatePaymentParams(params);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('用户ID不能为空');
    });

    it('should reject invalid amount', () => {
      const params = {
        userId: 'user123',
        amount: 0,
        type: 'charging' as const
      };

      const result = PaymentService.validatePaymentParams(params);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('支付金额必须大于0');
    });

    it('should reject recharge amount out of range', () => {
      const params = {
        userId: 'user123',
        amount: 1500,
        type: 'recharge' as const
      };

      const result = PaymentService.validatePaymentParams(params);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('充值金额必须在1-1000元之间');
    });

    it('should reject charging amount too high', () => {
      const params = {
        userId: 'user123',
        amount: 600,
        type: 'charging' as const
      };

      const result = PaymentService.validatePaymentParams(params);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('单次充电费用不能超过500元');
    });

    it('should reject invalid payment type', () => {
      const params = {
        userId: 'user123',
        amount: 50,
        type: 'invalid' as any
      };

      const result = PaymentService.validatePaymentParams(params);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('无效的支付类型');
    });
  });

  describe('createAlipayOrder', () => {
    it('should create alipay order successfully', async () => {
      const mockOrder = {
        orderId: 'RECHARGE_123456_user_ABC',
        save: jest.fn().mockResolvedValue(true)
      };

      MockedOrder.prototype.constructor = jest.fn().mockReturnValue(mockOrder);
      mockedAlipaySdk.pageExec = jest.fn().mockResolvedValue('https://openapi.alipaydev.com/gateway.do?...');

      const params = {
        userId: 'user123',
        amount: 100,
        type: 'recharge' as const,
        description: '钱包充值 ¥100'
      };

      const result = await PaymentService.createAlipayOrder(params);

      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(result.payUrl).toBeDefined();
      expect(mockOrder.save).toHaveBeenCalled();
      expect(mockedAlipaySdk.pageExec).toHaveBeenCalledWith('alipay.trade.page.pay', expect.any(Object));
    });

    it('should handle invalid amount', async () => {
      const params = {
        userId: 'user123',
        amount: 0,
        type: 'recharge' as const
      };

      const result = await PaymentService.createAlipayOrder(params);

      expect(result.success).toBe(false);
      expect(result.message).toBe('支付金额必须大于0');
    });

    it('should handle charging session validation for charging payment', async () => {
      MockedChargingSession.findOne = jest.fn().mockResolvedValue(null);

      const params = {
        userId: 'user123',
        amount: 50,
        type: 'charging' as const,
        sessionId: 'session123'
      };

      const result = await PaymentService.createAlipayOrder(params);

      expect(result.success).toBe(false);
      expect(result.message).toBe('无效的充电会话或会话未完成');
    });

    it('should handle already paid charging session', async () => {
      const mockSession = {
        sessionId: 'session123',
        userId: 'user123',
        status: 'completed',
        paymentStatus: 'paid'
      };

      MockedChargingSession.findOne = jest.fn().mockResolvedValue(mockSession);

      const params = {
        userId: 'user123',
        amount: 50,
        type: 'charging' as const,
        sessionId: 'session123'
      };

      const result = await PaymentService.createAlipayOrder(params);

      expect(result.success).toBe(false);
      expect(result.message).toBe('该充电会话已支付');
    });

    it('should handle alipay API error', async () => {
      const mockOrder = {
        orderId: 'RECHARGE_123456_user_ABC',
        save: jest.fn().mockResolvedValue(true)
      };

      MockedOrder.prototype.constructor = jest.fn().mockReturnValue(mockOrder);
      mockedAlipaySdk.pageExec = jest.fn().mockRejectedValue(new Error('Alipay API Error'));

      const params = {
        userId: 'user123',
        amount: 100,
        type: 'recharge' as const
      };

      const result = await PaymentService.createAlipayOrder(params);

      expect(result.success).toBe(false);
      expect(result.message).toBe('支付请求失败，请稍后重试');
    });
  });

  describe('processBalancePayment', () => {
    const mockSession: any;

    beforeEach(() => {
      mockSession = {
        withTransaction: jest.fn(),
        endSession: jest.fn()
      };
      
      (mongoose.startSession as jest.Mock) = jest.fn().mockResolvedValue(mockSession);
    });

    it('should process balance payment successfully', async () => {
      const mockChargingSession = {
        sessionId: 'session123',
        userId: 'user123',
        status: 'completed',
        paymentStatus: 'pending'
      };

      const mockUser = {
        _id: 'user123',
        balance: 100
      };

      const mockUpdatedUser = {
        _id: 'user123',
        balance: 50
      };

      const mockOrder = {
        orderId: 'CHARGE_123456_user_ABC',
        save: jest.fn().mockResolvedValue(true)
      };

      mockSession.withTransaction.mockImplementation(async (callback: () => Promise<any>) => {
        MockedChargingSession.findOne = jest.fn().mockResolvedValue(mockChargingSession);
        MockedUser.findById = jest.fn().mockResolvedValue(mockUser);
        MockedUser.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUpdatedUser);
        MockedChargingSession.findOneAndUpdate = jest.fn().mockResolvedValue(true);
        MockedOrder.prototype.constructor = jest.fn().mockReturnValue(mockOrder);

        return await callback();
      });

      const params = {
        userId: 'user123',
        amount: 50,
        type: 'charging' as const,
        sessionId: 'session123'
      };

      const result = await PaymentService.processBalancePayment(params);

      expect(result.success).toBe(true);
      expect(result.message).toBe('余额支付成功');
      expect(result.data?.remainingBalance).toBe(50);
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should handle insufficient balance', async () => {
      const mockChargingSession = {
        sessionId: 'session123',
        userId: 'user123',
        status: 'completed',
        paymentStatus: 'pending'
      };

      const mockUser = {
        _id: 'user123',
        balance: 30
      };

      mockSession.withTransaction.mockImplementation(async (callback: () => Promise<any>) => {
        MockedChargingSession.findOne = jest.fn().mockResolvedValue(mockChargingSession);
        MockedUser.findById = jest.fn().mockResolvedValue(mockUser);

        return await callback();
      });

      const params = {
        userId: 'user123',
        amount: 50,
        type: 'charging' as const,
        sessionId: 'session123'
      };

      const result = await PaymentService.processBalancePayment(params);

      expect(result.success).toBe(false);
      expect(result.message).toContain('余额不足');
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should handle user not found', async () => {
      mockSession.withTransaction.mockImplementation(async (callback: () => Promise<any>) => {
        MockedUser.findById = jest.fn().mockResolvedValue(null);

        return await callback();
      });

      const params = {
        userId: 'user123',
        amount: 50,
        type: 'recharge' as const
      };

      const result = await PaymentService.processBalancePayment(params);

      expect(result.success).toBe(false);
      expect(result.message).toBe('用户不存在');
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('handleAlipayNotify', () => {
    it('should handle successful payment notification', async () => {
      const mockOrder = {
        _id: 'order123',
        orderId: 'RECHARGE_123456_user_ABC',
        amount: 100,
        type: 'recharge',
        userId: 'user123',
        status: 'pending',
        metadata: {}
      };

      const mockUser = {
        _id: 'user123',
        nickName: 'TestUser',
        balance: 200
      };

      const mockSession: any;
      mockSession = {
        withTransaction: jest.fn(),
        endSession: jest.fn()
      };

      (mongoose.startSession as jest.Mock) = jest.fn().mockResolvedValue(mockSession);

      mockSession.withTransaction.mockImplementation(async (callback: () => Promise<any>) => {
        MockedOrder.findOne = jest.fn().mockResolvedValue(mockOrder);
        MockedOrder.findByIdAndUpdate = jest.fn().mockResolvedValue(true);
        MockedUser.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUser);

        return await callback();
      });

      mockedAlipaySdk.checkNotifySign = jest.fn().mockReturnValue(true);

      const params = {
        out_trade_no: 'RECHARGE_123456_user_ABC',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '100.00',
        trade_no: 'alipay_trade_123'
      };

      const result = await PaymentService.handleAlipayNotify(params);

      expect(result).toBe(true);
      expect(mockedAlipaySdk.checkNotifySign).toHaveBeenCalledWith(params);
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should reject invalid signature', async () => {
      mockedAlipaySdk.checkNotifySign = jest.fn().mockReturnValue(false);

      const params = {
        out_trade_no: 'RECHARGE_123456_user_ABC',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '100.00',
        trade_no: 'alipay_trade_123'
      };

      const result = await PaymentService.handleAlipayNotify(params);

      expect(result).toBe(false);
      expect(mockedAlipaySdk.checkNotifySign).toHaveBeenCalledWith(params);
    });

    it('should handle order not found', async () => {
      mockedAlipaySdk.checkNotifySign = jest.fn().mockReturnValue(true);
      MockedOrder.findOne = jest.fn().mockResolvedValue(null);

      const params = {
        out_trade_no: 'NONEXISTENT_ORDER',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '100.00',
        trade_no: 'alipay_trade_123'
      };

      const result = await PaymentService.handleAlipayNotify(params);

      expect(result).toBe(true); // Returns true to avoid repeated notifications
    });

    it('should handle amount mismatch', async () => {
      const mockOrder = {
        orderId: 'RECHARGE_123456_user_ABC',
        amount: 100,
        status: 'pending'
      };

      mockedAlipaySdk.checkNotifySign = jest.fn().mockReturnValue(true);
      MockedOrder.findOne = jest.fn().mockResolvedValue(mockOrder);

      const params = {
        out_trade_no: 'RECHARGE_123456_user_ABC',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '200.00', // Different amount
        trade_no: 'alipay_trade_123'
      };

      const result = await PaymentService.handleAlipayNotify(params);

      expect(result).toBe(false);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel pending order successfully', async () => {
      const mockOrder = {
        orderId: 'ORDER_123',
        userId: 'user123',
        status: 'pending',
        markAsCancelled: jest.fn().mockResolvedValue(true)
      };

      MockedOrder.findOne = jest.fn().mockResolvedValue(mockOrder);

      const result = await PaymentService.cancelOrder('ORDER_123', 'user123', '用户取消');

      expect(result.success).toBe(true);
      expect(result.message).toBe('订单取消成功');
      expect(mockOrder.markAsCancelled).toHaveBeenCalledWith('用户取消');
    });

    it('should handle order not found', async () => {
      MockedOrder.findOne = jest.fn().mockResolvedValue(null);

      const result = await PaymentService.cancelOrder('NONEXISTENT', 'user123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('订单不存在');
    });

    it('should handle already paid order', async () => {
      const mockOrder = {
        orderId: 'ORDER_123',
        userId: 'user123',
        status: 'paid'
      };

      MockedOrder.findOne = jest.fn().mockResolvedValue(mockOrder);

      const result = await PaymentService.cancelOrder('ORDER_123', 'user123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('已支付的订单无法取消');
    });

    it('should handle already cancelled order', async () => {
      const mockOrder = {
        orderId: 'ORDER_123',
        userId: 'user123',
        status: 'cancelled'
      };

      MockedOrder.findOne = jest.fn().mockResolvedValue(mockOrder);

      const result = await PaymentService.cancelOrder('ORDER_123', 'user123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('订单已取消');
    });
  });

  describe('queryAlipayOrder', () => {
    it('should query alipay order successfully', async () => {
      const mockResult = {
        code: '10000',
        msg: 'Success',
        trade_status: 'TRADE_SUCCESS'
      };

      mockedAlipaySdk.exec = jest.fn().mockResolvedValue(mockResult);

      const result = await PaymentService.queryAlipayOrder('ORDER_123');

      expect(result).toEqual(mockResult);
      expect(mockedAlipaySdk.exec).toHaveBeenCalledWith('alipay.trade.query', {
        bizContent: {
          out_trade_no: 'ORDER_123'
        }
      });
    });

    it('should handle alipay query error', async () => {
      mockedAlipaySdk.exec = jest.fn().mockRejectedValue(new Error('Query failed'));

      await expect(PaymentService.queryAlipayOrder('ORDER_123')).rejects.toThrow('Query failed');
    });
  });
});