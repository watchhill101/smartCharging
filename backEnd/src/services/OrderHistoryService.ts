import mongoose from 'mongoose';
import Order, { IOrder } from '../models/Order';
import ChargingSession, { IChargingSession } from '../models/ChargingSession';
import { RedisService } from './RedisService';
import { logger } from '../utils/logger';

export interface OrderHistoryItem {
  id: string;
  orderId: string;
  type: 'charging' | 'recharge';
  amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  paymentMethod: 'balance' | 'alipay';
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  // 充电会话相关信息
  session?: {
    sessionId: string;
    stationId: string;
    stationName?: string;
    chargerId: string;
    startTime: Date;
    endTime?: Date;
    duration: number;
    energyDelivered: number;
    startPowerLevel?: number;
    endPowerLevel?: number;
  };
}

export interface OrderSearchParams {
  userId: string;
  type?: 'charging' | 'recharge';
  status?: 'pending' | 'paid' | 'cancelled' | 'refunded';
  paymentMethod?: 'balance' | 'alipay';
  startDate?: Date;
  endDate?: Date;
  keyword?: string; // 搜索订单号或描述
  page?: number;
  limit?: number;
}

export interface OrderHistoryResponse {
  orders: OrderHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statistics: {
    totalOrders: number;
    totalAmount: number;
    paidOrders: number;
    paidAmount: number;
    chargingOrders: number;
    rechargeOrders: number;
  };
}

export interface OrderDetailResponse {
  order: OrderHistoryItem;
  relatedOrders?: OrderHistoryItem[]; // 相关订单（如同一充电会话的其他订单）
}

export interface OrderExportParams {
  userId: string;
  type?: 'charging' | 'recharge';
  status?: 'pending' | 'paid' | 'cancelled' | 'refunded';
  startDate?: Date;
  endDate?: Date;
  format: 'csv' | 'excel' | 'pdf';
}

export interface OrderStatistics {
  totalOrders: number;
  totalAmount: number;
  paidOrders: number;
  paidAmount: number;
  chargingOrders: number;
  rechargeOrders: number;
  monthlyStats: Array<{
    month: string;
    orders: number;
    amount: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  paymentMethodDistribution: Array<{
    method: string;
    count: number;
    percentage: number;
  }>;
}

export class OrderHistoryService {
  private static redisService = new RedisService();

  /**
   * 获取用户订单历史
   */
  static async getOrderHistory(params: OrderSearchParams): Promise<OrderHistoryResponse> {
    try {
      const {
        userId,
        type,
        status,
        paymentMethod,
        startDate,
        endDate,
        keyword,
        page = 1,
        limit = 20
      } = params;

      // 构建查询条件
      const query: any = { userId: new mongoose.Types.ObjectId(userId) };

      if (type) query.type = type;
      if (status) query.status = status;
      if (paymentMethod) query.paymentMethod = paymentMethod;

      // 日期范围查询
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = startDate;
        if (endDate) query.createdAt.$lte = endDate;
      }

      // 关键词搜索
      if (keyword) {
        query.$or = [
          { orderId: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } }
        ];
      }

      // 分页参数
      const skip = (page - 1) * limit;

