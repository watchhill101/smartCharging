import { RedisService } from './RedisService';
import { WebSocketService } from './WebSocketService';
import { ChargingService, ChargingSession } from './ChargingService';

export interface ChargingOrder {
  orderId: string;
  sessionId: string;
  userId: string;
  pileId: string;
  pileName: string;
  stationId: string;
  stationName: string;
  
  // 订单状态
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  
  // 时间信息
  createdAt: string;
  startTime?: string;
  endTime?: string;
  
  // 充电信息
  energyDelivered: number;
  duration: number;
  averagePower: number;
  
  // 费用信息
  totalCost: number;
  energyCost: number;
  serviceFee: number;
  parkingFee: number;
  discountAmount: number;
  
  // 支付信息
  paymentMethod: 'balance' | 'wechat' | 'alipay';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentTime?: string;
  transactionId?: string;
  
  // 优惠券信息
  couponId?: string;
  couponDiscount?: number;
  
  // 发票信息
  invoiceRequired: boolean;
  invoiceId?: string;
  
  // 异常信息
  errorCode?: string;
  errorMessage?: string;
  
  updatedAt: string;
}

export interface SessionAnomalyDetection {
  sessionId: string;
  anomalies: Array<{
    type: 'power_fluctuation' | 'temperature_high' | 'voltage_abnormal' | 'current_spike' | 'connection_lost';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
    value?: number;
    threshold?: number;
  }>;
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical';
  autoStopRecommended: boolean;
}

export interface ChargingNotification {
  id: string;
  userId: string;
  sessionId?: string;
  type: 'charging_started' | 'charging_completed' | 'charging_paused' | 'charging_resumed' | 'charging_stopped' | 'anomaly_detected' | 'payment_completed' | 'low_balance';
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channels: Array<'push' | 'sms' | 'email'>;
  sent: boolean;
  sentAt?: string;
  createdAt: string;
}

export class ChargingSessionService {
  private redis: RedisService;
  private webSocketService?: WebSocketService;
  private chargingService: ChargingService;
  private anomalyDetectionIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(redis: RedisService, chargingService: ChargingService) {
    this.redis = redis;
    this.chargingService = chargingService;
  }

  /**
   * 设置WebSocket服务
   */
  public setWebSocketService(webSocketService: WebSocketService) {
    this.webSocketService = webSocketService;
  }

  /**
   * 创建充电订单
   */
  public async createChargingOrder(session: ChargingSession): Promise<ChargingOrder> {
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const order: ChargingOrder = {
      orderId,
      sessionId: session.sessionId,
      userId: session.userId,
      pileId: session.pileId,
      pileName: session.pileName,
      stationId: session.stationId,
      stationName: session.stationName,
      
      status: 'pending',
      createdAt: new Date().toISOString(),
      
      energyDelivered: 0,
      duration: 0,
      averagePower: 0,
      
      totalCost: 0,
      energyCost: 0,
      serviceFee: 0,
      parkingFee: 0,
      discountAmount: 0,
      
      paymentMethod: session.paymentMethod as any,
      paymentStatus: 'pending',
      
      invoiceRequired: false,
      
      updatedAt: new Date().toISOString()
    };

    // 保存订单
    await this.saveOrder(order);
    
    // 创建订单索引
    await this.redis.sadd(`user:${session.userId}:orders`, orderId);
    await this.redis.setex(`session:${session.sessionId}:order`, 86400, orderId);

    console.log(`📋 创建充电订单: ${orderId}`);
    
    return order;
  }

