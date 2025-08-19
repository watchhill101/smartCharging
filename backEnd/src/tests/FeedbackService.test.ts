import { FeedbackService, CreateFeedbackData } from '../services/FeedbackService';
import { RedisService } from '../services/RedisService';
import { Feedback } from '../models/Feedback';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../models/Feedback');
jest.mock('../services/RedisService');

describe('FeedbackService', () => {
  let feedbackService: FeedbackService;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    mockRedisService = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      hincrby: jest.fn(),
      expire: jest.fn(),
      lpush: jest.fn()
    } as any;

    feedbackService = new FeedbackService(mockRedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFeedback', () => {
    it('应该成功创建反馈', async () => {
      const mockFeedbackData: CreateFeedbackData = {
        userId: 'user123',
        type: 'bug',
        title: '充电桩无法启动',
        description: '扫码后无法启动充电',
        contact: '13800138000',
        priority: 'high'
      };

      const mockSavedFeedback = {
        ...mockFeedbackData,
        ticketId: 'T123456',
        status: 'pending',
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(true)
      };

      (Feedback as any).mockImplementation(() => mockSavedFeedback);
      mockRedisService.setex.mockResolvedValue('OK');
      mockRedisService.hincrby.mockResolvedValue(1);
      mockRedisService.expire.mockResolvedValue(1);

      const result = await feedbackService.createFeedback(mockFeedbackData);

      expect(result).toBeDefined();
      expect(result.ticketId).toMatch(/^T[A-Z0-9]+$/);
      expect(mockSavedFeedback.save).toHaveBeenCalled();
      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `user:${mockFeedbackData.userId}:latest_feedback`,
        3600,
        expect.any(String)
      );
    });

    it('应该处理创建失败的情况', async () => {
      const mockFeedbackData: CreateFeedbackData = {
        userId: 'user123',
        type: 'bug',
        title: '测试问题',
        description: '测试描述',
        contact: '13800138000'
      };

      (Feedback as any).mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(feedbackService.createFeedback(mockFeedbackData))
        .rejects.toThrow('创建反馈失败');
    });
  });

  describe('getUserFeedbacks', () => {
    it('应该成功获取用户反馈列表', async () => {
      const userId = 'user123';
      const mockFeedbacks = [
        {
          ticketId: 'T123456',
          title: '测试问题1',
          status: 'pending',
          createdAt: new Date()
        },
        {
          ticketId: 'T123457',
          title: '测试问题2',
          status: 'resolved',
          createdAt: new Date()
        }
      ];

      (Feedback.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockFeedbacks)
      });

      (Feedback.countDocuments as jest.Mock).mockResolvedValue(2);

      const result = await feedbackService.getUserFeedbacks(userId);

      expect(result).toEqual({
        feedbacks: mockFeedbacks,
        total: 2,
        page: 1,
        totalPages: 1
      });
    });

    it('应该支持分页和筛选', async () => {
      const userId = 'user123';
      const query = {
        type: 'bug',
        status: 'pending',
        page: 2,
        limit: 5
      };

      (Feedback.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      });

      (Feedback.countDocuments as jest.Mock).mockResolvedValue(10);

      const result = await feedbackService.getUserFeedbacks(userId, query);

      expect(Feedback.find).toHaveBeenCalledWith({
        userId,
        type: 'bug',
        status: 'pending'
      });
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('updateFeedback', () => {
    it('应该成功更新反馈', async () => {
      const ticketId = 'T123456';
      const updateData = {
        status: 'resolved' as const,
        response: '问题已解决',
        responseBy: 'admin'
      };

      const mockUpdatedFeedback = {
        ticketId,
        userId: 'user123',
        ...updateData,
        responseAt: expect.any(Date)
      };

      (Feedback.findOneAndUpdate as jest.Mock).mockResolvedValue(mockUpdatedFeedback);
      mockRedisService.del.mockResolvedValue(1);
      mockRedisService.lpush.mockResolvedValue(1);

      const result = await feedbackService.updateFeedback(ticketId, updateData);

      expect(result).toEqual(mockUpdatedFeedback);
      expect(Feedback.findOneAndUpdate).toHaveBeenCalledWith(
        { ticketId },
        { ...updateData, responseAt: expect.any(Date) },
        { new: true }
      );
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `user:${mockUpdatedFeedback.userId}:latest_feedback`
      );
    });

    it('应该处理不存在的工单', async () => {
      const ticketId = 'NONEXISTENT';
      const updateData = {
        status: 'resolved' as const,
        response: '问题已解决'
      };

      (Feedback.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      const result = await feedbackService.updateFeedback(ticketId, updateData);

      expect(result).toBeNull();
    });
  });

  describe('getFeedbackStats', () => {
    it('应该从缓存获取统计数据', async () => {
      const mockStats = {
        total: 100,
        byStatus: { pending: 30, resolved: 70 },
        byType: { bug: 50, suggestion: 50 },
        byPriority: { high: 20, medium: 60, low: 20 }
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(mockStats));

      const result = await feedbackService.getFeedbackStats('week');

      expect(result).toEqual(mockStats);
      expect(mockRedisService.get).toHaveBeenCalledWith('feedback:stats:week');
    });

    it('应该计算并缓存统计数据', async () => {
      mockRedisService.get.mockResolvedValue(null);

      (Feedback.countDocuments as jest.Mock).mockResolvedValue(100);
      (Feedback.aggregate as jest.Mock)
        .mockResolvedValueOnce([
          { _id: 'pending', count: 30 },
          { _id: 'resolved', count: 70 }
        ])
        .mockResolvedValueOnce([
          { _id: 'bug', count: 50 },
          { _id: 'suggestion', count: 50 }
        ])
        .mockResolvedValueOnce([
          { _id: 'high', count: 20 },
          { _id: 'medium', count: 60 },
          { _id: 'low', count: 20 }
        ]);

      mockRedisService.setex.mockResolvedValue('OK');

      const result = await feedbackService.getFeedbackStats('day');

      expect(result).toEqual({
        total: 100,
        byStatus: { pending: 30, resolved: 70 },
        byType: { bug: 50, suggestion: 50 },
        byPriority: { high: 20, medium: 60, low: 20 }
      });

      expect(mockRedisService.setex).toHaveBeenCalledWith(
        'feedback:stats:day',
        1800,
        expect.any(String)
      );
    });
  });

  describe('searchFeedbacks', () => {
    it('应该成功搜索反馈', async () => {
      const query = '充电桩';
      const filters = { userId: 'user123', type: 'bug' };
      const mockResults = [
        {
          ticketId: 'T123456',
          title: '充电桩无法启动',
          description: '扫码后充电桩无响应'
        }
      ];

      (Feedback.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockResults)
      });

      const result = await feedbackService.searchFeedbacks(query, filters);

      expect(result).toEqual(mockResults);
      expect(Feedback.find).toHaveBeenCalledWith({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { ticketId: { $regex: query, $options: 'i' } }
        ],
        userId: filters.userId,
        type: filters.type
      });
    });
  });

  describe('deleteFeedback', () => {
    it('应该成功删除反馈（软删除）', async () => {
      const ticketId = 'T123456';
      const userId = 'user123';

      (Feedback.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });

      const result = await feedbackService.deleteFeedback(ticketId, userId);

      expect(result).toBe(true);
      expect(Feedback.updateOne).toHaveBeenCalledWith(
        { ticketId, userId },
        { status: 'closed' }
      );
    });

    it('应该处理删除失败的情况', async () => {
      const ticketId = 'NONEXISTENT';
      const userId = 'user123';

      (Feedback.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 0 });

      const result = await feedbackService.deleteFeedback(ticketId, userId);

      expect(result).toBe(false);
    });
  });
});