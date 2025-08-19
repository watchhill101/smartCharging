import mongoose from 'mongoose';
import Wallet, { IWallet, ITransaction, IInvoiceInfo, IInvoice } from '../models/Wallet';
import User from '../models/User';
import Order from '../models/Order';
import { PaymentService } from './PaymentService';

export interface WalletInfo {
  balance: number;
  frozenAmount: number;
  availableBalance: number;
  totalRecharge: number;
  totalConsume: number;
  paymentMethods: any[];
  settings: any;
}

export interface TransactionQuery {
  userId: string;
  type?: 'recharge' | 'consume' | 'refund' | 'withdraw';
  status?: 'pending' | 'completed' | 'failed' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface RechargeParams {
  userId: string;
  amount: number;
  paymentMethod: 'alipay' | 'wechat' | 'bank_card';
  description?: string;
}

export interface ConsumeParams {
  userId: string;
  amount: number;
  description: string;
  orderId?: string;
  sessionId?: string;
}

export interface BalanceAlert {
  userId: string;
  currentBalance: number;
  threshold: number;
  alertType: 'low_balance' | 'insufficient_balance';
  message: string;
}

export class WalletService {
  /**
   * 获取或创建用户钱包
   */
  static async getOrCreateWallet(userId: string): Promise<IWallet> {
    let wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      wallet = (Wallet as any).createDefaultWallet(new mongoose.Types.ObjectId(userId));
      await wallet.save();
    }
    
    return wallet;
  }

  /**
   * 获取钱包信息
   */
  static async getWalletInfo(userId: string): Promise<WalletInfo> {
    const wallet = await this.getOrCreateWallet(userId);
    
    return {
      balance: wallet.balance,
      frozenAmount: wallet.frozenAmount,
      availableBalance: wallet.getAvailableBalance(),
      totalRecharge: wallet.totalRecharge,
      totalConsume: wallet.totalConsume,
      paymentMethods: wallet.paymentMethods,
      settings: wallet.settings
    };
  }

  /**
   * 获取交易记录
   */
  static async getTransactions(query: TransactionQuery) {
    const { userId, type, status, startDate, endDate, page = 1, limit = 20 } = query;
    
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return {
        transactions: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      };
    }

    let transactions = wallet.transactions;

