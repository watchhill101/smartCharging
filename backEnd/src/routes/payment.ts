import express from "express";
import mongoose from "mongoose";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { alipaySdk, generateOrderNo } from "../config/alipay";
import { PaymentService } from "../services/PaymentService";
import Order from "../models/Order";
import User from "../models/User";
import ChargingSession from "../models/ChargingSession";

const router = express.Router();

//1. 钱包充值 - 创建支付订单
router.post(
  "/wallet/recharge",
  authenticate,
  asyncHandler(async (req: any, res: any) => {
    const { amount, paymentMethod = "alipay" } = req.body;
    const userId = req.user.id;

    // 验证支付参数
    const validation = PaymentService.validatePaymentParams({
      userId,
      amount,
      type: "recharge"
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    let result;
    if (paymentMethod === "alipay") {
      result = await PaymentService.createAlipayOrder({
        userId,
        amount,
        type: "recharge",
        description: `钱包充值 ¥${amount}`
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "钱包充值暂不支持余额支付",
      });
    }

    if (result.success) {
      res.json({
        success: true,
        data: {
          orderId: result.orderId,
          payUrl: result.payUrl,
          amount,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  })
);

// 2. 充电支付 - 创建支付订单
router.post(
  "/charging/pay",
  authenticate,
  asyncHandler(async (req: any, res: any) => {
    const { sessionId, paymentMethod = "balance" } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "充电会话ID不能为空",
      });
    }

    // 获取充电会话
    const session = await ChargingSession.findOne({ sessionId, userId });
    if (!session || session.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "无效的充电会话或会话未完成",
      });
    }

    if (session.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "该充电会话已支付",
      });
    }

    // 验证支付参数
    const validation = PaymentService.validatePaymentParams({
      userId,
      amount: session.totalCost,
      type: "charging",
      sessionId
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    let result;
    if (paymentMethod === "balance") {
      result = await PaymentService.processBalancePayment({
        userId,
        amount: session.totalCost,
        type: "charging",
        sessionId,
        description: `充电支付 - ${session.energyDelivered}kWh`
      });
    } else if (paymentMethod === "alipay") {
      result = await PaymentService.createAlipayOrder({
        userId,
        amount: session.totalCost,
        type: "charging",
        sessionId,
        description: `充电支付 - ${session.energyDelivered}kWh`
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "不支持的支付方式",
      });
    }

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          orderId: result.orderId,
          payUrl: result.payUrl,
          amount: session.totalCost,
          ...result.data
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  })
);

// 3. 支付宝支付回调 (使用PaymentService处理)
router.post(
  "/alipay/notify",
  asyncHandler(async (req: any, res: any) => {
    const params = req.body;

    try {
      const success = await PaymentService.handleAlipayNotify(params);
      
      if (success) {
        res.send("success");
      } else {
        res.status(400).send("error");
      }
    } catch (error) {
      console.error("支付回调处理错误:", error);
      res.status(500).send("error");
    }
  })
);

// 4. 获取订单详情
router.get(
  "/orders/:orderId",
  authenticate,
  asyncHandler(async (req: any, res: any) => {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ orderId, userId })
      .populate("sessionId", "sessionId energyDelivered duration totalCost")
      .populate("userId", "nickName phone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "订单不存在",
      });
    }

    res.json({
      success: true,
      data: { order },
    });
  })
);

// 5. 获取交易历史
router.get(
  "/transactions",
  authenticate,
  asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    const { type, status, page = 1, limit = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await (Order as any).findByUser(
      userId,
      type as string,
      status as string,
      Number(limit),
      skip
    );

    const total = await Order.countDocuments({
      userId,
      ...(type && { type }),
      ...(status && { status }),
    });

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  })
);

// 6. 获取支付统计
router.get(
  "/stats",
  authenticate,
  asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    let start, end;
    if (startDate) start = new Date(startDate as string);
    if (endDate) end = new Date(endDate as string);

    const [orderStats, user] = await Promise.all([
      (Order as any).getOrderStats(userId, start, end),
      User.findById(userId, "balance"),
    ]);

    res.json({
      success: true,
      data: {
        balance: user?.balance,
        orderStats,
        period: {
          startDate: start?.toISOString(),
          endDate: end?.toISOString(),
        },
      },
    });
  })
);

// 7. 查询支付宝订单状态
router.get(
  "/alipay/query/:orderId",
  authenticate,
  asyncHandler(async (req: any, res: any) => {
    const { orderId } = req.params;
    const userId = req.user.id;

    // 验证订单归属
    const order = await Order.findOne({ orderId, userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "订单不存在",
      });
    }

    try {
      const alipayResult = await PaymentService.queryAlipayOrder(orderId);
      
      res.json({
        success: true,
        data: {
          orderId,
          localStatus: order.status,
          alipayStatus: alipayResult,
        },
      });
    } catch (error) {
      console.error("查询支付宝订单状态失败:", error);
      res.status(500).json({
        success: false,
        message: "查询订单状态失败",
      });
    }
  })
);

// 8. 取消支付订单
router.post(
  "/orders/:orderId/cancel",
  authenticate,
  asyncHandler(async (req: any, res: any) => {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const result = await PaymentService.cancelOrder(orderId, userId, reason);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: { orderId }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  })
);

// 9. 获取用户钱包余额
router.get(
  "/wallet/balance",
  authenticate,
  asyncHandler(async (req: any, res: any) => {
    const userId = req.user.id;

    const user = await User.findById(userId, "balance");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "用户不存在",
      });
    }

    res.json({
      success: true,
      data: {
        balance: user.balance,
        userId
      },
    });
  })
);

export default router;
