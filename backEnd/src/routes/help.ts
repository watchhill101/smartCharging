import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { FeedbackService } from '../services/FeedbackService';
import { FAQService } from '../services/FAQService';
import { RedisService } from '../services/RedisService';
import { authenticate as authMiddleware } from '../middleware/auth';

const router = express.Router();

// 初始化服务
const redisService = new RedisService({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

const feedbackService = new FeedbackService(redisService);
const faqService = new FAQService(redisService);

// 验证中间件
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }
  next();
};

// FAQ相关路由

/**
 * 获取FAQ列表
 */
router.get('/faq', [
  query('category').optional().isString(),
  query('keyword').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], handleValidationErrors, async (req, res) => {
  try {
    const { category, keyword, page, limit } = req.query;
    
    const result = await faqService.getFAQs({
      category: category as string,
      keyword: keyword as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      isActive: true
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取FAQ列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取FAQ列表失败'
    });
  }
});

/**
 * 搜索FAQ
 */
router.get('/faq/search', [
  query('q').notEmpty().withMessage('搜索关键词不能为空'),
  query('category').optional().isString()
], handleValidationErrors, async (req, res) => {
  try {
    const { q, category } = req.query;
    
    const faqs = await faqService.searchFAQs(q as string, category as string);

    res.json({
      success: true,
      data: faqs
    });
  } catch (error) {
    console.error('搜索FAQ失败:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败'
    });
  }
});

/**
 * 获取热门FAQ
 */
router.get('/faq/popular', [
  query('limit').optional().isInt({ min: 1, max: 20 })
], handleValidationErrors, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const faqs = await faqService.getPopularFAQs(limit);

    res.json({
      success: true,
      data: faqs
    });
  } catch (error) {
    console.error('获取热门FAQ失败:', error);
    res.status(500).json({
      success: false,
      message: '获取热门FAQ失败'
    });
  }
});

/**
 * 获取FAQ分类统计
 */
router.get('/faq/categories', async (req, res) => {
  try {
    const stats = await faqService.getFAQCategoryStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取FAQ分类统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类统计失败'
    });
  }
});

/**
 * 获取FAQ详情
 */
router.get('/faq/:id', [
  param('id').isMongoId().withMessage('无效的FAQ ID')
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    
    const faq = await faqService.getFAQById(id);
    
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ不存在'
      });
    }

    // 获取相关FAQ
    const relatedFAQs = await faqService.getRelatedFAQs(id, 5);

    res.json({
      success: true,
      data: {
        faq,
        relatedFAQs
      }
    });
  } catch (error) {
    console.error('获取FAQ详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取FAQ详情失败'
    });
  }
});

/**
 * FAQ点赞/踩
 */
router.post('/faq/:id/helpful', authMiddleware, [
  param('id').isMongoId().withMessage('无效的FAQ ID')
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await faqService.markFAQHelpful(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'FAQ不存在'
      });
    }

    res.json({
      success: true,
      message: '感谢您的反馈'
    });
  } catch (error) {
    console.error('标记FAQ有帮助失败:', error);
    res.status(500).json({
      success: false,
      message: '操作失败'
    });
  }
});

// 反馈相关路由（需要认证）

/**
 * 提交反馈
 */
router.post('/feedback', authMiddleware, [
  body('type').isIn(['bug', 'suggestion', 'charging', 'payment', 'account', 'other'])
    .withMessage('无效的反馈类型'),
  body('title').notEmpty().isLength({ max: 100 })
    .withMessage('标题不能为空且不超过100字符'),
  body('description').notEmpty().isLength({ max: 1000 })
    .withMessage('描述不能为空且不超过1000字符'),
  body('contact').notEmpty()
    .withMessage('联系方式不能为空'),
  body('priority').optional().isIn(['low', 'medium', 'high'])
    .withMessage('无效的优先级'),
  body('images').optional().isArray({ max: 3 })
    .withMessage('最多上传3张图片')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const { type, title, description, contact, priority, images } = req.body;
    
    const feedback = await feedbackService.createFeedback({
      userId,
      type,
      title,
      description,
      contact,
      priority,
      images
    });

    res.status(201).json({
      success: true,
      message: '反馈提交成功',
      data: {
        ticketId: feedback.ticketId,
        status: feedback.status,
        createdAt: feedback.createdAt
      }
    });
  } catch (error) {
    console.error('提交反馈失败:', error);
    res.status(500).json({
      success: false,
      message: '提交反馈失败'
    });
  }
});

