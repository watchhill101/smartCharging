import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate as authenticateToken } from '../middleware/auth';
import { ChargingService } from '../services/ChargingService';
import { ChargingSessionService } from '../services/ChargingSessionService';
import { WebSocketService } from '../services/WebSocketService';
import { RedisService } from '../services/RedisService';

const router = express.Router();

// 依赖注入
let chargingService: ChargingService;
let sessionService: ChargingSessionService;
let webSocketService: WebSocketService;
let redisService: RedisService;

export const initializeChargingControlRoutes = (
  charging: ChargingService,
  session: ChargingSessionService,
  ws: WebSocketService,
  redis: RedisService
) => {
  chargingService = charging;
  sessionService = session;
  webSocketService = ws;
  redisService = redis;
};

/**
 * 更新充电设置
 * PUT /api/charging/control/settings/:sessionId
 */
router.put('/settings/:sessionId',
  authenticateToken,
  [
    param('sessionId').notEmpty().withMessage('会话ID不能为空'),
    body('targetSoc').optional().isInt({ min: 1, max: 100 }).withMessage('目标电量必须在1-100之间'),
    body('maxEnergy').optional().isFloat({ min: 0 }).withMessage('最大充电量必须大于0'),
    body('maxCost').optional().isFloat({ min: 0 }).withMessage('最大费用必须大于0'),
    body('powerLimit').optional().isFloat({ min: 0 }).withMessage('功率限制必须大于0'),
    body('autoStop').optional().isBoolean().withMessage('自动停止必须是布尔值')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '请求参数无效',
          errors: errors.array()
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.params;
      const { targetSoc, maxEnergy, maxCost, powerLimit, autoStop } = req.body;

      // 验证会话权限
      const session = await chargingService.getChargingStatus(sessionId, userId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: '充电会话不存在或无权限访问',
          code: 'SESSION_NOT_FOUND'
        });
      }

      if (!['charging', 'suspended'].includes(session.status)) {
        return res.status(400).json({
          success: false,
          message: '只能修改进行中或暂停的充电会话设置',
          code: 'INVALID_SESSION_STATUS'
        });
      }

      // 更新设置（这里应该调用实际的充电桩控制接口）
      const updatedSettings = {
        targetSoc,
        maxEnergy,
        maxCost,
        powerLimit,
        autoStop
      };

      // 保存设置到Redis
      await redisService.setex(
        `session:${sessionId}:settings`,
        3600,
        JSON.stringify(updatedSettings)
      );

      // 发送设置更新通知
      webSocketService.sendNotificationToSession(sessionId, {
        type: 'system_notice',
        title: '充电设置已更新',
        content: '充电参数设置已成功更新',
        data: updatedSettings,
        timestamp: new Date().toISOString()
      });

      console.log(`⚙️ 更新充电设置: 会话 ${sessionId}`);

      res.json({
        success: true,
        message: '充电设置更新成功',
        data: {
          sessionId,
          settings: updatedSettings,
          updatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ 更新充电设置失败:', error);
      
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '更新充电设置失败',
        code: 'UPDATE_SETTINGS_ERROR'
      });
    }
  }
);

/**
 * 紧急停止充电
 * POST /api/charging/control/emergency-stop
 */
router.post('/emergency-stop',
  authenticateToken,
  [
    body('sessionId').notEmpty().withMessage('会话ID不能为空'),
    body('reason').optional().isString().withMessage('停止原因必须是字符串')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '请求参数无效',
          errors: errors.array()
        });
      }

      const userId = req.user.userId;
      const { sessionId, reason = 'emergency_stop' } = req.body;

      // 验证会话权限
      const session = await chargingService.getChargingStatus(sessionId, userId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: '充电会话不存在或无权限访问',
          code: 'SESSION_NOT_FOUND'
        });
      }

      if (['completed', 'faulted'].includes(session.status)) {
        return res.status(400).json({
          success: false,
          message: '充电会话已结束，无法执行紧急停止',
          code: 'SESSION_ALREADY_ENDED'
        });
      }

      // 执行紧急停止
      const result = await chargingService.stopChargingSession({
        sessionId,
        userId,
        reason: 'emergency_stop'
      });

      // 记录紧急停止事件
      await redisService.lpush(
        `emergency_stops:${userId}`,
        JSON.stringify({
          sessionId,
          reason,
          timestamp: new Date().toISOString(),
          userId
        })
      );
      await redisService.ltrim(`emergency_stops:${userId}`, 0, 99);

      // 发送紧急停止通知
      await sessionService.sendChargingNotification({
        userId,
        sessionId,
        type: 'charging_stopped',
        title: '紧急停止成功',
        message: '充电已紧急停止，请检查设备状态',
        data: { reason, totalCost: result.totalCost },
        priority: 'urgent',
        channels: ['push', 'sms']
      });

      console.log(`🚨 紧急停止充电: 会话 ${sessionId} (原因: ${reason})`);

      res.json({
        success: true,
        message: '紧急停止成功',
        data: {
          sessionId,
          reason,
          endTime: result.endTime,
          totalCost: result.totalCost,
          emergencyStoppedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ 紧急停止失败:', error);
      
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '紧急停止失败',
        code: 'EMERGENCY_STOP_ERROR'
      });
    }
  }
);

/**
 * 获取充电会话异常检测结果
 * GET /api/charging/control/anomalies/:sessionId
 */