  /**
   * 更新充电订单
   */
  public async updateChargingOrder(sessionId: string, updates: Partial<ChargingOrder>): Promise<ChargingOrder | null> {
    const orderIdData = await this.redis.get(`session:${sessionId}:order`);
    if (!orderIdData) {
      return null;
    }

    const order = await this.getOrder(orderIdData);
    if (!order) {
      return null;
    }

    const updatedOrder: ChargingOrder = {
      ...order,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.saveOrder(updatedOrder);
    
    console.log(`📋 更新充电订单: ${order.orderId}`);
    
    return updatedOrder;
  }

  /**
   * 完成充电订单
   */
  public async completeChargingOrder(sessionId: string): Promise<ChargingOrder | null> {
    const session = await this.chargingService.getChargingStatus(sessionId, '');
    if (!session) {
      throw new Error('充电会话不存在');
    }

    const orderIdData = await this.redis.get(`session:${sessionId}:order`);
    if (!orderIdData) {
      throw new Error('充电订单不存在');
    }

    const order = await this.getOrder(orderIdData);
    if (!order) {
      throw new Error('充电订单不存在');
    }

    // 计算最终费用
    const finalCost = this.calculateFinalCost(session);
    
    const completedOrder: ChargingOrder = {
      ...order,
      status: 'completed',
      endTime: session.endTime || new Date().toISOString(),
      energyDelivered: session.energyDelivered,
      duration: session.duration,
      averagePower: session.duration > 0 ? (session.energyDelivered * 3600) / session.duration : 0,
      totalCost: finalCost.total,
      energyCost: finalCost.energy,
      serviceFee: finalCost.service,
      parkingFee: finalCost.parking,
      discountAmount: finalCost.discount,
      paymentStatus: 'paid',
      paymentTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.saveOrder(completedOrder);
    
    // 发送完成通知
    await this.sendChargingNotification({
      userId: session.userId,
      sessionId,
      type: 'charging_completed',
      title: '充电完成',
      message: `充电已完成，共充电 ${session.energyDelivered.toFixed(2)} kWh，费用 ¥${finalCost.total.toFixed(2)}`,
      data: { orderId: order.orderId, totalCost: finalCost.total },
      priority: 'normal',
      channels: ['push', 'sms']
    });

    console.log(`✅ 完成充电订单: ${order.orderId}`);
    
    return completedOrder;
  }

  /**
   * 开始异常检测
   */
  public startAnomalyDetection(sessionId: string) {
    // 如果已有检测，先停止
    this.stopAnomalyDetection(sessionId);

    // 每10秒检测一次异常
    const interval = setInterval(async () => {
      try {
        await this.detectAnomalies(sessionId);
      } catch (error) {
        console.error(`❌ 异常检测失败 ${sessionId}:`, error);
      }
    }, 10000);

    this.anomalyDetectionIntervals.set(sessionId, interval);
    console.log(`🔍 开始异常检测: ${sessionId}`);
  }

  /**
   * 停止异常检测
   */
  public stopAnomalyDetection(sessionId: string) {
    const interval = this.anomalyDetectionIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.anomalyDetectionIntervals.delete(sessionId);
      console.log(`🔍 停止异常检测: ${sessionId}`);
    }
  }

  /**
   * 检测充电异常
   */
  private async detectAnomalies(sessionId: string): Promise<SessionAnomalyDetection | null> {
    const session = await this.chargingService.getChargingStatus(sessionId, '');
    if (!session || session.status !== 'charging') {
      return null;
    }

    const anomalies = [];
    const now = new Date().toISOString();

    // 功率波动检测
    if (session.currentPower < session.maxPower * 0.1) {
      anomalies.push({
        type: 'power_fluctuation' as const,
        severity: 'medium' as const,
        message: '充电功率异常偏低',
        timestamp: now,
        value: session.currentPower,
        threshold: session.maxPower * 0.1
      });
    }

    // 温度过高检测
    if (session.temperature > 60) {
      anomalies.push({
        type: 'temperature_high' as const,
        severity: session.temperature > 80 ? 'critical' : 'high',
        message: '充电桩温度过高',
        timestamp: now,
        value: session.temperature,
        threshold: 60
      });
    }

    // 电压异常检测
    if (session.voltage < 300 || session.voltage > 450) {
      anomalies.push({
        type: 'voltage_abnormal' as const,
        severity: 'high' as const,
        message: '电压超出正常范围',
        timestamp: now,
        value: session.voltage,
        threshold: session.voltage < 300 ? 300 : 450
      });
    }

    // 电流突变检测
    if (session.current > session.maxPower * 1000 / 220 * 1.2) {
      anomalies.push({
        type: 'current_spike' as const,
        severity: 'high' as const,
        message: '电流异常偏高',
        timestamp: now,
        value: session.current,
        threshold: session.maxPower * 1000 / 220
      });
    }

    if (anomalies.length === 0) {
      return null;
    }

    // 计算风险等级
    const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
    const highCount = anomalies.filter(a => a.severity === 'high').length;
    
    let riskLevel: 'safe' | 'warning' | 'danger' | 'critical';
    let autoStopRecommended = false;

    if (criticalCount > 0) {
      riskLevel = 'critical';
      autoStopRecommended = true;
    } else if (highCount > 1) {
      riskLevel = 'danger';
      autoStopRecommended = true;
    } else if (highCount > 0) {
      riskLevel = 'warning';
    } else {
      riskLevel = 'safe';
    }

    const detection: SessionAnomalyDetection = {
      sessionId,
      anomalies,
      riskLevel,
      autoStopRecommended
    };

    // 保存异常记录
    await this.redis.lpush(
      `anomalies:${sessionId}`,
      JSON.stringify(detection)
    );
    await this.redis.ltrim(`anomalies:${sessionId}`, 0, 99); // 保持最近100条

    // 发送异常通知
    if (riskLevel !== 'safe') {
      await this.sendChargingNotification({
        userId: session.userId,
        sessionId,
        type: 'anomaly_detected',
        title: '充电异常检测',
        message: `检测到${riskLevel === 'critical' ? '严重' : ''}充电异常，请注意安全`,
        data: detection,
        priority: riskLevel === 'critical' ? 'urgent' : 'high',
        channels: riskLevel === 'critical' ? ['push', 'sms'] : ['push']
      });

      // WebSocket实时推送
      if (this.webSocketService) {
        this.webSocketService.sendNotificationToSession(sessionId, {
          type: 'error',
          title: '充电异常',
          content: `检测到充电异常: ${anomalies.map(a => a.message).join(', ')}`,
          data: detection
        });
      }
    }

    // 自动停止建议
    if (autoStopRecommended) {
      console.log(`⚠️ 建议自动停止充电会话: ${sessionId} (风险等级: ${riskLevel})`);
      
      // 这里可以实现自动停止逻辑
      // await this.chargingService.stopChargingSession({
      //   sessionId,
      //   userId: session.userId,
      //   reason: 'auto_stop_anomaly'
      // });
    }

    console.log(`🔍 检测到充电异常: ${sessionId} (${anomalies.length}个异常)`);
    
    return detection;
  }

  /**
   * 发送充电通知
   */
  public async sendChargingNotification(notification: Omit<ChargingNotification, 'id' | 'sent' | 'sentAt' | 'createdAt'>) {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullNotification: ChargingNotification = {
      ...notification,
      id: notificationId,
      sent: false,
      createdAt: new Date().toISOString()
    };

    // 保存通知
    await this.redis.setex(
      `notification:${notificationId}`,
      86400, // 24小时过期
      JSON.stringify(fullNotification)
    );

    // 添加到用户通知队列
    await this.redis.lpush(
      `notifications:${notification.userId}`,
      notificationId
    );
    await this.redis.ltrim(`notifications:${notification.userId}`, 0, 199); // 保持最近200条

    // WebSocket推送
    if (this.webSocketService) {
      this.webSocketService.sendNotificationToUser(notification.userId, {
        type: notification.type as any,
        title: notification.title,
        content: notification.message,
        data: notification.data
      });
    }

    // 标记为已发送
    fullNotification.sent = true;
    fullNotification.sentAt = new Date().toISOString();
    
    await this.redis.setex(
      `notification:${notificationId}`,
      86400,
      JSON.stringify(fullNotification)
    );

    console.log(`🔔 发送充电通知: ${notification.type} -> 用户 ${notification.userId}`);
    
    return fullNotification;
  }

  /**
   * 获取用户通知历史
   */
  public async getUserNotifications(userId: string, limit: number = 50): Promise<ChargingNotification[]> {
    const notificationIds = await this.redis.lrange(`notifications:${userId}`, 0, limit - 1);
    const notifications: ChargingNotification[] = [];

    for (const id of notificationIds) {
      const data = await this.redis.get(`notification:${id}`);
      if (data) {
        notifications.push(JSON.parse(data));
      }
    }

    return notifications;
  }

  /**
   * 获取会话异常历史
   */
  public async getSessionAnomalies(sessionId: string, limit: number = 20): Promise<SessionAnomalyDetection[]> {
    const anomalyData = await this.redis.lrange(`anomalies:${sessionId}`, 0, limit - 1);
    return anomalyData.map(data => JSON.parse(data));
  }

  /**
   * 计算最终费用
   */
  private calculateFinalCost(session: ChargingSession) {
    const energyCost = session.energyDelivered * session.pricePerKwh;
    const serviceFee = energyCost * 0.05; // 5%服务费
    const parkingFee = Math.max(0, (session.duration - 3600) / 3600) * 2; // 超过1小时收停车费
    const discount = 0; // 优惠券折扣
    
    const total = energyCost + serviceFee + parkingFee - discount;

    return {
      energy: energyCost,
      service: serviceFee,
      parking: parkingFee,
      discount,
      total: Math.max(0, total)
    };
  }

  // 辅助方法
  private async saveOrder(order: ChargingOrder) {
    await this.redis.setex(
      `order:${order.orderId}`,
      86400 * 30, // 30天过期
      JSON.stringify(order)
    );
  }

  private async getOrder(orderId: string): Promise<ChargingOrder | null> {
    const data = await this.redis.get(`order:${orderId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 获取用户订单历史
   */
  public async getUserOrders(userId: string, page: number = 1, limit: number = 20) {
    const orderIds = await this.redis.smembers(`user:${userId}:orders`);
    const orders: ChargingOrder[] = [];

    for (const orderId of orderIds) {
      const order = await this.getOrder(orderId);
      if (order) {
        orders.push(order);
      }
    }

    // 按创建时间倒序排序
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 分页
    const total = orders.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedOrders = orders.slice(startIndex, startIndex + limit);

    return {
      orders: paginatedOrders,
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * 清理过期数据
   */
  public async cleanupExpiredData() {
    // 清理过期的异常检测间隔
    for (const [sessionId, interval] of this.anomalyDetectionIntervals) {
      const session = await this.chargingService.getChargingStatus(sessionId, '');
      if (!session || ['completed', 'faulted'].includes(session.status)) {
        this.stopAnomalyDetection(sessionId);
      }
    }

    console.log('🧹 清理过期数据完成');
  }
}