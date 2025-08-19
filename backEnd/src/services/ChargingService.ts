import { RedisService } from './RedisService';
import { WebSocketService, ChargingStatusUpdate } from './WebSocketService';

export interface StartChargingRequest {
  userId: string;
  pileId: string;
  pileCode?: string;
  targetSoc?: number;
  maxEnergy?: number;
  maxCost?: number;
  paymentMethod?: 'balance' | 'wechat' | 'alipay';
}

export interface StopChargingRequest {
  sessionId: string;
  userId: string;
  reason?: string;
}

export interface ChargingSession {
  sessionId: string;
  userId: string;
  pileId: string;
  pileName: string;
  stationId: string;
  stationName: string;
  status: 'preparing' | 'charging' | 'suspended' | 'finishing' | 'completed' | 'faulted';
  startTime: string;
  endTime?: string;
  duration: number;
  targetSoc?: number;
  maxEnergy?: number;
  maxCost?: number;
  paymentMethod: string;
  
  // 实时数据
  currentPower: number;
  maxPower: number;
  energyDelivered: number;
  voltage: number;
  current: number;
  temperature: number;
  cost: number;
  pricePerKwh: number;
  
  // 车辆信息
  vehicleInfo?: {
    batteryCapacity: number;
    currentSoc: number;
    targetSoc: number;
  };
  
