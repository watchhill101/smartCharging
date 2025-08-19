import { alipaySdk, generateOrderNo, getProductCode, getTimeoutExpress } from '../config/alipay';
import Order, { IOrder } from '../models/Order';
import User from '../models/User';
import ChargingSession from '../models/ChargingSession';
import mongoose from 'mongoose';

export interface CreatePaymentOrderParams {
  userId: string;
  amount: number;
  type: 'charging' | 'recharge';
  sessionId?: string;
  description?: string;
}

export interface PaymentResult {
  success: boolean;
  orderId: string;
  payUrl?: string;
  message?: string;
  data?: any;
}

export interface AlipayNotifyParams {
  out_trade_no: string;
  trade_status: string;
  total_amount: string;
  trade_no: string;
  buyer_id?: string;
  seller_id?: string;
  gmt_create?: string;
  gmt_payment?: string;
  [key: string]: any;
}

export class PaymentService {
  /**
   * 创建支付宝支付订单
   */
  static async createAlipayOrder(params: CreatePaymentOrderParams): Promise<PaymentResult> {
    const { userId, amount, type, sessionId, description } = params;

    try {
      // 验证金额
      if (!amount || amount <= 0) {
        return {
          success: false,
          orderId: '',
          message: '支付金额必须大于0'
        };
      }

      // 验证充电会话（如果是充电支付）
      if (type === 'charging' && sessionId) {
        const session = await ChargingSession.findOne({ sessionId, userId });
        if (!session || session.status !== 'completed') {
          return {
            success: false,
            orderId: '',
            message: '无效的充电会话或会话未完成'
          };
        }

        if (session.paymentStatus === 'paid') {
          return {
            success: false,
            orderId: '',
            message: '该充电会话已支付'
          };
        }
      }

      // 创建订单
      const order = new Order({
        orderId: generateOrderNo(type === 'charging' ? 'CHARGE' : 'RECHARGE', userId),
        userId,
        type,
        amount,
        paymentMethod: 'alipay',
        sessionId: sessionId ? new mongoose.Types.ObjectId(sessionId) : undefined,
        description: description || `${type === 'charging' ? '充电支付' : '钱包充值'} ¥${amount}`,
      });

      await order.save();

      // 创建支付宝支付参数
      const orderParams = {
        bizContent: {
          out_trade_no: order.orderId,
          total_amount: amount.toString(),
          subject: type === 'charging' ? '智能充电-充电支付' : '智能充电-钱包充值',
          product_code: getProductCode('web'),
          notify_url: `${process.env.API_BASE_URL}/api/payments/alipay/notify`,
          return_url: `${process.env.FRONTEND_URL}/payment/success?orderId=${order.orderId}`,
          timeout_express: getTimeoutExpress(type),
        },
      };

      // 调用支付宝API
      const payUrl = await alipaySdk.pageExec('alipay.trade.page.pay', {
        method: 'GET',
        bizContent: orderParams.bizContent,
        notifyUrl: orderParams.bizContent.notify_url,
        returnUrl: orderParams.bizContent.return_url,
      });

      return {
        success: true,
        orderId: order.orderId,
        payUrl,
        data: {
          amount,
          type,
          description: order.description
        }
      };

    } catch (error) {
      console.error('创建支付宝订单失败:', error);
      return {
        success: false,
        orderId: '',
        message: '支付请求失败，请稍后重试'
      };
    }
  }

