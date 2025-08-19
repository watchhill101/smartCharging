import { FAQ, IFAQ } from '../models/FAQ';
import { RedisService } from './RedisService';

export interface CreateFAQData {
  question: string;
  answer: string;
  category: string;
  tags?: string[];
  priority?: number;
  createdBy: string;
}

export interface UpdateFAQData {
  question?: string;
  answer?: string;
  category?: string;
  tags?: string[];
  priority?: number;
  isActive?: boolean;
}

export interface FAQQuery {
  category?: string;
  tags?: string[];
  keyword?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export class FAQService {
  private redisService: RedisService;

  constructor(redisService: RedisService) {
    this.redisService = redisService;
  }

  /**
   * 创建FAQ
   */
  async createFAQ(data: CreateFAQData): Promise<IFAQ> {
    try {
      const faq = new FAQ({
        ...data,
        tags: data.tags || [],
        priority: data.priority || 0
      });

      const savedFAQ = await faq.save();

      // 清除相关缓存
      await this.clearFAQCache();

      return savedFAQ;
    } catch (error) {
      console.error('创建FAQ失败:', error);
      throw new Error('创建FAQ失败');
    }
  }

  /**
   * 获取FAQ列表
   */
  async getFAQs(query: FAQQuery = {}): Promise<{
    faqs: IFAQ[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      // 尝试从缓存获取
      const cacheKey = `faq:list:${JSON.stringify(query)}`;
      const cached = await this.redisService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const filter: any = {};
      
      if (query.category) filter.category = query.category;
      if (query.isActive !== undefined) filter.isActive = query.isActive;
      if (query.tags && query.tags.length > 0) {
        filter.tags = { $in: query.tags };
      }

      // 文本搜索
      if (query.keyword) {
        filter.$text = { $search: query.keyword };
      }

      const [faqs, total] = await Promise.all([
        FAQ.find(filter)
          .sort(query.keyword ? { score: { $meta: 'textScore' } } : { priority: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        FAQ.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
        faqs: faqs as IFAQ[],
        total,
        page,
        totalPages
      };

      // 缓存结果30分钟
      await this.redisService.setex(cacheKey, 1800, JSON.stringify(result));

      return result;
    } catch (error) {
      console.error('获取FAQ列表失败:', error);
      throw new Error('获取FAQ列表失败');
    }
  }

  /**
   * 根据ID获取FAQ详情
   */
  async getFAQById(id: string): Promise<IFAQ | null> {
    try {
      const cacheKey = `faq:detail:${id}`;
      const cached = await this.redisService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const faq = await FAQ.findById(id);
      
      if (faq) {
        // 增加查看次数
        await FAQ.updateOne({ _id: id }, { $inc: { viewCount: 1 } });
        
        // 缓存结果1小时
        await this.redisService.setex(cacheKey, 3600, JSON.stringify(faq));
      }

      return faq;
    } catch (error) {
      console.error('获取FAQ详情失败:', error);
      throw new Error('获取FAQ详情失败');
    }
  }

  /**
   * 更新FAQ
   */
  async updateFAQ(id: string, data: UpdateFAQData): Promise<IFAQ | null> {
    try {
      const faq = await FAQ.findByIdAndUpdate(
        id,
        data,
        { new: true }
      );

      if (faq) {
        // 清除相关缓存
        await this.clearFAQCache();
        await this.redisService.del(`faq:detail:${id}`);
      }

      return faq;
    } catch (error) {
      console.error('更新FAQ失败:', error);
      throw new Error('更新FAQ失败');
    }
  }

  /**
   * 删除FAQ
   */
  async deleteFAQ(id: string): Promise<boolean> {
    try {
      const result = await FAQ.deleteOne({ _id: id });
      
      if (result.deletedCount > 0) {
        // 清除相关缓存
        await this.clearFAQCache();
        await this.redisService.del(`faq:detail:${id}`);
      }

      return result.deletedCount > 0;
    } catch (error) {
      console.error('删除FAQ失败:', error);
      throw new Error('删除FAQ失败');
    }
  }

  /**
   * 搜索FAQ
   */
  async searchFAQs(keyword: string, category?: string): Promise<IFAQ[]> {
    try {
      const cacheKey = `faq:search:${keyword}:${category || 'all'}`;
      const cached = await this.redisService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const filter: any = {
        isActive: true,
        $text: { $search: keyword }
      };

      if (category) {
        filter.category = category;
      }

      const faqs = await FAQ.find(filter)
        .sort({ score: { $meta: 'textScore' }, priority: -1 })
        .limit(10)
        .lean();

      // 缓存结果15分钟
      await this.redisService.setex(cacheKey, 900, JSON.stringify(faqs));

      return faqs as IFAQ[];
    } catch (error) {
      console.error('搜索FAQ失败:', error);
      throw new Error('搜索FAQ失败');
    }
  }

  /**
   * 获取热门FAQ
   */
  async getPopularFAQs(limit: number = 10): Promise<IFAQ[]> {
    try {
      const cacheKey = `faq:popular:${limit}`;
      const cached = await this.redisService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const faqs = await FAQ.find({ isActive: true })
        .sort({ viewCount: -1, helpfulCount: -1, priority: -1 })
        .limit(limit)
        .lean();

      // 缓存结果1小时
      await this.redisService.setex(cacheKey, 3600, JSON.stringify(faqs));

      return faqs as IFAQ[];
    } catch (error) {
      console.error('获取热门FAQ失败:', error);
      throw new Error('获取热门FAQ失败');
    }
  }

  /**
   * 获取FAQ分类统计
   */
  async getFAQCategoryStats(): Promise<Record<string, number>> {
    try {
      const cacheKey = 'faq:category_stats';
      const cached = await this.redisService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const stats = await FAQ.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);

      const result = stats.reduce((acc, item) => ({
        ...acc,
        [item._id]: item.count
      }), {});

      // 缓存结果1小时
      await this.redisService.setex(cacheKey, 3600, JSON.stringify(result));

      return result;
    } catch (error) {
      console.error('获取FAQ分类统计失败:', error);
      throw new Error('获取分类统计失败');
    }
  }

  /**
   * 标记FAQ为有帮助
   */
  async markFAQHelpful(id: string): Promise<boolean> {
    try {
      const result = await FAQ.updateOne(
        { _id: id },
        { $inc: { helpfulCount: 1 } }
      );

      if (result.modifiedCount > 0) {
        // 清除详情缓存
        await this.redisService.del(`faq:detail:${id}`);
      }

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('标记FAQ有帮助失败:', error);
      throw new Error('操作失败');
    }
  }

  /**
   * 获取相关FAQ推荐
   */
  async getRelatedFAQs(id: string, limit: number = 5): Promise<IFAQ[]> {
    try {
      const faq = await FAQ.findById(id);
      if (!faq) return [];

      const cacheKey = `faq:related:${id}:${limit}`;
      const cached = await this.redisService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // 基于分类和标签推荐相关FAQ
      const relatedFAQs = await FAQ.find({
        _id: { $ne: id },
        isActive: true,
        $or: [
          { category: faq.category },
          { tags: { $in: faq.tags } }
        ]
      })
      .sort({ priority: -1, viewCount: -1 })
      .limit(limit)
      .lean();

      // 缓存结果30分钟
      await this.redisService.setex(cacheKey, 1800, JSON.stringify(relatedFAQs));

      return relatedFAQs as IFAQ[];
    } catch (error) {
      console.error('获取相关FAQ失败:', error);
      throw new Error('获取相关FAQ失败');
    }
  }

  /**
   * 清除FAQ相关缓存
   */
  private async clearFAQCache(): Promise<void> {
    try {
      const keys = await this.redisService.keys('faq:list:*');
      if (keys.length > 0) {
        await this.redisService.del(...keys);
      }
      
      // 清除其他相关缓存
      await Promise.all([
        this.redisService.del('faq:popular:*'),
        this.redisService.del('faq:category_stats'),
        this.redisService.del('faq:search:*')
      ]);
    } catch (error) {
      console.error('清除FAQ缓存失败:', error);
    }
  }

  /**
   * 批量导入FAQ
   */
  async bulkImportFAQs(faqs: CreateFAQData[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const faqData of faqs) {
      try {
        await this.createFAQ(faqData);
        success++;
      } catch (error) {
        console.error('导入FAQ失败:', faqData.question, error);
        failed++;
      }
    }

    return { success, failed };
  }
}