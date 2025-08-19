import { InvoiceService } from '../services/InvoiceService';
import Wallet from '../models/Wallet';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

// Mock dependencies
jest.mock('../models/Wallet');
jest.mock('fs');
jest.mock('nodemailer');

const MockedWallet = Wallet as jest.Mocked<typeof Wallet>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

describe('InvoiceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createInvoiceApplication', () => {
    it('should create invoice application successfully', async () => {
      const mockTransactions = [
        {
          id: 'trans1',
          type: 'recharge',
          amount: 100,
          status: 'completed',
          description: '充值'
        },
        {
          id: 'trans2',
          type: 'consume',
          amount: 50,
          status: 'completed',
          description: '充电费用'
        }
      ];

      const mockInvoiceInfo = {
        type: 'company',
        title: '测试公司',
        taxNumber: '123456789',
        email: 'test@company.com',
        isDefault: true
      };

      const mockWallet = {
        transactions: mockTransactions,
        invoiceInfo: [mockInvoiceInfo],
        invoices: [],
        createInvoice: jest.fn().mockReturnValue({
          id: 'invoice123',
          invoiceNumber: 'INV202301010001',
          amount: 150,
          title: '测试公司',
          taxNumber: '123456789',
          content: '充电服务充值 1笔，充电服务费 1笔',
          type: 'electronic',
          status: 'pending',
          transactionIds: ['trans1', 'trans2']
        }),
        save: jest.fn().mockResolvedValue(true)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.createInvoiceApplication({
        userId: 'user123',
        transactionIds: ['trans1', 'trans2'],
        invoiceType: 'electronic'
      });

      expect(result.success).toBe(true);
      expect(result.invoiceId).toBe('invoice123');
      expect(mockWallet.createInvoice).toHaveBeenCalledWith({
        amount: 150,
        title: '测试公司',
        taxNumber: '123456789',
        content: '充电服务充值 1笔，充电服务费 1笔',
        type: 'electronic',
        status: 'pending',
        transactionIds: ['trans1', 'trans2']
      });
      expect(mockWallet.save).toHaveBeenCalled();
    });

    it('should fail if wallet not found', async () => {
      MockedWallet.findOne = jest.fn().mockResolvedValue(null);

      const result = await InvoiceService.createInvoiceApplication({
        userId: 'user123',
        transactionIds: ['trans1'],
        invoiceType: 'electronic'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('钱包不存在');
    });

    it('should fail if no valid transactions found', async () => {
      const mockWallet = {
        transactions: [],
        invoiceInfo: [],
        invoices: []
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.createInvoiceApplication({
        userId: 'user123',
        transactionIds: ['trans1'],
        invoiceType: 'electronic'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('没有找到有效的交易记录');
    });

    it('should fail if transactions already invoiced', async () => {
      const mockTransactions = [
        {
          id: 'trans1',
          type: 'recharge',
          amount: 100,
          status: 'completed'
        }
      ];

      const mockInvoices = [
        {
          id: 'invoice1',
          transactionIds: ['trans1'],
          status: 'issued'
        }
      ];

      const mockWallet = {
        transactions: mockTransactions,
        invoiceInfo: [],
        invoices: mockInvoices
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.createInvoiceApplication({
        userId: 'user123',
        transactionIds: ['trans1'],
        invoiceType: 'electronic'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('部分交易记录已开票，请重新选择');
    });

    it('should fail if no invoice info found', async () => {
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
        invoiceInfo: [],
        invoices: []
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.createInvoiceApplication({
        userId: 'user123',
        transactionIds: ['trans1'],
        invoiceType: 'electronic'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('请先设置发票信息');
    });
  });

  describe('processInvoice', () => {
    it('should process invoice successfully', async () => {
      const mockInvoice = {
        id: 'invoice123',
        invoiceNumber: 'INV202301010001',
        amount: 100,
        title: '测试公司',
        status: 'pending',
        type: 'electronic'
      };

      const mockWallet = {
        invoices: [mockInvoice],
        save: jest.fn().mockResolvedValue(true)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);
      mockedFs.existsSync = jest.fn().mockReturnValue(false);
      mockedFs.mkdirSync = jest.fn();
      mockedFs.writeFileSync = jest.fn();

      const result = await InvoiceService.processInvoice('invoice123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('发票生成成功');
      expect(result.downloadUrl).toBeDefined();
      expect(mockInvoice.status).toBe('issued');
      expect(mockInvoice.issuedAt).toBeDefined();
      expect(mockWallet.save).toHaveBeenCalled();
    });

    it('should fail if invoice not found', async () => {
      MockedWallet.findOne = jest.fn().mockResolvedValue(null);

      const result = await InvoiceService.processInvoice('invoice123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('发票不存在');
    });

    it('should fail if invoice status is not pending', async () => {
      const mockInvoice = {
        id: 'invoice123',
        status: 'issued'
      };

      const mockWallet = {
        invoices: [mockInvoice]
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.processInvoice('invoice123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('发票状态不允许处理');
    });
  });

  describe('sendInvoiceEmail', () => {
    it('should send invoice email successfully', async () => {
      const mockInvoice = {
        id: 'invoice123',
        invoiceNumber: 'INV202301010001',
        title: '测试公司',
        amount: 100,
        status: 'issued',
        downloadUrl: '/api/invoices/download/invoice_INV202301010001.pdf',
        issuedAt: new Date()
      };

      const mockWallet = {
        invoices: [mockInvoice],
        save: jest.fn().mockResolvedValue(true)
      };

      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);
      mockedFs.existsSync = jest.fn().mockReturnValue(true);
      mockedNodemailer.createTransporter = jest.fn().mockReturnValue(mockTransporter);

      // Mock the static emailTransporter
      (InvoiceService as any).emailTransporter = mockTransporter;

      const result = await InvoiceService.sendInvoiceEmail({
        invoiceId: 'invoice123',
        recipientEmail: 'user@example.com',
        subject: '测试发票',
        message: '测试消息'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('发票邮件发送成功');
      expect(mockInvoice.status).toBe('sent');
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      expect(mockWallet.save).toHaveBeenCalled();
    });

    it('should fail if invoice not found', async () => {
      MockedWallet.findOne = jest.fn().mockResolvedValue(null);

      const result = await InvoiceService.sendInvoiceEmail({
        invoiceId: 'invoice123',
        recipientEmail: 'user@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('发票不存在');
    });

    it('should fail if invoice not issued', async () => {
      const mockInvoice = {
        id: 'invoice123',
        status: 'pending'
      };

      const mockWallet = {
        invoices: [mockInvoice]
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.sendInvoiceEmail({
        invoiceId: 'invoice123',
        recipientEmail: 'user@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('发票尚未生成，无法发送');
    });

    it('should fail if invoice file not exists', async () => {
      const mockInvoice = {
        id: 'invoice123',
        status: 'issued',
        downloadUrl: '/api/invoices/download/invoice_test.pdf'
      };

      const mockWallet = {
        invoices: [mockInvoice]
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);
      mockedFs.existsSync = jest.fn().mockReturnValue(false);

      const result = await InvoiceService.sendInvoiceEmail({
        invoiceId: 'invoice123',
        recipientEmail: 'user@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('发票文件不存在');
    });
  });

  describe('getInvoiceList', () => {
    it('should get invoice list successfully', async () => {
      const mockInvoices = [
        {
          id: 'invoice1',
          status: 'issued',
          type: 'electronic',
          createdAt: new Date('2023-01-15')
        },
        {
          id: 'invoice2',
          status: 'pending',
          type: 'paper',
          createdAt: new Date('2023-01-10')
        }
      ];

      const mockWallet = {
        invoices: mockInvoices
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.getInvoiceList({
        userId: 'user123',
        status: 'issued',
        page: 1,
        limit: 10
      });

      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0].status).toBe('issued');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      });
    });

    it('should return empty list if wallet not found', async () => {
      MockedWallet.findOne = jest.fn().mockResolvedValue(null);

      const result = await InvoiceService.getInvoiceList({
        userId: 'user123',
        page: 1,
        limit: 10
      });

      expect(result.invoices).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should filter invoices by date range', async () => {
      const mockInvoices = [
        {
          id: 'invoice1',
          createdAt: new Date('2023-01-15')
        },
        {
          id: 'invoice2',
          createdAt: new Date('2023-02-15')
        }
      ];

      const mockWallet = {
        invoices: mockInvoices
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.getInvoiceList({
        userId: 'user123',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31'),
        page: 1,
        limit: 10
      });

      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0].id).toBe('invoice1');
    });
  });

  describe('cancelInvoice', () => {
    it('should cancel invoice successfully', async () => {
      const mockInvoice = {
        id: 'invoice123',
        status: 'pending',
        updatedAt: new Date()
      };

      const mockWallet = {
        invoices: [mockInvoice],
        save: jest.fn().mockResolvedValue(true)
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.cancelInvoice('user123', 'invoice123', '用户取消');

      expect(result.success).toBe(true);
      expect(result.message).toBe('发票取消成功');
      expect(mockInvoice.status).toBe('cancelled');
      expect(mockWallet.save).toHaveBeenCalled();
    });

    it('should fail if invoice not found', async () => {
      const mockWallet = {
        invoices: []
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.cancelInvoice('user123', 'invoice123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('发票不存在');
    });

    it('should fail if invoice already cancelled', async () => {
      const mockInvoice = {
        id: 'invoice123',
        status: 'cancelled'
      };

      const mockWallet = {
        invoices: [mockInvoice]
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.cancelInvoice('user123', 'invoice123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('发票已取消');
    });

    it('should fail if invoice already sent', async () => {
      const mockInvoice = {
        id: 'invoice123',
        status: 'sent'
      };

      const mockWallet = {
        invoices: [mockInvoice]
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.cancelInvoice('user123', 'invoice123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('已发送的发票无法取消');
    });
  });

  describe('getInvoiceStatistics', () => {
    it('should get invoice statistics successfully', async () => {
      const mockInvoices = [
        {
          id: 'invoice1',
          amount: 100,
          type: 'electronic',
          status: 'issued',
          createdAt: new Date('2023-01-15')
        },
        {
          id: 'invoice2',
          amount: 200,
          type: 'paper',
          status: 'sent',
          createdAt: new Date('2023-02-15')
        },
        {
          id: 'invoice3',
          amount: 50,
          type: 'electronic',
          status: 'cancelled',
          createdAt: new Date('2023-03-15')
        }
      ];

      const mockWallet = {
        invoices: mockInvoices
      };

      MockedWallet.findOne = jest.fn().mockResolvedValue(mockWallet);

      const result = await InvoiceService.getInvoiceStatistics('user123', 2023);

      expect(result).toEqual({
        totalInvoices: 3,
        totalAmount: 350,
        electronicCount: 2,
        paperCount: 1,
        statusCounts: {
          pending: 0,
          issued: 1,
          sent: 1,
          cancelled: 1
        },
        monthlyStats: expect.arrayContaining([
          expect.objectContaining({
            month: '2023-01',
            count: 1,
            amount: 100
          }),
          expect.objectContaining({
            month: '2023-02',
            count: 1,
            amount: 200
          })
        ])
      });
    });

    it('should return null if wallet not found', async () => {
      MockedWallet.findOne = jest.fn().mockResolvedValue(null);

      const result = await InvoiceService.getInvoiceStatistics('user123', 2023);

      expect(result).toBeNull();
    });
  });

  describe('validateInvoiceInfo', () => {
    it('should validate correct invoice info', () => {
      const invoiceInfo = {
        type: 'company',
        title: '测试公司',
        taxNumber: '123456789',
        email: 'test@company.com'
      };

      const result = InvoiceService.validateInvoiceInfo(invoiceInfo);

      expect(result.valid).toBe(true);
    });

    it('should reject empty title', () => {
      const invoiceInfo = {
        type: 'personal',
        title: '',
        email: 'test@example.com'
      };

      const result = InvoiceService.validateInvoiceInfo(invoiceInfo);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('发票抬头不能为空');
    });

    it('should reject company invoice without tax number', () => {
      const invoiceInfo = {
        type: 'company',
        title: '测试公司',
        email: 'test@company.com'
      };

      const result = InvoiceService.validateInvoiceInfo(invoiceInfo);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('企业发票必须提供税号');
    });

    it('should reject invalid email', () => {
      const invoiceInfo = {
        type: 'personal',
        title: '个人',
        email: 'invalid-email'
      };

      const result = InvoiceService.validateInvoiceInfo(invoiceInfo);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('邮箱格式不正确');
    });
  });

  describe('batchProcessInvoices', () => {
    it('should process multiple invoices successfully', async () => {
      // Mock processInvoice method
      const originalProcessInvoice = InvoiceService.processInvoice;
      InvoiceService.processInvoice = jest.fn()
        .mockResolvedValueOnce({ success: true, message: '发票生成成功' })
        .mockResolvedValueOnce({ success: false, message: '发票不存在' });

      const result = await InvoiceService.batchProcessInvoices(['invoice1', 'invoice2']);

      expect(result.success).toBe(true);
      expect(result.message).toBe('批量处理完成：成功 1 个，失败 1 个');
      expect(result.results).toHaveLength(2);
      expect(result.results![0].success).toBe(true);
      expect(result.results![1].success).toBe(false);

      // Restore original method
      InvoiceService.processInvoice = originalProcessInvoice;
    });
  });

  describe('cleanupExpiredInvoices', () => {
    it('should cleanup expired invoices successfully', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 31);

      const mockInvoice1 = {
        status: 'pending',
        createdAt: expiredDate,
        updatedAt: new Date()
      };

      const mockInvoice2 = {
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockWallet = {
        invoices: [mockInvoice1, mockInvoice2],
        save: jest.fn().mockResolvedValue(true)
      };

      MockedWallet.find = jest.fn().mockResolvedValue([mockWallet]);

      const result = await InvoiceService.cleanupExpiredInvoices(30);

      expect(result.success).toBe(true);
      expect(result.cleanedCount).toBe(1);
      expect(mockInvoice1.status).toBe('cancelled');
      expect(mockInvoice2.status).toBe('pending');
      expect(mockWallet.save).toHaveBeenCalled();
    });
  });
});