router.get('/anomalies/:sessionId',
  authenticateToken,
  [
    param('sessionId').notEmpty().withMessage('会话ID不能为空'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('限制数量必须在1-100之间')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '请求参数无效',
          errors: errors.array()
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.params;
      const { limit = 20 } = req.query;

      // 验证会话权限
      const session = await chargingService.getChargingStatus(sessionId, userId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: '充电会话不存在或无权限访问',
          code: 'SESSION_NOT_FOUND'
        });
      }

      // 获取异常检测结果
      const anomalies = await sessionService.getSessionAnomalies(sessionId, Number(limit));

      res.json({
        success: true,
        message: '获取异常检测结果成功',
        data: {
          sessionId,
          anomalies,
          total: anomalies.length
        }
      });

    } catch (error) {
      console.error('❌ 获取异常检测结果失败:', error);
      
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取异常检测结果失败',
        code: 'GET_ANOMALIES_ERROR'
      });
    }
  }
);

/**
 * 获取充电订单信息
 * GET /api/charging/control/order/:sessionId
 */
router.get('/order/:sessionId',
  authenticateToken,
  [
    param('sessionId').notEmpty().withMessage('会话ID不能为空')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '请求参数无效',
          errors: errors.array()
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.params;

      // 验证会话权限
      const session = await chargingService.getChargingStatus(sessionId, userId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: '充电会话不存在或无权限访问',
          code: 'SESSION_NOT_FOUND'
        });
      }

      // 获取订单ID
      const orderIdData = await redisService.get(`session:${sessionId}:order`);
      if (!orderIdData) {
        return res.status(404).json({
          success: false,
          message: '充电订单不存在',
          code: 'ORDER_NOT_FOUND'
        });
      }

      // 获取订单详情
      const orderData = await redisService.get(`order:${orderIdData}`);
      if (!orderData) {
        return res.status(404).json({
          success: false,
          message: '订单详情不存在',
          code: 'ORDER_DETAILS_NOT_FOUND'
        });
      }

      const order = JSON.parse(orderData);

      res.json({
        success: true,
        message: '获取充电订单成功',
        data: order
      });

    } catch (error) {
      console.error('❌ 获取充电订单失败:', error);
      
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取充电订单失败',
        code: 'GET_ORDER_ERROR'
      });
    }
  }
);

/**
 * 获取用户充电通知
 * GET /api/charging/control/notifications
 */
router.get('/notifications',
  authenticateToken,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('限制数量必须在1-100之间')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '请求参数无效',
          errors: errors.array()
        });
      }

      const userId = req.user.userId;
      const { limit = 50 } = req.query;

      // 获取用户通知
      const notifications = await sessionService.getUserNotifications(userId, Number(limit));

      res.json({
        success: true,
        message: '获取通知列表成功',
        data: {
          notifications,
          total: notifications.length
        }
      });

    } catch (error) {
      console.error('❌ 获取通知列表失败:', error);
      
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取通知列表失败',
        code: 'GET_NOTIFICATIONS_ERROR'
      });
    }
  }
);

/**
 * 获取用户订单历史
 * GET /api/charging/control/orders
 */
router.get('/orders',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须大于0'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '请求参数无效',
          errors: errors.array()
        });
      }

      const userId = req.user.userId;
      const { page = 1, limit = 20 } = req.query;

      // 获取用户订单历史
      const result = await sessionService.getUserOrders(userId, Number(page), Number(limit));

      res.json({
        success: true,
        message: '获取订单历史成功',
        data: result
      });

    } catch (error) {
      console.error('❌ 获取订单历史失败:', error);
      
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取订单历史失败',
        code: 'GET_ORDERS_ERROR'
      });
    }
  }
);

/**
 * 设置充电完成自动停止
 * POST /api/charging/control/auto-stop/:sessionId
 */
router.post('/auto-stop/:sessionId',
  authenticateToken,
  [
    param('sessionId').notEmpty().withMessage('会话ID不能为空'),
    body('enabled').isBoolean().withMessage('启用状态必须是布尔值'),
    body('conditions').optional().isObject().withMessage('停止条件必须是对象')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '请求参数无效',
          errors: errors.array()
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.params;
      const { enabled, conditions = {} } = req.body;

      // 验证会话权限
      const session = await chargingService.getChargingStatus(sessionId, userId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: '充电会话不存在或无权限访问',
          code: 'SESSION_NOT_FOUND'
        });
      }

      if (!['charging', 'suspended'].includes(session.status)) {
        return res.status(400).json({
          success: false,
          message: '只能为进行中或暂停的充电会话设置自动停止',
          code: 'INVALID_SESSION_STATUS'
        });
      }

      // 保存自动停止设置
      const autoStopConfig = {
        enabled,
        conditions,
        updatedAt: new Date().toISOString()
      };

      await redisService.setex(
        `session:${sessionId}:auto_stop`,
        3600,
        JSON.stringify(autoStopConfig)
      );

      console.log(`🤖 设置自动停止: 会话 ${sessionId} (${enabled ? '启用' : '禁用'})`);

      res.json({
        success: true,
        message: `自动停止${enabled ? '启用' : '禁用'}成功`,
        data: {
          sessionId,
          autoStop: autoStopConfig
        }
      });

    } catch (error) {
      console.error('❌ 设置自动停止失败:', error);
      
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '设置自动停止失败',
        code: 'SET_AUTO_STOP_ERROR'
      });
    }
  }
);

export default router;