      // 并行查询订单和总数
      const [orders, total] = await Promise.all([
        Order.find(query)
          .populate({
            path: 'sessionId',
            select: 'sessionId stationId chargerId startTime endTime duration energyDelivered startPowerLevel endPowerLevel',
            populate: {
              path: 'stationId',
              select: 'name address'
            }
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Order.countDocuments(query)
      ]);

      // 转换订单数据
      const orderItems: OrderHistoryItem[] = orders.map(order => ({
        id: order._id.toString(),
        orderId: order.orderId,
        type: order.type,
        amount: order.amount,
        status: order.status,
        paymentMethod: order.paymentMethod,
        description: order.description,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        session: order.sessionId && typeof order.sessionId === 'object' ? {
          sessionId: (order.sessionId as any).sessionId,
          stationId: (order.sessionId as any).stationId?._id?.toString() || (order.sessionId as any).stationId,
          stationName: (order.sessionId as any).stationId?.name,
          chargerId: (order.sessionId as any).chargerId,
          startTime: (order.sessionId as any).startTime,
          endTime: (order.sessionId as any).endTime,
          duration: (order.sessionId as any).duration,
          energyDelivered: (order.sessionId as any).energyDelivered,
          startPowerLevel: (order.sessionId as any).startPowerLevel,
          endPowerLevel: (order.sessionId as any).endPowerLevel
        } : undefined
      }));

      // 计算统计信息
      const statistics = await this.calculateOrderStatistics(userId, startDate, endDate);

      return {
        orders: orderItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        statistics
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取订单历史失败');
    }
  }

  /**
   * 获取订单详情
   */
  static async getOrderDetail(userId: string, orderId: string): Promise<OrderDetailResponse | null> {
    try {
      const order = await Order.findOne({ 
        orderId, 
        userId: new mongoose.Types.ObjectId(userId) 
      })
        .populate({
          path: 'sessionId',
          select: 'sessionId stationId chargerId startTime endTime duration energyDelivered startPowerLevel endPowerLevel',
          populate: {
            path: 'stationId',
            select: 'name address location'
          }
        })
        .lean();

      if (!order) {
        return null;
      }

      const orderItem: OrderHistoryItem = {
        id: order._id.toString(),
        orderId: order.orderId,
        type: order.type,
        amount: order.amount,
        status: order.status,
        paymentMethod: order.paymentMethod,
        description: order.description,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        session: order.sessionId && typeof order.sessionId === 'object' ? {
          sessionId: (order.sessionId as any).sessionId,
          stationId: (order.sessionId as any).stationId?._id?.toString() || (order.sessionId as any).stationId,
          stationName: (order.sessionId as any).stationId?.name,
          chargerId: (order.sessionId as any).chargerId,
          startTime: (order.sessionId as any).startTime,
          endTime: (order.sessionId as any).endTime,
          duration: (order.sessionId as any).duration,
          energyDelivered: (order.sessionId as any).energyDelivered,
          startPowerLevel: (order.sessionId as any).startPowerLevel,
          endPowerLevel: (order.sessionId as any).endPowerLevel
        } : undefined
      };

      // 查找相关订单（同一充电会话的其他订单）
      let relatedOrders: OrderHistoryItem[] = [];
      if (order.sessionId) {
        const related = await Order.find({
          sessionId: order.sessionId._id,
          _id: { $ne: order._id },
          userId: new mongoose.Types.ObjectId(userId)
        }).lean();

        relatedOrders = related.map(relatedOrder => ({
          id: relatedOrder._id.toString(),
          orderId: relatedOrder.orderId,
          type: relatedOrder.type,
          amount: relatedOrder.amount,
          status: relatedOrder.status,
          paymentMethod: relatedOrder.paymentMethod,
          description: relatedOrder.description,
          createdAt: relatedOrder.createdAt,
          updatedAt: relatedOrder.updatedAt
        }));
      }

      return {
        order: orderItem,
        relatedOrders: relatedOrders.length > 0 ? relatedOrders : undefined
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取订单详情失败');
    }
  }

  /**
   * 搜索订单
   */
  static async searchOrders(
    userId: string, 
    keyword: string, 
    page = 1, 
    limit = 20
  ): Promise<{
    orders: OrderHistoryItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const query = {
        userId: new mongoose.Types.ObjectId(userId),
        $or: [
          { orderId: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } }
        ]
      };

      const skip = (page - 1) * limit;

      const [orders, total] = await Promise.all([
        Order.find(query)
          .populate({
            path: 'sessionId',
            select: 'sessionId stationId chargerId startTime endTime duration energyDelivered',
            populate: {
              path: 'stationId',
              select: 'name'
            }
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Order.countDocuments(query)
      ]);

      const orderItems: OrderHistoryItem[] = orders.map(order => ({
        id: order._id.toString(),
        orderId: order.orderId,
        type: order.type,
        amount: order.amount,
        status: order.status,
        paymentMethod: order.paymentMethod,
        description: order.description,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        session: order.sessionId && typeof order.sessionId === 'object' ? {
          sessionId: (order.sessionId as any).sessionId,
          stationId: (order.sessionId as any).stationId?._id?.toString() || (order.sessionId as any).stationId,
          stationName: (order.sessionId as any).stationId?.name,
          chargerId: (order.sessionId as any).chargerId,
          startTime: (order.sessionId as any).startTime,
          endTime: (order.sessionId as any).endTime,
          duration: (order.sessionId as any).duration,
          energyDelivered: (order.sessionId as any).energyDelivered
        } : undefined
      }));

      return {
        orders: orderItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '搜索订单失败');
    }
  }

  /**
   * 获取订单统计信息
   */
  static async getOrderStatistics(
    userId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<OrderStatistics> {
    try {
      const matchQuery: any = { userId: new mongoose.Types.ObjectId(userId) };
      
      if (startDate || endDate) {
        matchQuery.createdAt = {};
        if (startDate) matchQuery.createdAt.$gte = startDate;
        if (endDate) matchQuery.createdAt.$lte = endDate;
      }

      // 基础统计
      const [basicStats, monthlyStats, statusStats, paymentStats] = await Promise.all([
        this.calculateOrderStatistics(userId, startDate, endDate),
        this.getMonthlyStatistics(userId, startDate, endDate),
        this.getStatusDistribution(userId, startDate, endDate),
        this.getPaymentMethodDistribution(userId, startDate, endDate)
      ]);

      return {
        ...basicStats,
        monthlyStats,
        statusDistribution: statusStats,
        paymentMethodDistribution: paymentStats
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取订单统计失败');
    }
  }

  /**
   * 导出订单数据
   */
  static async exportOrders(params: OrderExportParams): Promise<{
    success: boolean;
    message?: string;
    downloadUrl?: string;
    fileName?: string;
  }> {
    try {
      const { userId, type, status, startDate, endDate, format } = params;

      // 构建查询条件
      const query: any = { userId: new mongoose.Types.ObjectId(userId) };
      if (type) query.type = type;
      if (status) query.status = status;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = startDate;
        if (endDate) query.createdAt.$lte = endDate;
      }

      // 获取所有匹配的订单
      const orders = await Order.find(query)
        .populate({
          path: 'sessionId',
          select: 'sessionId stationId chargerId startTime endTime duration energyDelivered',
          populate: {
            path: 'stationId',
            select: 'name address'
          }
        })
        .sort({ createdAt: -1 })
        .lean();

      if (orders.length === 0) {
        return {
          success: false,
          message: '没有找到符合条件的订单数据'
        };
      }

      // 生成文件名
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `orders_${userId}_${timestamp}.${format}`;

      // 根据格式生成文件
      let downloadUrl: string;
      switch (format) {
        case 'csv':
          downloadUrl = await this.generateCSV(orders, fileName);
          break;
        case 'excel':
          downloadUrl = await this.generateExcel(orders, fileName);
          break;
        case 'pdf':
          downloadUrl = await this.generatePDF(orders, fileName);
          break;
        default:
          throw new Error('不支持的导出格式');
      }

      return {
        success: true,
        message: '订单数据导出成功',
        downloadUrl,
        fileName
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '导出订单数据失败'
      };
    }
  }

  /**
   * 计算基础订单统计
   */
  private static async calculateOrderStatistics(
    userId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<{
    totalOrders: number;
    totalAmount: number;
    paidOrders: number;
    paidAmount: number;
    chargingOrders: number;
    rechargeOrders: number;
  }> {
    const matchQuery: any = { userId: new mongoose.Types.ObjectId(userId) };
    
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = startDate;
      if (endDate) matchQuery.createdAt.$lte = endDate;
    }

    const stats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          paidOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          },
          paidAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] }
          },
          chargingOrders: {
            $sum: { $cond: [{ $eq: ['$type', 'charging'] }, 1, 0] }
          },
          rechargeOrders: {
            $sum: { $cond: [{ $eq: ['$type', 'recharge'] }, 1, 0] }
          }
        }
      }
    ]);

    return stats[0] || {
      totalOrders: 0,
      totalAmount: 0,
      paidOrders: 0,
      paidAmount: 0,
      chargingOrders: 0,
      rechargeOrders: 0
    };
  }

  /**
   * 获取月度统计
   */
  private static async getMonthlyStatistics(
    userId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<Array<{ month: string; orders: number; amount: number; }>> {
    const matchQuery: any = { userId: new mongoose.Types.ObjectId(userId) };
    
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = startDate;
      if (endDate) matchQuery.createdAt.$lte = endDate;
    }

    const monthlyStats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          orders: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      },
      {
        $project: {
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              { $cond: [
                { $lt: ['$_id.month', 10] },
                { $concat: ['0', { $toString: '$_id.month' }] },
                { $toString: '$_id.month' }
              ]}
            ]
          },
          orders: 1,
          amount: 1
        }
      },
      { $sort: { month: 1 } }
    ]);

    return monthlyStats;
  }

  /**
   * 获取状态分布
   */
  private static async getStatusDistribution(
    userId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<Array<{ status: string; count: number; percentage: number; }>> {
    const matchQuery: any = { userId: new mongoose.Types.ObjectId(userId) };
    
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = startDate;
      if (endDate) matchQuery.createdAt.$lte = endDate;
    }

    const statusStats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = statusStats.reduce((sum, stat) => sum + stat.count, 0);

    return statusStats.map(stat => ({
      status: stat._id,
      count: stat.count,
      percentage: total > 0 ? Math.round((stat.count / total) * 100) : 0
    }));
  }

  /**
   * 获取支付方式分布
   */
  private static async getPaymentMethodDistribution(
    userId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<Array<{ method: string; count: number; percentage: number; }>> {
    const matchQuery: any = { userId: new mongoose.Types.ObjectId(userId) };
    
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = startDate;
      if (endDate) matchQuery.createdAt.$lte = endDate;
    }

    const paymentStats = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = paymentStats.reduce((sum, stat) => sum + stat.count, 0);

    return paymentStats.map(stat => ({
      method: stat._id,
      count: stat.count,
      percentage: total > 0 ? Math.round((stat.count / total) * 100) : 0
    }));
  }

  /**
   * 生成CSV文件
   */
  private static async generateCSV(orders: any[], fileName: string): Promise<string> {
    // 这里应该实现CSV生成逻辑
    // 为了演示，返回一个模拟的URL
    const baseUrl = process.env.EXPORT_BASE_URL || '/api/exports';
    return `${baseUrl}/${fileName}`;
  }

  /**
   * 生成Excel文件
   */
  private static async generateExcel(orders: any[], fileName: string): Promise<string> {
    // 这里应该实现Excel生成逻辑
    // 为了演示，返回一个模拟的URL
    const baseUrl = process.env.EXPORT_BASE_URL || '/api/exports';
    return `${baseUrl}/${fileName}`;
  }

  /**
   * 生成PDF文件
   */
  private static async generatePDF(orders: any[], fileName: string): Promise<string> {
    // 这里应该实现PDF生成逻辑
    // 为了演示，返回一个模拟的URL
    const baseUrl = process.env.EXPORT_BASE_URL || '/api/exports';
    return `${baseUrl}/${fileName}`;
  }

  /**
   * 清除订单缓存
   */
  static async clearOrderCache(userId: string): Promise<void> {
    try {
      const pattern = `order_history:${userId}:*`;
      const keys = await this.redisService.keys(pattern);
      if (keys.length > 0) {
        for (const key of keys) {
          await this.redisService.del(key);
        }
      }
    } catch (error) {
      logger.error('清除订单缓存失败', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error.stack : undefined);
    }
  }
}