  // 异常信息
  errorCode?: string;
  errorMessage?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface ChargingHistory {
  sessions: ChargingSession[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ChargingStats {
  totalSessions: number;
  totalEnergy: number;
  totalCost: number;
  totalDuration: number;
  averageEnergy: number;
  averageCost: number;
  averageDuration: number;
  successRate: number;
  monthlyData: Array<{
    month: string;
    sessions: number;
    energy: number;
    cost: number;
  }>;
}

export class ChargingService {
  private redis: RedisService;
  private webSocketService?: WebSocketService;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(redis: RedisService) {
    this.redis = redis;
  }

  /**
   * 设置WebSocket服务（避免循环依赖）
   */
  public setWebSocketService(webSocketService: WebSocketService) {
    this.webSocketService = webSocketService;
  }

  /**
   * 启动充电会话
   */
  public async startChargingSession(request: StartChargingRequest): Promise<ChargingSession> {
    const {
      userId,
      pileId,
      pileCode,
      targetSoc = 80,
      maxEnergy,
      maxCost,
      paymentMethod = 'balance'
    } = request;

    // 生成会话ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 检查充电桩状态
    const pileStatus = await this.getPileStatus(pileId);
    if (pileStatus !== 'available') {
      throw new Error('充电桩不可用');
    }

    // 检查用户是否有进行中的充电会话
    const activeSession = await this.getActiveSessionByUser(userId);
    if (activeSession) {
      throw new Error('您已有进行中的充电会话');
    }

    // 获取充电桩信息
    const pileInfo = await this.getPileInfo(pileId);
    if (!pileInfo) {
      throw new Error('充电桩信息不存在');
    }

    // 创建充电会话
    const session: ChargingSession = {
      sessionId,
      userId,
      pileId,
      pileName: pileInfo.name,
      stationId: pileInfo.stationId,
      stationName: pileInfo.stationName,
      status: 'preparing',
      startTime: new Date().toISOString(),
      duration: 0,
      targetSoc,
      maxEnergy,
      maxCost,
      paymentMethod,
      
      currentPower: 0,
      maxPower: pileInfo.maxPower,
      energyDelivered: 0,
      voltage: 0,
      current: 0,
      temperature: 0,
      cost: 0,
      pricePerKwh: pileInfo.pricePerKwh,
      
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 保存会话到Redis
    await this.saveSession(session);

    // 设置充电桩状态为占用
    await this.setPileStatus(pileId, 'occupied');

    // 启动充电桩（模拟）
    await this.startPileCharging(pileId, sessionId);

    // 开始监控充电状态
    this.startChargingMonitor(sessionId);

    console.log(`✅ 充电会话启动成功: ${sessionId}`);
    
    return session;
  }

  /**
   * 停止充电会话
   */
  public async stopChargingSession(request: StopChargingRequest) {
    const { sessionId, userId, reason = 'user_request' } = request;

    // 获取会话信息
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('充电会话不存在');
    }

    if (session.userId !== userId) {
      throw new Error('无权限操作此充电会话');
    }

    if (session.status === 'completed' || session.status === 'faulted') {
      throw new Error('充电会话已结束');
    }

    // 停止充电桩
    await this.stopPileCharging(session.pileId, sessionId);

    // 更新会话状态
    const endTime = new Date().toISOString();
    const updatedSession: ChargingSession = {
      ...session,
      status: 'completed',
      endTime,
      updatedAt: endTime
    };

    // 保存更新后的会话
    await this.saveSession(updatedSession);

    // 释放充电桩
    await this.setPileStatus(session.pileId, 'available');

    // 停止监控
    this.stopChargingMonitor(sessionId);

    // 广播状态更新
    if (this.webSocketService) {
      this.webSocketService.broadcastChargingStatusUpdate({
        sessionId,
        pileId: session.pileId,
        status: 'completed',
        currentPower: 0,
        energyDelivered: session.energyDelivered,
        duration: session.duration,
        cost: session.cost,
        voltage: 0,
        current: 0,
        temperature: session.temperature,
        timestamp: endTime
      });
    }

    console.log(`⏹️ 充电会话停止成功: ${sessionId}`);

    return {
      sessionId,
      endTime,
      duration: session.duration,
      energyDelivered: session.energyDelivered,
      totalCost: session.cost
    };
  }

  /**
   * 暂停充电会话
   */
  public async pauseChargingSession(request: { sessionId: string; userId: string }) {
    const { sessionId, userId } = request;

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('充电会话不存在');
    }

    if (session.userId !== userId) {
      throw new Error('无权限操作此充电会话');
    }

    if (session.status !== 'charging') {
      throw new Error('只能暂停正在充电的会话');
    }

    // 暂停充电桩
    await this.pausePileCharging(session.pileId, sessionId);

    // 更新会话状态
    const updatedSession: ChargingSession = {
      ...session,
      status: 'suspended',
      updatedAt: new Date().toISOString()
    };

    await this.saveSession(updatedSession);

    // 广播状态更新
    if (this.webSocketService) {
      this.webSocketService.broadcastChargingStatusUpdate({
        sessionId,
        pileId: session.pileId,
        status: 'suspended',
        currentPower: 0,
        energyDelivered: session.energyDelivered,
        duration: session.duration,
        cost: session.cost,
        voltage: session.voltage,
        current: 0,
        temperature: session.temperature,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`⏸️ 充电会话暂停成功: ${sessionId}`);
  }

  /**
   * 恢复充电会话
   */
  public async resumeChargingSession(request: { sessionId: string; userId: string }) {
    const { sessionId, userId } = request;

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('充电会话不存在');
    }

    if (session.userId !== userId) {
      throw new Error('无权限操作此充电会话');
    }

    if (session.status !== 'suspended') {
      throw new Error('只能恢复已暂停的会话');
    }

    // 恢复充电桩
    await this.resumePileCharging(session.pileId, sessionId);

    // 更新会话状态
    const updatedSession: ChargingSession = {
      ...session,
      status: 'charging',
      updatedAt: new Date().toISOString()
    };

    await this.saveSession(updatedSession);

    console.log(`▶️ 充电会话恢复成功: ${sessionId}`);
  }

  /**
   * 获取充电状态
   */
  public async getChargingStatus(sessionId: string, userId: string): Promise<ChargingSession | null> {
    const session = await this.getSession(sessionId);
    
    if (!session || session.userId !== userId) {
      return null;
    }

    return session;
  }

  /**
   * 获取充电历史
   */
  public async getChargingHistory(params: {
    userId: string;
    page: number;
    limit: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ChargingHistory> {
    const { userId, page, limit, status, startDate, endDate } = params;

    // 这里应该从数据库查询，现在用Redis模拟
    const sessionKeys = await this.redis.keys(`session:${userId}:*`);
    let sessions: ChargingSession[] = [];

    for (const key of sessionKeys) {
      const sessionData = await this.redis.get(key);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        
        // 状态筛选
        if (status && status !== 'all' && session.status !== status) {
          continue;
        }

        // 日期筛选
        if (startDate && session.startTime < startDate) {
          continue;
        }
        if (endDate && session.startTime > endDate) {
          continue;
        }

        sessions.push(session);
      }
    }

    // 按时间倒序排序
    sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    // 分页
    const total = sessions.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedSessions = sessions.slice(startIndex, startIndex + limit);

    return {
      sessions: paginatedSessions,
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * 获取充电统计
   */
  public async getChargingStats(params: {
    userId: string;
    period: string;
  }): Promise<ChargingStats> {
    const { userId, period } = params;

    // 获取用户所有充电记录
    const history = await this.getChargingHistory({
      userId,
      page: 1,
      limit: 1000 // 获取所有记录
    });

    const sessions = history.sessions;
    const completedSessions = sessions.filter(s => s.status === 'completed');

    // 计算统计数据
    const totalSessions = sessions.length;
    const totalEnergy = completedSessions.reduce((sum, s) => sum + s.energyDelivered, 0);
    const totalCost = completedSessions.reduce((sum, s) => sum + s.cost, 0);
    const totalDuration = completedSessions.reduce((sum, s) => sum + s.duration, 0);

    const averageEnergy = completedSessions.length > 0 ? totalEnergy / completedSessions.length : 0;
    const averageCost = completedSessions.length > 0 ? totalCost / completedSessions.length : 0;
    const averageDuration = completedSessions.length > 0 ? totalDuration / completedSessions.length : 0;
    const successRate = totalSessions > 0 ? (completedSessions.length / totalSessions) * 100 : 0;

    // 按月统计（简化实现）
    const monthlyData = this.calculateMonthlyStats(completedSessions, period);

    return {
      totalSessions,
      totalEnergy,
      totalCost,
      totalDuration,
      averageEnergy,
      averageCost,
      averageDuration,
      successRate,
      monthlyData
    };
  }

  /**
   * 获取实时监控数据
   */
  public async getRealtimeMonitorData(sessionId: string, userId: string) {
    const session = await this.getSession(sessionId);
    
    if (!session || session.userId !== userId) {
      return null;
    }

    // 获取实时数据（从充电桩或缓存）
    const realtimeData = await this.redis.get(`realtime:${sessionId}`);
    
    return {
      ...session,
      realtime: realtimeData ? JSON.parse(realtimeData) : null,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * 开始充电监控
   */
  private startChargingMonitor(sessionId: string) {
    // 如果已有监控，先停止
    this.stopChargingMonitor(sessionId);

    // 每5秒更新一次充电状态
    const interval = setInterval(async () => {
      try {
        await this.updateChargingStatus(sessionId);
      } catch (error) {
        console.error(`❌ 更新充电状态失败 ${sessionId}:`, error);
      }
    }, 5000);

    this.monitoringIntervals.set(sessionId, interval);
    console.log(`📊 开始监控充电会话: ${sessionId}`);
  }

  /**
   * 停止充电监控
   */
  private stopChargingMonitor(sessionId: string) {
    const interval = this.monitoringIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(sessionId);
      console.log(`📊 停止监控充电会话: ${sessionId}`);
    }
  }

  /**
   * 更新充电状态（模拟）
   */
  private async updateChargingStatus(sessionId: string) {
    const session = await this.getSession(sessionId);
    if (!session || session.status !== 'charging') {
      return;
    }

    // 模拟充电数据更新
    const now = new Date();
    const startTime = new Date(session.startTime);
    const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    // 模拟功率变化
    const basePower = session.maxPower * 0.8; // 80%额定功率
    const powerVariation = (Math.random() - 0.5) * session.maxPower * 0.2; // ±10%变化
    const currentPower = Math.max(0, basePower + powerVariation);

    // 计算累计电量（简化计算）
    const energyIncrement = (currentPower * 5) / 3600; // 5秒的电量增量
    const energyDelivered = session.energyDelivered + energyIncrement;

    // 计算费用
    const cost = energyDelivered * session.pricePerKwh;

    // 模拟电气参数
    const voltage = 380 + (Math.random() - 0.5) * 40;
    const current = currentPower > 0 ? (currentPower * 1000) / voltage : 0;
    const temperature = 25 + Math.random() * 20;

    // 更新会话数据
    const updatedSession: ChargingSession = {
      ...session,
      duration,
      currentPower,
      energyDelivered,
      cost,
      voltage,
      current,
      temperature,
      updatedAt: now.toISOString()
    };

    // 检查是否达到停止条件
    if (session.targetSoc && session.vehicleInfo) {
      const currentSoc = this.calculateCurrentSoc(session.vehicleInfo, energyDelivered);
      if (currentSoc >= session.targetSoc) {
        updatedSession.status = 'finishing';
        // 自动停止充电
        setTimeout(() => {
          this.stopChargingSession({
            sessionId,
            userId: session.userId,
            reason: 'target_reached'
          });
        }, 3000);
      }
    }

    if (session.maxEnergy && energyDelivered >= session.maxEnergy) {
      updatedSession.status = 'finishing';
    }

    if (session.maxCost && cost >= session.maxCost) {
      updatedSession.status = 'finishing';
    }

    // 保存更新后的会话
    await this.saveSession(updatedSession);

    // 广播状态更新
    if (this.webSocketService) {
      this.webSocketService.broadcastChargingStatusUpdate({
        sessionId,
        pileId: session.pileId,
        status: updatedSession.status,
        currentPower,
        energyDelivered,
        duration,
        cost,
        voltage,
        current,
        temperature,
        timestamp: now.toISOString()
      });
    }
  }

  // 辅助方法
  private async saveSession(session: ChargingSession) {
    await this.redis.setex(
      `session:${session.sessionId}`,
      86400, // 24小时过期
      JSON.stringify(session)
    );
    
    // 同时保存用户会话索引
    await this.redis.setex(
      `session:${session.userId}:${session.sessionId}`,
      86400,
      JSON.stringify(session)
    );
  }

  private async getSession(sessionId: string): Promise<ChargingSession | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  private async getActiveSessionByUser(userId: string): Promise<ChargingSession | null> {
    const keys = await this.redis.keys(`session:${userId}:*`);
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const session = JSON.parse(data);
        if (['preparing', 'charging', 'suspended'].includes(session.status)) {
          return session;
        }
      }
    }
    
    return null;
  }

  private async getPileStatus(pileId: string): Promise<string> {
    const status = await this.redis.get(`pile:${pileId}:status`);
    return status || 'available';
  }

  private async setPileStatus(pileId: string, status: string) {
    await this.redis.setex(`pile:${pileId}:status`, 3600, status);
  }

  private async getPileInfo(pileId: string) {
    // 模拟充电桩信息
    return {
      id: pileId,
      name: `充电桩-${pileId.slice(-3)}`,
      stationId: 'station_001',
      stationName: '万达广场充电站',
      maxPower: 60,
      pricePerKwh: 1.5
    };
  }

  private async startPileCharging(pileId: string, sessionId: string) {
    // 模拟启动充电桩
    console.log(`🔌 启动充电桩 ${pileId} (会话: ${sessionId})`);
    
    // 延迟3秒后状态变为charging
    setTimeout(async () => {
      const session = await this.getSession(sessionId);
      if (session && session.status === 'preparing') {
        const updatedSession = {
          ...session,
          status: 'charging' as const,
          updatedAt: new Date().toISOString()
        };
        await this.saveSession(updatedSession);
        
        if (this.webSocketService) {
          this.webSocketService.broadcastChargingStatusUpdate({
            sessionId,
            pileId,
            status: 'charging',
            currentPower: 0,
            energyDelivered: 0,
            duration: 0,
            cost: 0,
            voltage: 0,
            current: 0,
            temperature: 25,
            timestamp: new Date().toISOString()
          });
        }
      }
    }, 3000);
  }

  private async stopPileCharging(pileId: string, sessionId: string) {
    console.log(`⏹️ 停止充电桩 ${pileId} (会话: ${sessionId})`);
  }

  private async pausePileCharging(pileId: string, sessionId: string) {
    console.log(`⏸️ 暂停充电桩 ${pileId} (会话: ${sessionId})`);
  }

  private async resumePileCharging(pileId: string, sessionId: string) {
    console.log(`▶️ 恢复充电桩 ${pileId} (会话: ${sessionId})`);
  }

  private calculateCurrentSoc(vehicleInfo: any, energyDelivered: number): number {
    // 简化的SOC计算
    const energyPercentage = (energyDelivered / vehicleInfo.batteryCapacity) * 100;
    return Math.min(vehicleInfo.currentSoc + energyPercentage, 100);
  }

  private calculateMonthlyStats(sessions: ChargingSession[], period: string) {
    // 简化的月度统计实现
    const monthlyMap = new Map();
    
    sessions.forEach(session => {
      const date = new Date(session.startTime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthKey,
          sessions: 0,
          energy: 0,
          cost: 0
        });
      }
      
      const monthData = monthlyMap.get(monthKey);
      monthData.sessions++;
      monthData.energy += session.energyDelivered;
      monthData.cost += session.cost;
    });
    
    return Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }
}