/**
 * 获取用户反馈列表
 */
router.get('/feedback', authMiddleware, [
  query('type').optional().isString(),
  query('status').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const { type, status, page, limit } = req.query;
    
    const result = await feedbackService.getUserFeedbacks(userId, {
      type: type as string,
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取反馈列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取反馈列表失败'
    });
  }
});

/**
 * 获取反馈详情
 */
router.get('/feedback/:ticketId', authMiddleware, [
  param('ticketId').notEmpty().withMessage('工单ID不能为空')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { ticketId } = req.params;
    
    const feedback = await feedbackService.getFeedbackByTicketId(ticketId, userId);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: '工单不存在'
      });
    }

    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    console.error('获取反馈详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取反馈详情失败'
    });
  }
});

/**
 * 搜索用户反馈
 */
router.get('/feedback/search', authMiddleware, [
  query('q').notEmpty().withMessage('搜索关键词不能为空')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { q } = req.query;
    
    const feedbacks = await feedbackService.searchFeedbacks(q as string, { userId });

    res.json({
      success: true,
      data: feedbacks
    });
  } catch (error) {
    console.error('搜索反馈失败:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败'
    });
  }
});

/**
 * 获取联系信息
 */
router.get('/contact', async (req, res) => {
  try {
    const contactInfo = {
      phone: process.env.CUSTOMER_SERVICE_PHONE || '400-123-4567',
      email: process.env.CUSTOMER_SERVICE_EMAIL || 'support@smartcharging.com',
      workingHours: '8:00-22:00',
      onlineChat: true,
      address: '北京市朝阳区智能充电大厦',
      website: 'https://www.smartcharging.com'
    };

    res.json({
      success: true,
      data: contactInfo
    });
  } catch (error) {
    console.error('获取联系信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取联系信息失败'
    });
  }
});

// 管理员路由（需要管理员权限）

/**
 * 创建FAQ（管理员）
 */
router.post('/admin/faq', authMiddleware, [
  body('question').notEmpty().isLength({ max: 200 })
    .withMessage('问题不能为空且不超过200字符'),
  body('answer').notEmpty().isLength({ max: 2000 })
    .withMessage('答案不能为空且不超过2000字符'),
  body('category').isIn(['charging', 'payment', 'account', 'technical', 'other'])
    .withMessage('无效的分类'),
  body('tags').optional().isArray(),
  body('priority').optional().isInt({ min: 0, max: 100 })
], handleValidationErrors, async (req, res) => {
  try {
    // 这里应该检查管理员权限
    const createdBy = req.user?.id || 'admin';
    
    const { question, answer, category, tags, priority } = req.body;
    
    const faq = await faqService.createFAQ({
      question,
      answer,
      category,
      tags,
      priority,
      createdBy
    });

    res.status(201).json({
      success: true,
      message: 'FAQ创建成功',
      data: faq
    });
  } catch (error) {
    console.error('创建FAQ失败:', error);
    res.status(500).json({
      success: false,
      message: '创建FAQ失败'
    });
  }
});

/**
 * 回复反馈（管理员）
 */
router.put('/admin/feedback/:ticketId', authMiddleware, [
  param('ticketId').notEmpty().withMessage('工单ID不能为空'),
  body('response').notEmpty().isLength({ max: 1000 })
    .withMessage('回复内容不能为空且不超过1000字符'),
  body('status').optional().isIn(['pending', 'processing', 'resolved', 'closed'])
], handleValidationErrors, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { response, status } = req.body;
    const responseBy = req.user?.id || 'admin';
    
    const feedback = await feedbackService.updateFeedback(ticketId, {
      response,
      status: status || 'resolved',
      responseBy
    });
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: '工单不存在'
      });
    }

    res.json({
      success: true,
      message: '回复成功',
      data: feedback
    });
  } catch (error) {
    console.error('回复反馈失败:', error);
    res.status(500).json({
      success: false,
      message: '回复失败'
    });
  }
});

/**
 * 获取反馈统计（管理员）
 */
router.get('/admin/feedback/stats', authMiddleware, [
  query('timeRange').optional().isIn(['day', 'week', 'month'])
], handleValidationErrors, async (req, res) => {
  try {
    const timeRange = (req.query.timeRange as 'day' | 'week' | 'month') || 'week';
    
    const stats = await feedbackService.getFeedbackStats(timeRange);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取反馈统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败'
    });
  }
});

export default router;