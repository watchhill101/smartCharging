import { WalletService } from '../services/WalletService';
import Wallet from '../models/Wallet';
import User from '../models/User';
import { PaymentService } from '../services/PaymentService';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../models/Wallet');
jest.mock('../models/User');
jest.mock('../services/PaymentService');

const MockedWallet = Wallet as jest.Mocked<typeof Wallet>;
const MockedUser = User as jest.Mocked<typeof User>;
const MockedPaymentService = PaymentService as jest.Mocked<typeof PaymentService>;

describe('WalletService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateWallet', () => {
    it('should return existing wallet', async () => {
      const mockWallet = {
        userId: 'user123',
        balance: 100,
        frozenAmount: 0,
        getAvailableBalance: jest.fn().mockReturnValue(100)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await WalletService.getOrCreateWallet('user123');

      expect(result).toEqual(mockWallet);
      expect(MockedWallet.findOne).toHaveBeenCalledWith({ userId: 'user123' });
    });

    it('should create new wallet if not exists', async () => {
      const mockWallet = {
        userId: 'user123',
        balance: 0,
        frozenAmount: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(null);
      (MockedWallet as any).createDefaultWallet = jest.fn().mockReturnValue(mockWallet);

      const result = await WalletService.getOrCreateWallet('user123');

      expect(result).toEqual(mockWallet);
      expect(mockWallet.save).toHaveBeenCalled();
    });
  });

  describe('getWalletInfo', () => {
    it('should return wallet information', async () => {
      const mockWallet = {
        balance: 100,
        frozenAmount: 10,
        totalRecharge: 200,
        totalConsume: 100,
        paymentMethods: [],
        settings: {},
        getAvailableBalance: jest.fn().mockReturnValue(90)
      };

      jest.spyOn(WalletService, 'getOrCreateWallet').mockResolvedValue(mockWallet as any);

      const result = await WalletService.getWalletInfo('user123');

      expect(result).toEqual({
        balance: 100,
        frozenAmount: 10,
        availableBalance: 90,
        totalRecharge: 200,
        totalConsume: 100,
        paymentMethods: [],
        settings: {}
      });
    });
  });

  describe('getTransactions', () => {
    it('should return filtered and paginated transactions', async () => {
      const mockTransactions = [
        {
          id: '1',
          type: 'recharge',
          amount: 100,
          status: 'completed',
          createdAt: new Date('2023-01-02')
        },
        {
          id: '2',
          type: 'consume',
          amount: 50,
          status: 'completed',
          createdAt: new Date('2023-01-01')
        }
      ];

      const mockWallet = {
        transactions: mockTransactions
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await WalletService.getTransactions({
        userId: 'user123',
        type: 'recharge',
        page: 1,
        limit: 10
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].type).toBe('recharge');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      });
    });

    it('should return empty result if wallet not found', async () => {
      MockedWallet.findOne = jest.fn().mockResolvedValue(null);

      const result = await WalletService.getTransactions({
        userId: 'user123',
        page: 1,
        limit: 10
      });

      expect(result.transactions).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('createRechargeOrder', () => {
    it('should create recharge order successfully', async () => {
      const mockWallet = {
        addTransaction: jest.fn().mockReturnValue({ id: 'trans123' }),
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(WalletService, 'getOrCreateWallet').mockResolvedValue(mockWallet as any);
      MockedPaymentService.createAlipayOrder = jest.fn().mockResolvedValue({
        success: true,
        orderId: 'order123',
        payUrl: 'https://pay.alipay.com/...'
      });

      const result = await WalletService.createRechargeOrder({
        userId: 'user123',
        amount: 100,
        paymentMethod: 'alipay'
      });

      expect(result.orderId).toBe('order123');
      expect(result.payUrl).toBe('https://pay.alipay.com/...');
      expect(mockWallet.addTransaction).toHaveBeenCalled();
      expect(mockWallet.save).toHaveBeenCalled();
    });

    it('should throw error for invalid amount', async () => {
      await expect(WalletService.createRechargeOrder({
        userId: 'user123',
        amount: 0,
        paymentMethod: 'alipay'
      })).rejects.toThrow('充值金额必须大于0');
    });

    it('should throw error for amount too large', async () => {
      await expect(WalletService.createRechargeOrder({
        userId: 'user123',
        amount: 15000,
        paymentMethod: 'alipay'
      })).rejects.toThrow('单次充值金额不能超过10000元');
    });
  });

  describe('consumeBalance', () => {
    let mockSession: any;

    beforeEach(() => {
      mockSession = {
        withTransaction: jest.fn(),
        endSession: jest.fn()
      };
      
      (mongoose.startSession as jest.Mock) = jest.fn().mockResolvedValue(mockSession);
    });

    it('should consume balance successfully', async () => {
      const mockWallet = {
        getAvailableBalance: jest.fn().mockReturnValue(100),
        balance: 100,
        totalConsume: 0,
        addTransaction: jest.fn().mockReturnValue({ id: 'trans123' }),
        save: jest.fn().mockResolvedValue(true)
      };

      mockSession.withTransaction.mockImplementation(async (callback: Function) => {
        MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);
        return await callback();
      });

      const result = await WalletService.consumeBalance({
        userId: 'user123',
        amount: 50,
        description: '充电支付'
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('trans123');
      expect(mockWallet.balance).toBe(50);
      expect(mockWallet.totalConsume).toBe(50);
    });

    it('should fail if insufficient balance', async () => {
      const mockWallet = {
        getAvailableBalance: jest.fn().mockReturnValue(30)
      };

      mockSession.withTransaction.mockImplementation(async (callback: Function) => {
        MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);
        return await callback();
      });

      const result = await WalletService.consumeBalance({
        userId: 'user123',
        amount: 50,
        description: '充电支付'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('余额不足');
    });

    it('should fail if wallet not found', async () => {
      mockSession.withTransaction.mockImplementation(async (callback: Function) => {
        MockedWallet.findOne = jest.fn().mockResolvedValue(null);
        return await callback();
      });

      const result = await WalletService.consumeBalance({
        userId: 'user123',
        amount: 50,
        description: '充电支付'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('钱包不存在');
    });
  });

  describe('rechargeBalance', () => {
    let mockSession: any;

    beforeEach(() => {
      mockSession = {
        withTransaction: jest.fn(),
        endSession: jest.fn()
      };
      
      (mongoose.startSession as jest.Mock) = jest.fn().mockResolvedValue(mockSession);
    });

    it('should recharge balance successfully', async () => {
      const mockTransaction = {
        orderId: 'order123',
        status: 'pending',
        updatedAt: new Date()
      };

      const mockWallet = {
        balance: 100,
        totalRecharge: 100,
        transactions: [mockTransaction],
        addTransaction: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      };

      mockSession.withTransaction.mockImplementation(async (callback: Function) => {
        MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);
        MockedUser.findByIdAndUpdate = jest.fn().mockResolvedValue(true);
        return await callback();
      });

      await WalletService.rechargeBalance('user123', 50, 'order123', 'alipay');

      expect(mockWallet.balance).toBe(150);
      expect(mockWallet.totalRecharge).toBe(150);
      expect(mockTransaction.status).toBe('completed');
      expect(mockWallet.save).toHaveBeenCalled();
      expect(MockedUser.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { balance: 150 },
        { session: mockSession }
      );
    });

    it('should create new transaction if not found', async () => {
      const mockWallet = {
        balance: 100,
        totalRecharge: 100,
        transactions: [],
        addTransaction: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      };

      mockSession.withTransaction.mockImplementation(async (callback: Function) => {
        MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);
        MockedUser.findByIdAndUpdate = jest.fn().mockResolvedValue(true);
        return await callback();
      });

      await WalletService.rechargeBalance('user123', 50, 'order123', 'alipay');

      expect(mockWallet.addTransaction).toHaveBeenCalledWith({
        type: 'recharge',
        amount: 50,
        description: 'alipay充值',
        orderId: 'order123',
        paymentMethod: 'alipay',
        status: 'completed'
      });
    });
  });

  describe('checkBalanceAndAlert', () => {
    it('should return insufficient balance alert', async () => {
      const mockWallet = {
        getAvailableBalance: jest.fn().mockReturnValue(0)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await WalletService.checkBalanceAndAlert('user123', 10);

      expect(result).toEqual({
        userId: 'user123',
        currentBalance: 0,
        threshold: 10,
        alertType: 'insufficient_balance',
        message: '账户余额不足，请及时充值'
      });
    });

    it('should return low balance alert', async () => {
      const mockWallet = {
        getAvailableBalance: jest.fn().mockReturnValue(5)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await WalletService.checkBalanceAndAlert('user123', 10);

      expect(result).toEqual({
        userId: 'user123',
        currentBalance: 5,
        threshold: 10,
        alertType: 'low_balance',
        message: '账户余额较低（¥5），建议充值'
      });
    });

    it('should return null if balance is sufficient', async () => {
      const mockWallet = {
        getAvailableBalance: jest.fn().mockReturnValue(50)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await WalletService.checkBalanceAndAlert('user123', 10);

      expect(result).toBeNull();
    });

    it('should return null if wallet not found', async () => {
      MockedWallet.findOne = jest.fn().mockResolvedValue(null);

      const result = await WalletService.checkBalanceAndAlert('user123', 10);

      expect(result).toBeNull();
    });
  });

  describe('getWalletStats', () => {
    it('should return wallet statistics', async () => {
      const mockTransactions = [
        {
          type: 'recharge',
          amount: 100,
          status: 'completed',
          createdAt: new Date('2023-01-01')
        },
        {
          type: 'consume',
          amount: 50,
          status: 'completed',
          createdAt: new Date('2023-01-02')
        },
        {
          type: 'refund',
          amount: 10,
          status: 'completed',
          createdAt: new Date('2023-01-03')
        }
      ];

      const mockWallet = {
        balance: 60,
        frozenAmount: 0,
        transactions: mockTransactions,
        getAvailableBalance: jest.fn().mockReturnValue(60)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await WalletService.getWalletStats('user123');

      expect(result).toEqual({
        currentBalance: 60,
        frozenAmount: 0,
        availableBalance: 60,
        stats: {
          totalRecharge: 100,
          totalConsume: 50,
          totalRefund: 10,
          totalWithdraw: 0,
          transactionCount: 3,
          rechargeCount: 1,
          consumeCount: 1,
          refundCount: 1,
          withdrawCount: 0
        },
        period: {
          startDate: undefined,
          endDate: undefined
        }
      });
    });

    it('should filter transactions by date range', async () => {
      const mockTransactions = [
        {
          type: 'recharge',
          amount: 100,
          status: 'completed',
          createdAt: new Date('2023-01-01')
        },
        {
          type: 'consume',
          amount: 50,
          status: 'completed',
          createdAt: new Date('2023-01-15')
        }
      ];

      const mockWallet = {
        balance: 50,
        frozenAmount: 0,
        transactions: mockTransactions,
        getAvailableBalance: jest.fn().mockReturnValue(50)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const startDate = new Date('2023-01-10');
      const endDate = new Date('2023-01-20');

      const result = await WalletService.getWalletStats('user123', startDate, endDate);

      expect(result?.stats.transactionCount).toBe(1);
      expect(result?.stats.totalConsume).toBe(50);
      expect(result?.stats.totalRecharge).toBe(0);
    });

    it('should return null if wallet not found', async () => {
      MockedWallet.findOne = jest.fn().mockResolvedValue(null);

      const result = await WalletService.getWalletStats('user123');

      expect(result).toBeNull();
    });
  });

  describe('addInvoiceInfo', () => {
    it('should add invoice info successfully', async () => {
      const mockWallet = {
        addInvoiceInfo: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(WalletService, 'getOrCreateWallet').mockResolvedValue(mockWallet as any);

      const invoiceInfo = {
        type: 'personal' as const,
        title: '个人',
        email: 'test@example.com'
      };

      const result = await WalletService.addInvoiceInfo('user123', invoiceInfo);

      expect(result.success).toBe(true);
      expect(mockWallet.addInvoiceInfo).toHaveBeenCalledWith(invoiceInfo);
      expect(mockWallet.save).toHaveBeenCalled();
    });
  });

  describe('createInvoiceApplication', () => {
    it('should create invoice application successfully', async () => {
      const mockTransactions = [
        {
          id: 'trans1',
          type: 'recharge',
          amount: 100,
          status: 'completed'
        },
        {
          id: 'trans2',
          type: 'consume',
          amount: 50,
          status: 'completed'
        }
      ];

      const mockInvoiceInfo = {
        isDefault: true,
        title: '测试公司',
        taxNumber: '123456789'
      };

      const mockWallet = {
        transactions: mockTransactions,
        invoiceInfo: [mockInvoiceInfo],
        createInvoice: jest.fn().mockReturnValue({ id: 'invoice123' }),
        save: jest.fn().mockResolvedValue(true)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await WalletService.createInvoiceApplication(
        'user123',
        ['trans1', 'trans2'],
        'electronic'
      );

      expect(result.success).toBe(true);
      expect(result.invoiceId).toBe('invoice123');
      expect(mockWallet.createInvoice).toHaveBeenCalledWith({
        amount: 150,
        title: '测试公司',
        taxNumber: '123456789',
        content: '充电服务费',
        type: 'electronic',
        status: 'pending',
        transactionIds: ['trans1', 'trans2']
      });
    });

    it('should fail if no valid transactions found', async () => {
      const mockWallet = {
        transactions: [],
        invoiceInfo: []
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await WalletService.createInvoiceApplication(
        'user123',
        ['trans1'],
        'electronic'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('没有找到有效的交易记录');
    });

    it('should fail if no default invoice info', async () => {
      const mockTransactions = [
        {
          id: 'trans1',
          type: 'recharge',
          amount: 100,
          status: 'completed'
        }
      ];

      const mockWallet = {
        transactions: mockTransactions,
        invoiceInfo: []
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await WalletService.createInvoiceApplication(
        'user123',
        ['trans1'],
        'electronic'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('请先设置发票信息');
    });
  });

  describe('setAutoRecharge', () => {
    it('should set auto recharge successfully', async () => {
      const mockWallet = {
        settings: {},
        save: jest.fn().mockResolvedValue(true)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await WalletService.setAutoRecharge('user123', true, 20, 100);

      expect(result.success).toBe(true);
      expect(result.message).toBe('自动充值已开启');
      expect(mockWallet.settings).toEqual({
        autoRecharge: {
          enabled: true,
          threshold: 20,
          amount: 100
        }
      });
      expect(mockWallet.save).toHaveBeenCalled();
    });

    it('should disable auto recharge', async () => {
      const mockWallet = {
        settings: {
          autoRecharge: {
            enabled: true,
            threshold: 10,
            amount: 50
          }
        },
        save: jest.fn().mockResolvedValue(true)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await WalletService.setAutoRecharge('user123', false);

      expect(result.success).toBe(true);
      expect(result.message).toBe('自动充值已关闭');
      expect(mockWallet.settings.autoRecharge.enabled).toBe(false);
    });

    it('should fail if wallet not found', async () => {
      MockedWallet.findOne = jest.fn().mockResolvedValue(null);

      const result = await WalletService.setAutoRecharge('user123', true);

      expect(result.success).toBe(false);
      expect(result.message).toBe('钱包不存在');
    });
  });
});