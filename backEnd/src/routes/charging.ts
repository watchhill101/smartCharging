import express from "express";
import { body, param, query, validationResult } from "express-validator";
import { authenticate as authenticateToken } from "../middleware/auth";
import { ChargingService } from "../services/ChargingService";
import { WebSocketService } from "../services/WebSocketService";
import { RedisService } from "../services/RedisService";

const router = express.Router();

// 依赖注入 - 在实际应用中应该通过DI容器管理
let chargingService: ChargingService;
let webSocketService: WebSocketService;
let redisService: RedisService;

// 初始化服务（在app.ts中调用）
export const initializeChargingRoutes = (
  charging: ChargingService,
  ws: WebSocketService,
  redis: RedisService
) => {
  chargingService = charging;
  webSocketService = ws;
  redisService = redis;
};

/**
 * 启动充电会话
 * POST /api/charging/start
 */
router.post(
  "/start",
  authenticateToken,
  [
    body("pileId").notEmpty().withMessage("充电桩ID不能为空"),
    body("pileCode")
      .optional()
      .isString()
      .withMessage("充电桩编码必须是字符串"),
    body("targetSoc")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("目标电量必须在1-100之间"),
    body("maxEnergy")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("最大充电量必须大于0"),
    body("maxCost")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("最大费用必须大于0"),
    body("paymentMethod")
      .optional()
      .isIn(["balance", "wechat", "alipay"])
      .withMessage("支付方式无效"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "请求参数无效",
          errors: errors.array(),
        });
      }

      const userId = req.user.userId;
      const { pileId, pileCode, targetSoc, maxEnergy, maxCost, paymentMethod } =
        req.body;

      console.log(`🔌 用户 ${userId} 请求启动充电: 充电桩 ${pileId}`);

      // 启动充电会话
      const session = await chargingService.startChargingSession({
        userId,
        pileId,
        pileCode,
        targetSoc,
        maxEnergy,
        maxCost,
        paymentMethod,
      });

      // 发送启动成功通知
      webSocketService.sendNotificationToUser(userId, {
        type: "charging_status",
        title: "充电启动成功",
        content: `充电桩 ${session.pileName} 已开始充电`,
        data: { sessionId: session.sessionId },
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: "充电启动成功",
        data: {
          sessionId: session.sessionId,
          pileId: session.pileId,
          pileName: session.pileName,
          stationName: session.stationName,
          startTime: session.startTime,
          targetSoc,
          maxEnergy,
          maxCost,
        },
      });
    } catch (error) {
      console.error("❌ 启动充电失败:", error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "启动充电失败",
        code: "START_CHARGING_ERROR",
      });
    }
  }
);

/**
 * 停止充电会话
 * POST /api/charging/stop
 */
router.post(
  "/stop",
  authenticateToken,
  [body("sessionId").notEmpty().withMessage("会话ID不能为空")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "请求参数无效",
          errors: errors.array(),
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.body;

      console.log(`⏹️ 用户 ${userId} 请求停止充电: 会话 ${sessionId}`);

      // 停止充电会话
      const result = await chargingService.stopChargingSession({
        sessionId,
        userId,
        reason: "user_request",
      });

      // 发送停止成功通知
      webSocketService.sendNotificationToUser(userId, {
        type: "charging_status",
        title: "充电已停止",
        content: `充电会话已结束，总费用 ¥${result.totalCost.toFixed(2)}`,
        data: { sessionId, totalCost: result.totalCost },
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: "充电停止成功",
        data: {
          sessionId,
          endTime: result.endTime,
          duration: result.duration,
          energyDelivered: result.energyDelivered,
          totalCost: result.totalCost,
          status: "completed",
        },
      });
    } catch (error) {
      console.error("❌ 停止充电失败:", error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "停止充电失败",
        code: "STOP_CHARGING_ERROR",
      });
    }
  }
);

/**
 * 暂停充电会话
 * POST /api/charging/pause
 */
