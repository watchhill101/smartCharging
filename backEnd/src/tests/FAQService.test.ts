import { FAQService, CreateFAQData } from '../services/FAQService';
import { RedisService } from '../services/RedisService';
import { FAQ } from '../models/FAQ';

// Mock dependencies
jest.mock('../models/FAQ');
jest.mock('../services/RedisService');

describe('FAQService', () => {
  let faqService: FAQService;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    mockRedisService = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    } as any;

    faqService = new FAQService(mockRedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFAQ', () => {
    it('应该成功创建FAQ', async () => {
      const mockFAQData: CreateFAQData = {
        question: '如何开始充电？',
        answer: '扫描二维码即可开始充电',
        category: 'charging',
        tags: ['充电', '二维码'],
        priority: 10,
        createdBy: 'admin'
      };

      const mockSavedFAQ = {
        ...mockFAQData,
        _id: 'faq123',
        isActive: true,
        viewCount: 0,
        helpfulCount: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      (FAQ as any).mockImplementation(() => mockSavedFAQ);
      mockRedisService.keys.mockResolvedValue([]);

      const result = await faqService.createFAQ(mockFAQData);

      expect(result).toBeDefined();
      expect(mockSavedFAQ.save).toHaveBeenCalled();
      expect(mockRedisService.keys).toHaveBeenCalledWith('faq:list:*');
    });

    it('应该处理创建失败的情况', async () => {
      const mockFAQData: CreateFAQData = {
        question: '测试问题',
        answer: '测试答案',
        category: 'charging',
        createdBy: 'admin'
      };

      (FAQ as any).mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(faqService.createFAQ(mockFAQData))
        .rejects.toThrow('创建FAQ失败');
    });
  });

  describe('getFAQs', () => {
    it('应该从缓存获取FAQ列表', async () => {
      const query = { category: 'charging', page: 1, limit: 10 };
      const mockResult = {
        faqs: [
          {
            _id: 'faq1',
            question: '如何充电？',
            answer: '扫码充电',
            category: 'charging'
          }
        ],
        total: 1,
        page: 1,
        totalPages: 1
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(mockResult));

      const result = await faqService.getFAQs(query);

      expect(result).toEqual(mockResult);
      expect(mockRedisService.get).toHaveBeenCalledWith(
        `faq:list:${JSON.stringify(query)}`
      );
    });

    it('应该查询数据库并缓存结果', async () => {
      const query = { category: 'charging', isActive: true };
      const mockFAQs = [
        {
          _id: 'faq1',
          question: '如何充电？',
          answer: '扫码充电',
          category: 'charging'
        }
      ];

      mockRedisService.get.mockResolvedValue(null);
      (FAQ.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockFAQs)
      });
      (FAQ.countDocuments as jest.Mock).mockResolvedValue(1);
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await faqService.getFAQs(query);

      expect(result).toEqual({
        faqs: mockFAQs,
        total: 1,
        page: 1,
        totalPages: 1
      });

      expect(FAQ.find).toHaveBeenCalledWith({
        category: 'charging',
        isActive: true
      });
      expect(mockRedisService.setex).toHaveBeenCalled();
    });

    it('应该支持文本搜索', async () => {
      const query = { keyword: '充电桩', page: 1, limit: 10 };

      mockRedisService.get.mockResolvedValue(null);
      (FAQ.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      });
      (FAQ.countDocuments as jest.Mock).mockResolvedValue(0);

      await faqService.getFAQs(query);

      expect(FAQ.find).toHaveBeenCalledWith({
        $text: { $search: '充电桩' }
      });
    });
  });

  describe('getFAQById', () => {
    it('应该从缓存获取FAQ详情', async () => {
      const faqId = 'faq123';
      const mockFAQ = {
        _id: faqId,
        question: '如何充电？',
        answer: '扫码充电',
        viewCount: 10
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(mockFAQ));

      const result = await faqService.getFAQById(faqId);

      expect(result).toEqual(mockFAQ);
      expect(mockRedisService.get).toHaveBeenCalledWith(`faq:detail:${faqId}`);
    });

    it('应该查询数据库并增加查看次数', async () => {
      const faqId = 'faq123';
      const mockFAQ = {
        _id: faqId,
        question: '如何充电？',
        answer: '扫码充电',
        viewCount: 10
      };

      mockRedisService.get.mockResolvedValue(null);
      (FAQ.findById as jest.Mock).mockResolvedValue(mockFAQ);
      (FAQ.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await faqService.getFAQById(faqId);

      expect(result).toEqual(mockFAQ);
      expect(FAQ.updateOne).toHaveBeenCalledWith(
        { _id: faqId },
        { $inc: { viewCount: 1 } }
      );
      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `faq:detail:${faqId}`,
        3600,
        JSON.stringify(mockFAQ)
      );
    });

    it('应该处理不存在的FAQ', async () => {
      const faqId = 'nonexistent';

      mockRedisService.get.mockResolvedValue(null);
      (FAQ.findById as jest.Mock).mockResolvedValue(null);

      const result = await faqService.getFAQById(faqId);

      expect(result).toBeNull();
    });
  });

  describe('searchFAQs', () => {
    it('应该从缓存获取搜索结果', async () => {
      const keyword = '充电桩';
      const category = 'charging';
      const mockResults = [
        {
          _id: 'faq1',
          question: '充电桩如何使用？',
          answer: '扫码即可使用'
        }
      ];

      mockRedisService.get.mockResolvedValue(JSON.stringify(mockResults));

      const result = await faqService.searchFAQs(keyword, category);

      expect(result).toEqual(mockResults);
      expect(mockRedisService.get).toHaveBeenCalledWith(
        `faq:search:${keyword}:${category}`
      );
    });

    it('应该执行文本搜索并缓存结果', async () => {
      const keyword = '充电桩';
      const mockResults = [
        {
          _id: 'faq1',
          question: '充电桩如何使用？',
          answer: '扫码即可使用'
        }
      ];

      mockRedisService.get.mockResolvedValue(null);
      (FAQ.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockResults)
      });
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await faqService.searchFAQs(keyword);

      expect(result).toEqual(mockResults);
      expect(FAQ.find).toHaveBeenCalledWith({
        isActive: true,
        $text: { $search: keyword }
      });
      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `faq:search:${keyword}:all`,
        900,
        JSON.stringify(mockResults)
      );
    });
  });

  describe('getPopularFAQs', () => {
    it('应该获取热门FAQ', async () => {
      const limit = 5;
      const mockFAQs = [
        {
          _id: 'faq1',
          question: '热门问题1',
          viewCount: 100,
          helpfulCount: 50
        },
        {
          _id: 'faq2',
          question: '热门问题2',
          viewCount: 80,
          helpfulCount: 40
        }
      ];

      mockRedisService.get.mockResolvedValue(null);
      (FAQ.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockFAQs)
      });
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await faqService.getPopularFAQs(limit);

      expect(result).toEqual(mockFAQs);
      expect(FAQ.find).toHaveBeenCalledWith({ isActive: true });
    });
  });

  describe('markFAQHelpful', () => {
    it('应该成功标记FAQ为有帮助', async () => {
      const faqId = 'faq123';

      (FAQ.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      mockRedisService.del.mockResolvedValue(1);

      const result = await faqService.markFAQHelpful(faqId);

      expect(result).toBe(true);
      expect(FAQ.updateOne).toHaveBeenCalledWith(
        { _id: faqId },
        { $inc: { helpfulCount: 1 } }
      );
      expect(mockRedisService.del).toHaveBeenCalledWith(`faq:detail:${faqId}`);
    });

    it('应该处理不存在的FAQ', async () => {
      const faqId = 'nonexistent';

      (FAQ.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 0 });

      const result = await faqService.markFAQHelpful(faqId);

      expect(result).toBe(false);
    });
  });

  describe('getRelatedFAQs', () => {
    it('应该获取相关FAQ推荐', async () => {
      const faqId = 'faq123';
      const mockFAQ = {
        _id: faqId,
        category: 'charging',
        tags: ['充电', '二维码']
      };
      const mockRelatedFAQs = [
        {
          _id: 'faq456',
          question: '相关问题1',
          category: 'charging'
        }
      ];

      (FAQ.findById as jest.Mock).mockResolvedValue(mockFAQ);
      mockRedisService.get.mockResolvedValue(null);
      (FAQ.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockRelatedFAQs)
      });
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await faqService.getRelatedFAQs(faqId, 5);

      expect(result).toEqual(mockRelatedFAQs);
      expect(FAQ.find).toHaveBeenCalledWith({
        _id: { $ne: faqId },
        isActive: true,
        $or: [
          { category: mockFAQ.category },
          { tags: { $in: mockFAQ.tags } }
        ]
      });
    });

    it('应该处理不存在的FAQ', async () => {
      const faqId = 'nonexistent';

      (FAQ.findById as jest.Mock).mockResolvedValue(null);

      const result = await faqService.getRelatedFAQs(faqId);

      expect(result).toEqual([]);
    });
  });

  describe('bulkImportFAQs', () => {
    it('应该批量导入FAQ', async () => {
      const faqs: CreateFAQData[] = [
        {
          question: '问题1',
          answer: '答案1',
          category: 'charging',
          createdBy: 'admin'
        },
        {
          question: '问题2',
          answer: '答案2',
          category: 'payment',
          createdBy: 'admin'
        }
      ];

      // Mock successful creation
      (FAQ as any).mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true)
      }));
      mockRedisService.keys.mockResolvedValue([]);

      const result = await faqService.bulkImportFAQs(faqs);

      expect(result).toEqual({ success: 2, failed: 0 });
    });

    it('应该处理部分导入失败', async () => {
      const faqs: CreateFAQData[] = [
        {
          question: '问题1',
          answer: '答案1',
          category: 'charging',
          createdBy: 'admin'
        },
        {
          question: '问题2',
          answer: '答案2',
          category: 'payment',
          createdBy: 'admin'
        }
      ];

      let callCount = 0;
      (FAQ as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { save: jest.fn().mockResolvedValue(true) };
        } else {
          throw new Error('Database error');
        }
      });

      mockRedisService.keys.mockResolvedValue([]);

      const result = await faqService.bulkImportFAQs(faqs);

      expect(result).toEqual({ success: 1, failed: 1 });
    });
  });
});