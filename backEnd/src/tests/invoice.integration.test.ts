import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import invoiceRoutes from '../routes/invoice';
import { InvoiceService } from '../services/InvoiceService';

// Mock dependencies
jest.mock('../services/InvoiceService');

const MockedInvoiceService = InvoiceService as jest.Mocked<typeof InvoiceService>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/invoices', invoiceRoutes);

// Mock JWT secret
process.env.JWT_SECRET = 'test-secret';

// Helper function to create auth token
const createAuthToken = (userId: string) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
};

describe('Invoice Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/invoices/apply', () => {
    it('should create invoice application successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        success: true,
        invoiceId: 'invoice123',
        invoice: {
          id: 'invoice123',
          invoiceNumber: 'INV202301010001',
          amount: 150,
          title: '测试公司',
          type: 'electronic',
          status: 'pending'
        },
        message: '发票申请创建成功'
      };

      MockedInvoiceService.createInvoiceApplication = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/invoices/apply')
        .set('Authorization', `Bearer ${token}`)
        .send({
          transactionIds: ['trans1', 'trans2'],
          invoiceType: 'electronic',
          invoiceInfoId: 'info123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invoiceId).toBe('invoice123');
      expect(MockedInvoiceService.createInvoiceApplication).toHaveBeenCalledWith({
        userId,
        transactionIds: ['trans1', 'trans2'],
        invoiceType: 'electronic',
        invoiceInfoId: 'info123'
      });
    });

    it('should validate request parameters', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const response = await request(app)
        .post('/api/invoices/apply')
        .set('Authorization', `Bearer ${token}`)
        .send({
          transactionIds: [],
          invoiceType: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
    });

    it('should handle service errors', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedInvoiceService.createInvoiceApplication = jest.fn().mockResolvedValue({
        success: false,
        message: '没有找到有效的交易记录'
      });

      const response = await request(app)
        .post('/api/invoices/apply')
        .set('Authorization', `Bearer ${token}`)
        .send({
          transactionIds: ['trans1'],
          invoiceType: 'electronic'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('没有找到有效的交易记录');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/invoices/apply')
        .send({
          transactionIds: ['trans1'],
          invoiceType: 'electronic'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/invoices/list', () => {
    it('should get invoice list successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        invoices: [
          {
            id: 'invoice1',
            invoiceNumber: 'INV202301010001',
            amount: 100,
            status: 'issued',
            type: 'electronic',
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

      MockedInvoiceService.getInvoiceList = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/invoices/list?status=issued&page=1&limit=20')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(MockedInvoiceService.getInvoiceList).toHaveBeenCalledWith({
        userId,
        status: 'issued',
        type: undefined,
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
        .get('/api/invoices/list?status=invalid&page=0')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
    });
  });

  describe('GET /api/invoices/:invoiceId', () => {
    it('should get invoice detail successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);
      const invoiceId = 'invoice123';

      const mockInvoice = {
        id: invoiceId,
        invoiceNumber: 'INV202301010001',
        amount: 100,
        title: '测试公司',
        status: 'issued',
        type: 'electronic'
      };

      MockedInvoiceService.getInvoiceDetail = jest.fn().mockResolvedValue(mockInvoice);

      const response = await request(app)
        .get(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invoice).toEqual(mockInvoice);
      expect(MockedInvoiceService.getInvoiceDetail).toHaveBeenCalledWith(userId, invoiceId);
    });

    it('should handle invoice not found', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);
      const invoiceId = 'nonexistent';

      MockedInvoiceService.getInvoiceDetail = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('发票不存在');
    });
  });

  describe('POST /api/invoices/:invoiceId/process', () => {
    it('should process invoice successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);
      const invoiceId = 'invoice123';

      const mockResult = {
        success: true,
        message: '发票生成成功',
        downloadUrl: '/api/invoices/download/invoice_INV202301010001.pdf'
      };

      MockedInvoiceService.processInvoice = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/process`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.downloadUrl).toBe(mockResult.downloadUrl);
      expect(MockedInvoiceService.processInvoice).toHaveBeenCalledWith(invoiceId);
    });

    it('should handle processing errors', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);
      const invoiceId = 'invoice123';

      MockedInvoiceService.processInvoice = jest.fn().mockResolvedValue({
        success: false,
        message: '发票状态不允许处理'
      });

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/process`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('发票状态不允许处理');
    });
  });

  describe('POST /api/invoices/:invoiceId/send-email', () => {
    it('should send invoice email successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);
      const invoiceId = 'invoice123';

      const mockResult = {
        success: true,
        message: '发票邮件发送成功'
      };

      MockedInvoiceService.sendInvoiceEmail = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/send-email`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipientEmail: 'user@example.com',
          subject: '测试发票',
          message: '测试消息'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('发票邮件发送成功');
      expect(MockedInvoiceService.sendInvoiceEmail).toHaveBeenCalledWith({
        invoiceId,
        recipientEmail: 'user@example.com',
        subject: '测试发票',
        message: '测试消息'
      });
    });

    it('should validate email parameters', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);
      const invoiceId = 'invoice123';

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/send-email`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipientEmail: 'invalid-email',
          subject: 'a'.repeat(201)
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
    });
  });

  describe('POST /api/invoices/:invoiceId/cancel', () => {
    it('should cancel invoice successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);
      const invoiceId = 'invoice123';

      const mockResult = {
        success: true,
        message: '发票取消成功'
      };

      MockedInvoiceService.cancelInvoice = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          reason: '用户取消'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('发票取消成功');
      expect(MockedInvoiceService.cancelInvoice).toHaveBeenCalledWith(userId, invoiceId, '用户取消');
    });

    it('should handle cancellation errors', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);
      const invoiceId = 'invoice123';

      MockedInvoiceService.cancelInvoice = jest.fn().mockResolvedValue({
        success: false,
        message: '已发送的发票无法取消'
      });

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          reason: '用户取消'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('已发送的发票无法取消');
    });
  });

  describe('GET /api/invoices/stats/:year?', () => {
    it('should get invoice statistics successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);
      const year = 2023;

      const mockStats = {
        totalInvoices: 10,
        totalAmount: 1000,
        electronicCount: 8,
        paperCount: 2,
        statusCounts: {
          pending: 2,
          issued: 5,
          sent: 2,
          cancelled: 1
        },
        monthlyStats: [
          { month: '2023-01', count: 3, amount: 300 },
          { month: '2023-02', count: 2, amount: 200 }
        ]
      };

      MockedInvoiceService.getInvoiceStatistics = jest.fn().mockResolvedValue(mockStats);

      const response = await request(app)
        .get(`/api/invoices/stats/${year}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(MockedInvoiceService.getInvoiceStatistics).toHaveBeenCalledWith(userId, year);
    });

    it('should get current year statistics by default', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedInvoiceService.getInvoiceStatistics = jest.fn().mockResolvedValue({});

      const response = await request(app)
        .get('/api/invoices/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(MockedInvoiceService.getInvoiceStatistics).toHaveBeenCalledWith(userId, undefined);
    });

    it('should handle user not found', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedInvoiceService.getInvoiceStatistics = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/invoices/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('用户不存在');
    });
  });

  describe('POST /api/invoices/batch/process', () => {
    it('should batch process invoices successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const mockResult = {
        success: true,
        message: '批量处理完成：成功 2 个，失败 0 个',
        results: [
          { invoiceId: 'invoice1', success: true, message: '发票生成成功' },
          { invoiceId: 'invoice2', success: true, message: '发票生成成功' }
        ]
      };

      MockedInvoiceService.batchProcessInvoices = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/invoices/batch/process')
        .set('Authorization', `Bearer ${token}`)
        .send({
          invoiceIds: ['invoice1', 'invoice2']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
      expect(MockedInvoiceService.batchProcessInvoices).toHaveBeenCalledWith(['invoice1', 'invoice2']);
    });

    it('should validate invoice IDs', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const response = await request(app)
        .post('/api/invoices/batch/process')
        .set('Authorization', `Bearer ${token}`)
        .send({
          invoiceIds: []
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数错误');
    });
  });

  describe('POST /api/invoices/validate-info', () => {
    it('should validate invoice info successfully', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedInvoiceService.validateInvoiceInfo = jest.fn().mockReturnValue({
        valid: true
      });

      const response = await request(app)
        .post('/api/invoices/validate-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'company',
          title: '测试公司',
          taxNumber: '123456789',
          email: 'test@company.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('发票信息验证通过');
    });

    it('should handle validation errors', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      MockedInvoiceService.validateInvoiceInfo = jest.fn().mockReturnValue({
        valid: false,
        message: '发票抬头不能为空'
      });

      const response = await request(app)
        .post('/api/invoices/validate-info')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'company',
          title: '',
          email: 'test@company.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('发票抬头不能为空');
    });

    it('should validate request parameters', async () => {
      const userId = 'user123';
      const token = createAuthToken(userId);

      const response = await request(app)
        .post('/api/invoices/validate-info')
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

  describe('POST /api/invoices/admin/cleanup', () => {
    it('should cleanup expired invoices successfully', async () => {
      const userId = 'admin123';
      const token = createAuthToken(userId);

      const mockResult = {
        success: true,
        message: '清理完成，共处理 5 个过期发票',
        cleanedCount: 5
      };

      MockedInvoiceService.cleanupExpiredInvoices = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/invoices/admin/cleanup')
        .set('Authorization', `Bearer ${token}`)
        .send({
          expireDays: 30
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cleanedCount).toBe(5);
      expect(MockedInvoiceService.cleanupExpiredInvoices).toHaveBeenCalledWith(30);
    });

    it('should use default expire days', async () => {
      const userId = 'admin123';
      const token = createAuthToken(userId);

      MockedInvoiceService.cleanupExpiredInvoices = jest.fn().mockResolvedValue({
        success: true,
        cleanedCount: 0
      });

      const response = await request(app)
        .post('/api/invoices/admin/cleanup')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(200);
      expect(MockedInvoiceService.cleanupExpiredInvoices).toHaveBeenCalledWith(30);
    });
  });
});