router.post(
  "/pause",
  authenticateToken,
  [body("sessionId").notEmpty().withMessage("会话ID不能为空")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "请求参数无效",
          errors: errors.array(),
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.body;

      console.log(`⏸️ 用户 ${userId} 请求暂停充电: 会话 ${sessionId}`);

      // 暂停充电会话
      await chargingService.pauseChargingSession({
        sessionId,
        userId,
      });

      // 发送暂停成功通知
      webSocketService.sendNotificationToUser(userId, {
        type: "charging_status",
        title: "充电已暂停",
        content: "充电会话已暂停，可随时恢复",
        data: { sessionId },
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: "充电暂停成功",
        data: {
          sessionId,
          status: "suspended",
          pausedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("❌ 暂停充电失败:", error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "暂停充电失败",
        code: "PAUSE_CHARGING_ERROR",
      });
    }
  }
);

/**
 * 恢复充电会话
 * POST /api/charging/resume
 */
router.post(
  "/resume",
  authenticateToken,
  [body("sessionId").notEmpty().withMessage("会话ID不能为空")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "请求参数无效",
          errors: errors.array(),
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.body;

      console.log(`▶️ 用户 ${userId} 请求恢复充电: 会话 ${sessionId}`);

      // 恢复充电会话
      await chargingService.resumeChargingSession({
        sessionId,
        userId,
      });

      // 发送恢复成功通知
      webSocketService.sendNotificationToUser(userId, {
        type: "charging_status",
        title: "充电已恢复",
        content: "充电会话已恢复，继续充电",
        data: { sessionId },
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: "充电恢复成功",
        data: {
          sessionId,
          status: "charging",
          resumedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("❌ 恢复充电失败:", error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "恢复充电失败",
        code: "RESUME_CHARGING_ERROR",
      });
    }
  }
);

/**
 * 获取充电状态
 * GET /api/charging/status/:sessionId
 */
router.get(
  "/status/:sessionId",
  authenticateToken,
  [param("sessionId").notEmpty().withMessage("会话ID不能为空")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "请求参数无效",
          errors: errors.array(),
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.params;

      // 获取充电状态
      const status = await chargingService.getChargingStatus(sessionId, userId);

      if (!status) {
        return res.status(404).json({
          success: false,
          message: "未找到充电会话",
          code: "SESSION_NOT_FOUND",
        });
      }

      res.json({
        success: true,
        message: "获取充电状态成功",
        data: status,
      });
    } catch (error) {
      console.error("❌ 获取充电状态失败:", error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "获取充电状态失败",
        code: "GET_STATUS_ERROR",
      });
    }
  }
);

/**
 * 获取用户充电历史
 * GET /api/charging/history
 */
router.get(
  "/history",
  authenticateToken,
  [
    query("page").optional().isInt({ min: 1 }).withMessage("页码必须大于0"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("每页数量必须在1-100之间"),
    query("status")
      .optional()
      .isIn(["all", "completed", "faulted"])
      .withMessage("状态筛选无效"),
    query("startDate").optional().isISO8601().withMessage("开始日期格式无效"),
    query("endDate").optional().isISO8601().withMessage("结束日期格式无效"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "请求参数无效",
          errors: errors.array(),
        });
      }

      const userId = req.user.userId;
      const {
        page = 1,
        limit = 20,
        status = "all",
        startDate,
        endDate,
      } = req.query;

      // 获取充电历史
      const history = await chargingService.getChargingHistory({
        userId,
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.json({
        success: true,
        message: "获取充电历史成功",
        data: history,
      });
    } catch (error) {
      console.error("❌ 获取充电历史失败:", error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "获取充电历史失败",
        code: "GET_HISTORY_ERROR",
      });
    }
  }
);

/**
 * 获取充电统计信息
 * GET /api/charging/stats
 */
router.get(
  "/stats",
  authenticateToken,
  [
    query("period")
      .optional()
      .isIn(["week", "month", "year"])
      .withMessage("统计周期无效"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "请求参数无效",
          errors: errors.array(),
        });
      }

      const userId = req.user.userId;
      const { period = "month" } = req.query;

      // 获取充电统计
      const stats = await chargingService.getChargingStats({
        userId,
        period: period as string,
      });

      res.json({
        success: true,
        message: "获取充电统计成功",
        data: stats,
      });
    } catch (error) {
      console.error("❌ 获取充电统计失败:", error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "获取充电统计失败",
        code: "GET_STATS_ERROR",
      });
    }
  }
);

/**
 * 获取实时监控数据
 * GET /api/charging/monitor/:sessionId
 */
router.get(
  "/monitor/:sessionId",
  authenticateToken,
  [param("sessionId").notEmpty().withMessage("会话ID不能为空")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "请求参数无效",
          errors: errors.array(),
        });
      }

      const userId = req.user.userId;
      const { sessionId } = req.params;

      // 获取实时监控数据
      const monitorData = await chargingService.getRealtimeMonitorData(
        sessionId,
        userId
      );

      if (!monitorData) {
        return res.status(404).json({
          success: false,
          message: "未找到监控数据",
          code: "MONITOR_DATA_NOT_FOUND",
        });
      }

      res.json({
        success: true,
        message: "获取监控数据成功",
        data: monitorData,
      });
    } catch (error) {
      console.error("❌ 获取监控数据失败:", error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "获取监控数据失败",
        code: "GET_MONITOR_ERROR",
      });
    }
  }
);

export default router;