    // 筛选条件
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }
    if (status) {
      transactions = transactions.filter(t => t.status === status);
    }
    if (startDate) {
      transactions = transactions.filter(t => new Date(t.createdAt) >= startDate);
    }
    if (endDate) {
      transactions = transactions.filter(t => new Date(t.createdAt) <= endDate);
    }

    // 排序
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 分页
    const total = transactions.length;
    const startIndex = (page - 1) * limit;
    const paginatedTransactions = transactions.slice(startIndex, startIndex + limit);

    return {
      transactions: paginatedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 创建充值订单
   */
  static async createRechargeOrder(params: RechargeParams) {
    const { userId, amount, paymentMethod, description } = params;

    // 验证充值金额
    if (amount <= 0) {
      throw new Error('充值金额必须大于0');
    }
    if (amount > 10000) {
      throw new Error('单次充值金额不能超过10000元');
    }

    const wallet = await this.getOrCreateWallet(userId);

    // 使用PaymentService创建支付订单
    const paymentResult = await PaymentService.createAlipayOrder({
      userId,
      amount,
      type: 'recharge',
      description: description || `钱包充值 ¥${amount}`
    });

    if (!paymentResult.success) {
      throw new Error(paymentResult.message || '创建支付订单失败');
    }

    // 添加交易记录
    const transaction = wallet.addTransaction({
      type: 'recharge',
      amount,
      description: description || `${paymentMethod}充值`,
      paymentMethod,
      status: 'pending'
    });

    await wallet.save();

    return {
      orderId: paymentResult.orderId,
      transactionId: transaction.id,
      payUrl: paymentResult.payUrl,
      amount,
      paymentMethod,
      status: 'pending'
    };
  }

  /**
   * 余额消费
   */
  static async consumeBalance(params: ConsumeParams): Promise<{ success: boolean; message?: string; transactionId?: string }> {
    const { userId, amount, description, orderId, sessionId } = params;

    if (amount <= 0) {
      return { success: false, message: '消费金额必须大于0' };
    }

    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) {
          throw new Error('钱包不存在');
        }

        // 检查余额
        if (wallet.getAvailableBalance() < amount) {
          throw new Error(`余额不足，当前可用余额: ¥${wallet.getAvailableBalance()}, 需要: ¥${amount}`);
        }

        // 扣除余额
        wallet.balance -= amount;
        wallet.totalConsume += amount;

        // 添加交易记录
        const transaction = wallet.addTransaction({
          type: 'consume',
          amount,
          description,
          orderId,
          status: 'completed'
        });

        await wallet.save({ session });

        return {
          success: true,
          transactionId: transaction.id,
          message: '余额消费成功'
        };
      });
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '余额消费失败'
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * 余额充值（支付成功后调用）
   */
  static async rechargeBalance(userId: string, amount: number, orderId: string, paymentMethod: string): Promise<void> {
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) {
          throw new Error('钱包不存在');
        }

        // 增加余额
        wallet.balance += amount;
        wallet.totalRecharge += amount;

        // 更新交易记录状态
        const transaction = wallet.transactions.find(t => t.orderId === orderId);
        if (transaction) {
          transaction.status = 'completed';
          transaction.updatedAt = new Date();
        } else {
          // 如果没有找到交易记录，创建一个新的
          wallet.addTransaction({
            type: 'recharge',
            amount,
            description: `${paymentMethod}充值`,
            orderId,
            paymentMethod,
            status: 'completed'
          });
        }

        await wallet.save({ session });

        // 同时更新User模型中的余额
        await User.findByIdAndUpdate(
          userId,
          { balance: wallet.balance },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * 冻结金额
   */
  static async freezeAmount(userId: string, amount: number, reason: string): Promise<{ success: boolean; message?: string }> {
    try {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return { success: false, message: '钱包不存在' };
      }

      if (wallet.getAvailableBalance() < amount) {
        return { success: false, message: '可用余额不足' };
      }

      wallet.freezeAmount(amount);
      await wallet.save();

      // 添加交易记录
      wallet.addTransaction({
        type: 'consume',
        amount,
        description: `冻结金额: ${reason}`,
        status: 'pending'
      });

      await wallet.save();

      return { success: true, message: '金额冻结成功' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '冻结金额失败'
      };
    }
  }

  /**
   * 解冻金额
   */
  static async unfreezeAmount(userId: string, amount: number, reason: string): Promise<{ success: boolean; message?: string }> {
    try {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return { success: false, message: '钱包不存在' };
      }

      wallet.unfreezeAmount(amount);
      await wallet.save();

      // 添加交易记录
      wallet.addTransaction({
        type: 'refund',
        amount,
        description: `解冻金额: ${reason}`,
        status: 'completed'
      });

      await wallet.save();

      return { success: true, message: '金额解冻成功' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '解冻金额失败'
      };
    }
  }

  /**
   * 检查余额并发送提醒
   */
  static async checkBalanceAndAlert(userId: string, threshold: number = 10): Promise<BalanceAlert | null> {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return null;
    }

    const availableBalance = wallet.getAvailableBalance();

    if (availableBalance <= 0) {
      return {
        userId,
        currentBalance: availableBalance,
        threshold,
        alertType: 'insufficient_balance',
        message: '账户余额不足，请及时充值'
      };
    } else if (availableBalance <= threshold) {
      return {
        userId,
        currentBalance: availableBalance,
        threshold,
        alertType: 'low_balance',
        message: `账户余额较低（¥${availableBalance}），建议充值`
      };
    }

    return null;
  }

  /**
   * 获取钱包统计信息
   */
  static async getWalletStats(userId: string, startDate?: Date, endDate?: Date) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return null;
    }

    let transactions = wallet.transactions;

    // 时间范围筛选
    if (startDate || endDate) {
      transactions = transactions.filter(t => {
        const transactionDate = new Date(t.createdAt);
        if (startDate && transactionDate < startDate) return false;
        if (endDate && transactionDate > endDate) return false;
        return true;
      });
    }

    // 统计各类型交易
    const stats = {
      totalRecharge: 0,
      totalConsume: 0,
      totalRefund: 0,
      totalWithdraw: 0,
      transactionCount: transactions.length,
      rechargeCount: 0,
      consumeCount: 0,
      refundCount: 0,
      withdrawCount: 0
    };

    transactions.forEach(t => {
      if (t.status === 'completed') {
        switch (t.type) {
          case 'recharge':
            stats.totalRecharge += t.amount;
            stats.rechargeCount++;
            break;
          case 'consume':
            stats.totalConsume += t.amount;
            stats.consumeCount++;
            break;
          case 'refund':
            stats.totalRefund += t.amount;
            stats.refundCount++;
            break;
          case 'withdraw':
            stats.totalWithdraw += t.amount;
            stats.withdrawCount++;
            break;
        }
      }
    });

    return {
      currentBalance: wallet.balance,
      frozenAmount: wallet.frozenAmount,
      availableBalance: wallet.getAvailableBalance(),
      stats,
      period: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      }
    };
  }

  /**
   * 添加发票信息
   */
  static async addInvoiceInfo(userId: string, invoiceInfo: Omit<IInvoiceInfo, 'isDefault'>): Promise<{ success: boolean; message?: string }> {
    try {
      const wallet = await this.getOrCreateWallet(userId);
      
      wallet.addInvoiceInfo(invoiceInfo);
      await wallet.save();

      return { success: true, message: '发票信息添加成功' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '添加发票信息失败'
      };
    }
  }

  /**
   * 获取发票信息列表
   */
  static async getInvoiceInfoList(userId: string) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return [];
    }

    return wallet.invoiceInfo;
  }

  /**
   * 创建发票申请
   */
  static async createInvoiceApplication(
    userId: string, 
    transactionIds: string[], 
    invoiceType: 'electronic' | 'paper' = 'electronic'
  ): Promise<{ success: boolean; message?: string; invoiceId?: string }> {
    try {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return { success: false, message: '钱包不存在' };
      }

      // 验证交易记录
      const validTransactions = wallet.transactions.filter(t => 
        transactionIds.includes(t.id) && 
        t.status === 'completed' && 
        (t.type === 'recharge' || t.type === 'consume')
      );

      if (validTransactions.length === 0) {
        return { success: false, message: '没有找到有效的交易记录' };
      }

      // 计算发票金额
      const totalAmount = validTransactions.reduce((sum, t) => sum + t.amount, 0);

      // 获取默认发票信息
      const defaultInvoiceInfo = wallet.invoiceInfo.find(info => info.isDefault);
      if (!defaultInvoiceInfo) {
        return { success: false, message: '请先设置发票信息' };
      }

      // 创建发票记录
      const invoice = wallet.createInvoice({
        amount: totalAmount,
        title: defaultInvoiceInfo.title,
        taxNumber: defaultInvoiceInfo.taxNumber,
        content: '充电服务费',
        type: invoiceType,
        status: 'pending',
        transactionIds
      });

      await wallet.save();

      return {
        success: true,
        message: '发票申请创建成功',
        invoiceId: invoice.id
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '创建发票申请失败'
      };
    }
  }

  /**
   * 获取发票列表
   */
  static async getInvoiceList(userId: string, page: number = 1, limit: number = 20) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return {
        invoices: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      };
    }

    const invoices = wallet.invoices.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = invoices.length;
    const startIndex = (page - 1) * limit;
    const paginatedInvoices = invoices.slice(startIndex, startIndex + limit);

    return {
      invoices: paginatedInvoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 设置自动充值
   */
  static async setAutoRecharge(
    userId: string, 
    enabled: boolean, 
    threshold: number = 10, 
    amount: number = 50
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return { success: false, message: '钱包不存在' };
      }

      wallet.settings = {
        ...wallet.settings,
        autoRecharge: {
          enabled,
          threshold,
          amount
        }
      };

      await wallet.save();

      return { 
        success: true, 
        message: enabled ? '自动充值已开启' : '自动充值已关闭' 
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '设置自动充值失败'
      };
    }
  }
}