  /**
   * 处理余额支付
   */
  static async processBalancePayment(params: CreatePaymentOrderParams): Promise<PaymentResult> {
    const { userId, amount, type, sessionId, description } = params;

    const session = await mongoose.startSession();
    
    try {
      let result: PaymentResult = {
        success: false,
        orderId: '',
        message: '支付失败'
      };
      
      await session.withTransaction(async () => {
        // 验证充电会话（如果是充电支付）
        if (type === 'charging' && sessionId) {
          const chargingSession = await ChargingSession.findOne({ sessionId, userId }).session(session);
          if (!chargingSession || chargingSession.status !== 'completed') {
            throw new Error('无效的充电会话或会话未完成');
          }

          if (chargingSession.paymentStatus === 'paid') {
            throw new Error('该充电会话已支付');
          }
        }

        // 获取用户信息并检查余额
        const user = await User.findById(userId).session(session);
        if (!user) {
          throw new Error('用户不存在');
        }

        if (user.balance < amount) {
          throw new Error(`余额不足，当前余额: ¥${user.balance}, 需要: ¥${amount}`);
        }

        // 扣除余额
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { $inc: { balance: -amount } },
          { new: true, session }
        );

        if (!updatedUser) {
          throw new Error('余额扣除失败');
        }

        // 创建订单记录
        const order = new Order({
          orderId: generateOrderNo(type === 'charging' ? 'CHARGE' : 'RECHARGE', userId),
          userId,
          type,
          amount,
          paymentMethod: 'balance',
          sessionId: sessionId ? new mongoose.Types.ObjectId(sessionId) : undefined,
          description: description || `${type === 'charging' ? '充电支付' : '钱包充值'} ¥${amount}`,
          status: 'paid',
        });

        await order.save({ session });

        // 更新充电会话支付状态（如果是充电支付）
        if (type === 'charging' && sessionId) {
          await ChargingSession.findOneAndUpdate(
            { sessionId, userId },
            { paymentStatus: 'paid' },
            { session }
          );
        }

        result = {
          success: true,
          orderId: order.orderId,
          message: '余额支付成功',
          data: {
            remainingBalance: updatedUser.balance,
            amount,
            type
          }
        };
      });
      
      return result;
    } catch (error) {
      console.error('余额支付失败:', error);
      return {
        success: false,
        orderId: '',
        message: error instanceof Error ? error.message : '支付失败，请重试'
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * 处理支付宝回调通知
   */
  static async handleAlipayNotify(params: AlipayNotifyParams): Promise<boolean> {
    const { out_trade_no, trade_status, total_amount, trade_no } = params;

    try {
      // 验证签名
      const signVerified = alipaySdk.checkNotifySign(params);
      if (!signVerified) {
        console.error('支付宝回调签名验证失败:', out_trade_no);
        return false;
      }

      // 查找订单
      const order = await Order.findOne({ orderId: out_trade_no });
      if (!order) {
        console.error('订单不存在:', out_trade_no);
        return true; // 返回true避免支付宝重复通知
      }

      // 验证金额
      if (parseFloat(total_amount) !== order.amount) {
        console.error('支付金额不匹配:', {
          orderId: out_trade_no,
          expected: order.amount,
          received: total_amount
        });
        return false;
      }

      // 处理支付成功
      if (trade_status === 'TRADE_SUCCESS' && order.status !== 'paid') {
        const session = await mongoose.startSession();
        
        try {
          await session.withTransaction(async () => {
            // 再次检查订单状态（防止并发）
            const latestOrder = await Order.findOne({ orderId: out_trade_no }).session(session);
            if (!latestOrder || latestOrder.status === 'paid') {
              console.log(`订单${out_trade_no}已处理，跳过重复处理`);
              return;
            }

            // 更新订单状态
            await Order.findByIdAndUpdate(
              latestOrder._id,
              { 
                status: 'paid',
                thirdPartyOrderId: trade_no,
                metadata: { 
                  ...latestOrder.metadata, 
                  paidAt: new Date(),
                  alipayTradeNo: trade_no,
                  buyerId: params.buyer_id,
                  sellerId: params.seller_id,
                  gmtCreate: params.gmt_create,
                  gmtPayment: params.gmt_payment
                }
              },
              { session }
            );

            // 处理业务逻辑
            if (latestOrder.type === 'recharge') {
              // 钱包充值
              const updatedUser = await User.findByIdAndUpdate(
                latestOrder.userId,
                { $inc: { balance: latestOrder.amount } },
                { new: true, session }
              );

              console.log(
                `钱包充值成功: 用户${updatedUser?.nickName} 充值¥${latestOrder.amount}, 当前余额¥${updatedUser?.balance}`
              );
            } else if (latestOrder.type === 'charging') {
              // 充电支付
              await ChargingSession.findByIdAndUpdate(
                latestOrder.sessionId,
                { paymentStatus: 'paid' },
                { session }
              );

              console.log(
                `充电支付成功: 订单${out_trade_no} 金额¥${total_amount}`
              );
            }
          });

          return true;
        } catch (error) {
          console.error(`支付回调处理失败: 订单${out_trade_no}`, error);
          return false;
        } finally {
          await session.endSession();
        }
      }

      return true;
    } catch (error) {
      console.error('支付回调处理错误:', error);
      return false;
    }
  }

  /**
   * 查询支付宝订单状态
   */
  static async queryAlipayOrder(orderId: string): Promise<any> {
    try {
      const result = await alipaySdk.exec('alipay.trade.query', {
        bizContent: {
          out_trade_no: orderId
        }
      });

      return result;
    } catch (error) {
      console.error('查询支付宝订单状态失败:', error);
      throw error;
    }
  }

  /**
   * 取消支付订单
   */
  static async cancelOrder(orderId: string, userId: string, reason?: string): Promise<PaymentResult> {
    try {
      const order = await Order.findOne({ orderId, userId });
      if (!order) {
        return {
          success: false,
          orderId,
          message: '订单不存在'
        };
      }

      if (order.status === 'paid') {
        return {
          success: false,
          orderId,
          message: '已支付的订单无法取消'
        };
      }

      if (order.status === 'cancelled') {
        return {
          success: true,
          orderId,
          message: '订单已取消'
        };
      }

      // 更新订单状态
      await (order as any).markAsCancelled(reason || '用户取消');

      return {
        success: true,
        orderId,
        message: '订单取消成功'
      };
    } catch (error) {
      console.error('取消订单失败:', error);
      return {
        success: false,
        orderId,
        message: '取消订单失败，请稍后重试'
      };
    }
  }

  /**
   * 验证支付参数
   */
  static validatePaymentParams(params: CreatePaymentOrderParams): { valid: boolean; message?: string } {
    const { userId, amount, type } = params;

    if (!userId) {
      return { valid: false, message: '用户ID不能为空' };
    }

    if (!amount || amount <= 0) {
      return { valid: false, message: '支付金额必须大于0' };
    }

    if (type === 'recharge' && (amount < 1 || amount > 1000)) {
      return { valid: false, message: '充值金额必须在1-1000元之间' };
    }

    if (type === 'charging' && amount > 500) {
      return { valid: false, message: '单次充电费用不能超过500元' };
    }

    if (!['charging', 'recharge'].includes(type)) {
      return { valid: false, message: '无效的支付类型' };
    }

    return { valid: true };
  }
}