import request from 'supertest';
import { app } from '../app';
import { connectDB } from '../config/database';
import { connectRedis } from '../config/redis';
import { Feedback } from '../models/Feedback';
import { FAQ } from '../models/FAQ';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';

describe('Help API Integration Tests', () => {
  let authToken: string;
  let testUserId: string;

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
    await Feedback.deleteMany({});
    await FAQ.deleteMany({});
  });

  beforeEach(async () => {
    // 清理测试数据
    await Feedback.deleteMany({});
    await FAQ.deleteMany({});
  });

  describe('FAQ API', () => {
    beforeEach(async () => {
      // 创建测试FAQ数据
      const testFAQs = [
        {
          question: '如何开始充电？',
          answer: '扫描充电桩上的二维码即可开始充电',
          category: 'charging',
          tags: ['充电', '二维码'],
          priority: 10,
          isActive: true,
          viewCount: 50,
          helpfulCount: 20,
          createdBy: 'admin'
        },
        {
          question: '支持哪些支付方式？',
          answer: '支持支付宝、微信支付和账户余额支付',
          category: 'payment',
          tags: ['支付', '支付宝', '微信'],
          priority: 8,
          isActive: true,
          viewCount: 30,
          helpfulCount: 15,
          createdBy: 'admin'
        },
        {
          question: '如何充值账户余额？',
          answer: '在个人中心点击钱包进行充值',
          category: 'payment',
          tags: ['充值', '余额'],
          priority: 5,
          isActive: true,
          viewCount: 20,
          helpfulCount: 10,
          createdBy: 'admin'
        }
      ];

      await FAQ.insertMany(testFAQs);
    });

    describe('GET /api/help/faq', () => {
      it('应该成功获取FAQ列表', async () => {
        const response = await request(app)
          .get('/api/help/faq')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.faqs).toHaveLength(3);
        expect(response.body.data.total).toBe(3);
        expect(response.body.data.page).toBe(1);
      });

      it('应该支持分类筛选', async () => {
        const response = await request(app)
          .get('/api/help/faq?category=payment')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.faqs).toHaveLength(2);
        expect(response.body.data.faqs.every(faq => faq.category === 'payment')).toBe(true);
      });

      it('应该支持分页', async () => {
        const response = await request(app)
          .get('/api/help/faq?page=1&limit=2')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.faqs).toHaveLength(2);
        expect(response.body.data.totalPages).toBe(2);
      });

      it('应该支持关键词搜索', async () => {
        const response = await request(app)
          .get('/api/help/faq?keyword=充电')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.faqs.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/help/faq/search', () => {
      it('应该成功搜索FAQ', async () => {
        const response = await request(app)
          .get('/api/help/faq/search?q=充电')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('应该验证搜索参数', async () => {
        const response = await request(app)
          .get('/api/help/faq/search')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('参数验证失败');
      });

      it('应该支持分类搜索', async () => {
        const response = await request(app)
          .get('/api/help/faq/search?q=支付&category=payment')
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/help/faq/popular', () => {
      it('应该获取热门FAQ', async () => {
        const response = await request(app)
          .get('/api/help/faq/popular')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeLessThanOrEqual(10);
      });

      it('应该支持限制数量', async () => {
        const response = await request(app)
          .get('/api/help/faq/popular?limit=2')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.length).toBeLessThanOrEqual(2);
      });
    });

    describe('GET /api/help/faq/categories', () => {
      it('应该获取FAQ分类统计', async () => {
        const response = await request(app)
          .get('/api/help/faq/categories')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(typeof response.body.data).toBe('object');
        expect(response.body.data.charging).toBe(1);
        expect(response.body.data.payment).toBe(2);
      });
    });

    describe('GET /api/help/faq/:id', () => {
      it('应该获取FAQ详情', async () => {
        const faq = await FAQ.findOne({ category: 'charging' });
        
        const response = await request(app)
          .get(`/api/help/faq/${faq._id}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.faq._id).toBe(faq._id.toString());
        expect(Array.isArray(response.body.data.relatedFAQs)).toBe(true);
      });

      it('应该处理不存在的FAQ', async () => {
        const fakeId = '507f1f77bcf86cd799439011';
        
        const response = await request(app)
          .get(`/api/help/faq/${fakeId}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('FAQ不存在');
      });

      it('应该验证FAQ ID格式', async () => {
        const response = await request(app)
          .get('/api/help/faq/invalid-id')
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/help/faq/:id/helpful', () => {
      it('应该成功标记FAQ为有帮助', async () => {
        const faq = await FAQ.findOne({ category: 'charging' });
        const originalCount = faq.helpfulCount;
        
        const response = await request(app)
          .post(`/api/help/faq/${faq._id}/helpful`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('感谢您的反馈');

        // 验证计数增加
        const updatedFAQ = await FAQ.findById(faq._id);
        expect(updatedFAQ.helpfulCount).toBe(originalCount + 1);
      });
    });
  });

  describe('Feedback API', () => {
    describe('POST /api/help/feedback', () => {
      it('应该成功提交反馈', async () => {
        const feedbackData = {
          type: 'bug',
          title: '充电桩无法启动',
          description: '扫码后充电桩没有反应，显示设备故障',
          contact: '13800138000',
          priority: 'high'
        };

        const response = await request(app)
          .post('/api/help/feedback')
          .set('Authorization', `Bearer ${authToken}`)
          .send(feedbackData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('反馈提交成功');
        expect(response.body.data.ticketId).toMatch(/^T[A-Z0-9]+$/);
        expect(response.body.data.status).toBe('pending');

        // 验证数据库中的记录
        const feedback = await Feedback.findOne({ ticketId: response.body.data.ticketId });
        expect(feedback).toBeTruthy();
        expect(feedback.userId).toBe(testUserId);
        expect(feedback.title).toBe(feedbackData.title);
      });

      it('应该验证必填字段', async () => {
        const invalidData = {
          type: 'bug',
          // 缺少 title
          description: '测试描述',
          contact: '13800138000'
        };

        const response = await request(app)
          .post('/api/help/feedback')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('参数验证失败');
      });

      it('应该验证反馈类型', async () => {
        const invalidData = {
          type: 'invalid-type',
          title: '测试标题',
          description: '测试描述',
          contact: '13800138000'
        };

        const response = await request(app)
          .post('/api/help/feedback')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('应该要求用户认证', async () => {
        const feedbackData = {
          type: 'bug',
          title: '测试问题',
          description: '测试描述',
          contact: '13800138000'
        };

        const response = await request(app)
          .post('/api/help/feedback')
          .send(feedbackData)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/help/feedback', () => {
      beforeEach(async () => {
        // 创建测试反馈数据
        const testFeedbacks = [
          {
            userId: testUserId,
            ticketId: 'T123456',
            type: 'bug',
            title: '充电桩故障',
            description: '充电桩无法启动',
            contact: '13800138000',
            priority: 'high',
            status: 'pending'
          },
          {
            userId: testUserId,
            ticketId: 'T123457',
            type: 'suggestion',
            title: '功能建议',
            description: '希望增加预约功能',
            contact: '13800138000',
            priority: 'medium',
            status: 'resolved'
          }
        ];

        await Feedback.insertMany(testFeedbacks);
      });

      it('应该获取用户反馈列表', async () => {
        const response = await request(app)
          .get('/api/help/feedback')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.feedbacks).toHaveLength(2);
        expect(response.body.data.total).toBe(2);
      });

      it('应该支持类型筛选', async () => {
        const response = await request(app)
          .get('/api/help/feedback?type=bug')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.feedbacks).toHaveLength(1);
        expect(response.body.data.feedbacks[0].type).toBe('bug');
      });

      it('应该支持状态筛选', async () => {
        const response = await request(app)
          .get('/api/help/feedback?status=resolved')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.feedbacks).toHaveLength(1);
        expect(response.body.data.feedbacks[0].status).toBe('resolved');
      });

      it('应该要求用户认证', async () => {
        const response = await request(app)
          .get('/api/help/feedback')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/help/feedback/:ticketId', () => {
      let testTicketId: string;

      beforeEach(async () => {
        const feedback = new Feedback({
          userId: testUserId,
          ticketId: 'T123456',
          type: 'bug',
          title: '测试问题',
          description: '测试描述',
          contact: '13800138000',
          priority: 'medium',
          status: 'pending'
        });
        await feedback.save();
        testTicketId = feedback.ticketId;
      });

      it('应该获取反馈详情', async () => {
        const response = await request(app)
          .get(`/api/help/feedback/${testTicketId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.ticketId).toBe(testTicketId);
        expect(response.body.data.userId).toBe(testUserId);
      });

      it('应该处理不存在的工单', async () => {
        const response = await request(app)
          .get('/api/help/feedback/NONEXISTENT')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('工单不存在');
      });
    });
  });

  describe('GET /api/help/contact', () => {
    it('应该获取联系信息', async () => {
      const response = await request(app)
        .get('/api/help/contact')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.phone).toBeDefined();
      expect(response.body.data.email).toBeDefined();
      expect(response.body.data.workingHours).toBeDefined();
    });
  });
});