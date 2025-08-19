import { Feedback, IFeedback } from '../models/Feedback';
import { RedisService } from './RedisService';

export interface CreateFeedbackData {
  userId: string;
  type: 'bug' | 'suggestion' | 'charging' | 'payment' | 'account' | 'other';
  title: string;
  description: string;
  contact: string;
  images?: string[];
  priority?: 'low' | 'medium' | 'high';
}

export interface UpdateFeedbackData {
  status?: 'pending' | 'processing' | 'resolved' | 'closed';
  response?: string;
  responseBy?: string;
}

export interface FeedbackQuery {
  userId?: string;
  type?: string;
  status?: string;
  priority?: string;
  page?: number;
  limit?: number;
}

export class FeedbackService {
  private redisService: RedisService;

  constructor(redisService: RedisService) {
    this.redisService = redisService;
  }

  /**
   * 生成工单ID
   */
  private generateTicketId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `T${timestamp}${random}`.toUpperCase();
  }

  /**
   * 创建反馈工单
   */
  async createFeedback(data: CreateFeedbackData): Promise<IFeedback> {
    try {
      const ticketId = this.generateTicketId();
      
      const feedback = new Feedback({
        ...data,
        ticketId,
        images: data.images || [],
        priority: data.priority || 'medium'
      });

      const savedFeedback = await feedback.save();

      // 缓存用户最新反馈
      await this.redisService.setex(
        `user:${data.userId}:latest_feedback`,
        3600, // 1小时
        JSON.stringify({
          ticketId: savedFeedback.ticketId,
          title: savedFeedback.title,
          status: savedFeedback.status,
          createdAt: savedFeedback.createdAt
        })
      );

      // 更新统计数据
      await this.updateFeedbackStats(data.type, data.priority);

      return savedFeedback;
    } catch (error) {
      console.error('创建反馈失败:', error);
      throw new Error('创建反馈失败');
    }
  }

  /**
   * 获取用户反馈列表
   */
  async getUserFeedbacks(userId: string, query: FeedbackQuery = {}): Promise<{
    feedbacks: IFeedback[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      const filter: any = { userId };
      
      if (query.type) filter.type = query.type;
      if (query.status) filter.status = query.status;
      if (query.priority) filter.priority = query.priority;

      const [feedbacks, total] = await Promise.all([
        Feedback.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Feedback.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        feedbacks: feedbacks as IFeedback[],
        total,
        page,
        totalPages
      };
    } catch (error) {
      console.error('获取用户反馈失败:', error);
      throw new Error('获取反馈列表失败');
    }
  }

  /**
   * 根据工单ID获取反馈详情
   */
  async getFeedbackByTicketId(ticketId: string, userId?: string): Promise<IFeedback | null> {
    try {
      const filter: any = { ticketId };
      if (userId) filter.userId = userId;

      const feedback = await Feedback.findOne(filter);
      return feedback;
    } catch (error) {
      console.error('获取反馈详情失败:', error);
      throw new Error('获取反馈详情失败');
    }
  }

  /**
   * 更新反馈状态和回复
   */
  async updateFeedback(ticketId: string, data: UpdateFeedbackData): Promise<IFeedback | null> {
    try {
      const updateData: any = { ...data };
      
      if (data.response) {
        updateData.responseAt = new Date();
      }

      const feedback = await Feedback.findOneAndUpdate(
        { ticketId },
        updateData,
        { new: true }
      );

      if (feedback) {
        // 清除相关缓存
        await this.redisService.del(`user:${feedback.userId}:latest_feedback`);
        
        // 如果有回复，发送通知
        if (data.response) {
          await this.sendFeedbackNotification(feedback);
        }
      }

      return feedback;
    } catch (error) {
      console.error('更新反馈失败:', error);
      throw new Error('更新反馈失败');
    }
  }

  /**
   * 获取反馈统计数据
   */
  async getFeedbackStats(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    try {
      const cacheKey = `feedback:stats:${timeRange}`;
      const cached = await this.redisService.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const [total, byStatus, byType, byPriority] = await Promise.all([
        Feedback.countDocuments({ createdAt: { $gte: startDate } }),
        Feedback.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Feedback.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]),
        Feedback.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ])
      ]);

      const stats = {
        total,
        byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        byType: byType.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        byPriority: byPriority.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {})
      };

      // 缓存30分钟
      await this.redisService.setex(cacheKey, 1800, JSON.stringify(stats));

      return stats;
    } catch (error) {
      console.error('获取反馈统计失败:', error);
      throw new Error('获取统计数据失败');
    }
  }

  /**
   * 搜索反馈
   */
  async searchFeedbacks(query: string, filters: FeedbackQuery = {}): Promise<IFeedback[]> {
    try {
      const searchFilter: any = {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { ticketId: { $regex: query, $options: 'i' } }
        ]
      };

      if (filters.userId) searchFilter.userId = filters.userId;
      if (filters.type) searchFilter.type = filters.type;
      if (filters.status) searchFilter.status = filters.status;

      const feedbacks = await Feedback.find(searchFilter)
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      return feedbacks as IFeedback[];
    } catch (error) {
      console.error('搜索反馈失败:', error);
      throw new Error('搜索失败');
    }
  }

  /**
   * 更新反馈统计
   */
  private async updateFeedbackStats(type: string, priority: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const statsKey = `feedback:daily_stats:${today}`;
      
      await Promise.all([
        this.redisService.hincrby(statsKey, 'total', 1),
        this.redisService.hincrby(statsKey, `type:${type}`, 1),
        this.redisService.hincrby(statsKey, `priority:${priority}`, 1)
      ]);

      // 设置过期时间为7天
      await this.redisService.expire(statsKey, 7 * 24 * 3600);
    } catch (error) {
      console.error('更新统计数据失败:', error);
    }
  }

  /**
   * 发送反馈通知
   */
  private async sendFeedbackNotification(feedback: IFeedback): Promise<void> {
    try {
      // 这里可以集成短信、邮件或推送通知服务
      console.log(`发送反馈通知给用户 ${feedback.userId}:`, {
        ticketId: feedback.ticketId,
        title: feedback.title,
        response: feedback.response
      });

      // 示例：存储通知到Redis队列
      const notification = {
        userId: feedback.userId,
        type: 'feedback_response',
        title: '工单回复通知',
        content: `您的工单 ${feedback.ticketId} 有新回复`,
        data: {
          ticketId: feedback.ticketId,
          response: feedback.response
        },
        createdAt: new Date()
      };

      await this.redisService.lpush(
        'notification:queue',
        JSON.stringify(notification)
      );
    } catch (error) {
      console.error('发送通知失败:', error);
    }
  }

  /**
   * 删除反馈（软删除）
   */
  async deleteFeedback(ticketId: string, userId: string): Promise<boolean> {
    try {
      const result = await Feedback.updateOne(
        { ticketId, userId },
        { status: 'closed' }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('删除反馈失败:', error);
      throw new Error('删除反馈失败');
    }
  }
}