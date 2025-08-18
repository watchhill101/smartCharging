import express from "express";
import mongoose from "mongoose";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { alipaySdk, generateOrderNo } from "../config/alipay";
import Order from "../models/Order";
import User from "../models/User";
import ChargingSession from "../models/ChargingSession";

const router = express.Router();

//1. 钱包充值 - 创建支付订单
router.post(
  "/wallet/recharge",
  authenticate,
  asyncHandler(async (req: any, res: any) => {
    const { amount } = req.body;
    const userId = req.user.id;

    // 验证金额
    if (!amount || amount < 1 || amount > 1000) {
      return res.status(400).json({
        success: false,
        message: "充值金额必须在1-1000元之间",
      });
    }

    // 创建订单
    const order = new Order({
      orderId: generateOrderNo("RECHARGE", userId),
      userId,
      type: "recharge",
      amount,
      paymentMethod: "alipay",
      description: `钱包充值 ¥${amount}`,
    });

    await order.save();

    // 创建支付宝支付链接
    const orderParams = {
      bizContent: {
        out_trade_no: order.orderId,
        total_amount: amount.toString(),
        subject: `智能充电-钱包充值`,
        product_code: "FAST_INSTANT_TRADE_PAY",
        notify_url: `${process.env.API_BASE_URL}/api/payments/alipay/notify`,
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
      },
    };

    try {
      const payUrl = await alipaySdk.pageExec("alipay.trade.page.pay", {
        method: "GET",
        bizContent: orderParams.bizContent,
        notifyUrl: orderParams.bizContent.notify_url,
        returnUrl: orderParams.bizContent.return_url,
      });

      res.json({
        success: true,
        data: {
          orderId: order.orderId,
          payUrl,
          amount,
        },
      });
    } catch (error) {
      console.error("支付宝接口错误:", error);
      await (order as any).markAsCancelled("支付接口调用失败");

      res.status(500).json({
        success: false,
        message: "支付请求失败，请稍后重试",
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

    const user = await User.findById(userId);

    // 余额支付 - 使用事务保证原子性
    if (paymentMethod === "balance") {
      const session_transaction = await mongoose.startSession();
      
      try {
        await session_transaction.withTransaction(async () => {
          // 重新获取用户信息（带锁）
          const userWithLock = await User.findById(userId).session(session_transaction);
          
          if (!userWithLock || userWithLock.balance < session.totalCost) {
            throw new Error(`余额不足，当前余额: ¥${userWithLock?.balance || 0}, 需要: ¥${session.totalCost}`);
          }

          // 原子性扣除余额
          const updateResult = await User.findByIdAndUpdate(
            userId,
            { $inc: { balance: -session.totalCost } },
            { new: true, session: session_transaction }
          );

          if (!updateResult) {
            throw new Error("余额扣除失败");
          }

          // 创建订单记录
          const order = new Order({
            orderId: generateOrderNo("CHARGE", userId),
            userId,
            type: "charging",
            amount: session.totalCost,
            paymentMethod: "balance",
            sessionId: session._id,
            description: `充电支付 - ${session.energyDelivered}kWh`,
            status: "paid",
          });

          await order.save({ session: session_transaction });

          // 更新充电会话支付状态
          await ChargingSession.findByIdAndUpdate(
            session._id,
            { paymentStatus: "paid" },
            { session: session_transaction }
          );

          return res.json({
            success: true,
            message: "余额支付成功",
            data: {
              orderId: order.orderId,
              remainingBalance: updateResult.balance,
            },
          });
        });
      } catch (error) {
        console.error("余额支付事务失败:", error);
        return res.status(400).json({
          success: false,
          message: error.message || "支付失败，请重试",
        });
      } finally {
        await session_transaction.endSession();
      }
    }

    // 支付宝支付
    if (paymentMethod === "alipay") {
      const order = new Order({
        orderId: generateOrderNo("CHARGE", userId),
        userId,
        type: "charging",
        amount: session.totalCost,
        paymentMethod: "alipay",
        sessionId: session._id,
        description: `充电支付 - ${session.energyDelivered}kWh`,
      });

      await order.save();

      const orderParams = {
        bizContent: {
          out_trade_no: order.orderId,
          total_amount: session.totalCost.toString(),
          subject: `智能充电-${session.energyDelivered}kWh`,
          product_code: "FAST_INSTANT_TRADE_PAY",
          notify_url: `${process.env.API_BASE_URL}/api/payments/alipay/notify`,
          return_url: `${process.env.FRONTEND_URL}/payment/success`,
        },
      };

      try {
        const payUrl = await alipaySdk.pageExec("alipay.trade.page.pay", {
          method: "GET",
          bizContent: orderParams.bizContent,
          notifyUrl: orderParams.bizContent.notify_url,
          returnUrl: orderParams.bizContent.return_url,
        });

        res.json({
          success: true,
          data: {
            orderId: order.orderId,
            payUrl,
            amount: session.totalCost,
          },
        });
      } catch (error) {
        console.error("支付宝接口错误:", error);
        await (order as any).markAsCancelled("支付接口调用失败");

        res.status(500).json({
          success: false,
          message: "支付请求失败，请稍后重试",
        });
      }
    }
  })
);

// 3. 支付宝支付回调 (修正版)
router.post(
  "/alipay/notify",
  asyncHandler(async (req: any, res: any) => {
    const params = req.body;

    try {
      // 验证签名
      const signVerified = alipaySdk.checkNotifySign(params);

      if (!signVerified) {
        console.error("支付宝回调签名验证失败");
        return res.status(400).send("invalid signature");
      }

      const { out_trade_no, trade_status, total_amount, trade_no } = params;

      // 查找订单
      const order = await Order.findOne({ orderId: out_trade_no });
      if (!order) {
        console.error("订单不存在:", out_trade_no);
        return res.send("success"); // 避免支付宝重复通知
      }

      // 支付成功 - 使用事务处理并防重复
      if (trade_status === "TRADE_SUCCESS") {
        if (order.status !== "paid") {
          const session_transaction = await mongoose.startSession();
          
          try {
            await session_transaction.withTransaction(async () => {
              // 再次检查订单状态（防止并发）
              const latestOrder = await Order.findOne({ 
                orderId: out_trade_no 
              }).session(session_transaction);
              
              if (!latestOrder || latestOrder.status === "paid") {
                console.log(`订单${out_trade_no}已处理，跳过重复处理`);
                return;
              }

              // 标记订单为已支付
              await Order.findByIdAndUpdate(
                latestOrder._id,
                { 
                  status: "paid",
                  thirdPartyOrderId: trade_no,
                  metadata: { 
                    ...latestOrder.metadata, 
                    paidAt: new Date(),
                    alipayTradeNo: trade_no 
                  }
                },
                { session: session_transaction }
              );

              // 处理业务逻辑
              if (latestOrder.type === "recharge") {
                // 钱包充值 - 原子性增加余额
                const updatedUser = await User.findByIdAndUpdate(
                  latestOrder.userId,
                  { $inc: { balance: latestOrder.amount } },
                  { new: true, session: session_transaction }
                );

                console.log(
                  `钱包充值成功: 用户${updatedUser?.nickName} 充值¥${latestOrder.amount}, 当前余额¥${updatedUser?.balance}`
                );
              } else if (latestOrder.type === "charging") {
                // 充电支付
                await ChargingSession.findByIdAndUpdate(
                  latestOrder.sessionId,
                  { paymentStatus: "paid" },
                  { session: session_transaction }
                );

                console.log(
                  `充电支付成功: 订单${out_trade_no} 金额¥${total_amount}`
                );
              }
            });
          } catch (error) {
            console.error(`支付回调处理失败: 订单${out_trade_no}`, error);
            // 这里不抛出错误，避免支付宝重复回调
          } finally {
            await session_transaction.endSession();
          }
        } else {
          console.log(`订单${out_trade_no}已支付，跳过处理`);
        }
      }

      res.send("success");
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

export default router;
