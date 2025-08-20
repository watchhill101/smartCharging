import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { RedisService } from './RedisService';

export interface ChargingStatusUpdate {
  sessionId: string;
  pileId: string;
  status: 'preparing' | 'charging' | 'suspended' | 'finishing' | 'completed' | 'faulted';
  currentPower: number;
  energyDelivered: number;
  duration: number;
  cost: number;
  voltage: number;
  current: number;
  temperature: number;
  timestamp: string;
}

export interface NotificationMessage {
  type: 'charging_status' | 'payment_result' | 'system_notice' | 'error';
  title: string;
  content: string;
  data?: any;
  timestamp: string;
  userId?: string;
  sessionId?: string;
}

export interface ClientConnection {
  userId: string;
  sessionId?: string;
  deviceId?: string;
  platform?: string;
  connectedAt: Date;
}

export class WebSocketService {
  private io: SocketIOServer;
  private redis: RedisService;
  private connections: Map<string, ClientConnection> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds
  private sessionSockets: Map<string, Set<string>> = new Map(); // sessionId -> socketIds

  constructor(server: HttpServer, redis: RedisService) {
    this.redis = redis;
    
    // 初始化Socket.IO服务器
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [process.env.FRONTEND_URL || 'http://localhost:3000'],
        methods: (process.env.CORS_METHODS || 'GET,POST').split(','),
        credentials: process.env.CORS_CREDENTIALS === 'true'
      },
      transports: ['websocket', 'polling'],
      pingTimeout: parseInt(process.env.WEBSOCKET_PING_TIMEOUT || '60000'),
      pingInterval: parseInt(process.env.WEBSOCKET_PING_INTERVAL || '25000')
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startHeartbeat();
  }

  /**
   * 设置中间件
   */
  private setupMiddleware() {
    // JWT认证中间件
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                     socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // 验证JWT token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          return next(new Error('JWT secret not configured'));
        }
        const decoded = jwt.verify(token, jwtSecret) as any;
        
        // 将用户信息附加到socket
        socket.data.userId = decoded.userId;
        socket.data.userInfo = decoded;
        
        console.log(`✅ WebSocket认证成功: 用户 ${decoded.userId}`);
        next();
        
      } catch (error) {
        console.error('❌ WebSocket认证失败:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.data.userId;
      const socketId = socket.id;
      
      console.log(`📡 WebSocket连接建立: ${socketId} (用户: ${userId})`);

      // 注册连接
      this.registerConnection(socketId, {
        userId,
        deviceId: socket.handshake.headers['x-device-id'] as string,
        platform: socket.handshake.headers['x-platform'] as string,
        connectedAt: new Date()
      });

      // 订阅充电会话状态
      socket.on('subscribe_charging_session', (data: { sessionId: string }) => {
        this.subscribeChargingSession(socketId, data.sessionId);
      });

      // 取消订阅充电会话状态
      socket.on('unsubscribe_charging_session', (data: { sessionId: string }) => {
        this.unsubscribeChargingSession(socketId, data.sessionId);
      });

      // 订阅用户通知
      socket.on('subscribe_notifications', () => {
        this.subscribeUserNotifications(socketId, userId);
      });

      // 心跳响应
      socket.on('pong', () => {
        socket.data.lastPong = Date.now();
      });

      // 客户端主动发送的消息
      socket.on('client_message', (data) => {
        this.handleClientMessage(socketId, data);
      });

      // 连接断开
      socket.on('disconnect', (reason) => {
        console.log(`📡 WebSocket连接断开: ${socketId} (原因: ${reason})`);
        this.unregisterConnection(socketId);
      });

      // 发送连接成功消息
      socket.emit('connected', {
        message: 'WebSocket连接成功',
        timestamp: new Date().toISOString(),
        userId
      });
    });
  }

  /**
   * 注册连接
   */
  private registerConnection(socketId: string, connection: ClientConnection) {
    this.connections.set(socketId, connection);
    
    // 添加到用户socket映射
    if (!this.userSockets.has(connection.userId)) {
      this.userSockets.set(connection.userId, new Set());
    }
    this.userSockets.get(connection.userId)!.add(socketId);

    // 缓存到Redis
    this.redis.setex(
      `ws:connection:${socketId}`,
      3600, // 1小时过期
      JSON.stringify(connection)
    );

    console.log(`📝 注册WebSocket连接: ${socketId} -> 用户 ${connection.userId}`);
  }

  /**
   * 注销连接
   */
  private unregisterConnection(socketId: string) {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    // 从用户socket映射中移除
    const userSocketSet = this.userSockets.get(connection.userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(connection.userId);
      }
    }

    // 从会话socket映射中移除
    if (connection.sessionId) {
      const sessionSocketSet = this.sessionSockets.get(connection.sessionId);
      if (sessionSocketSet) {
        sessionSocketSet.delete(socketId);
        if (sessionSocketSet.size === 0) {
          this.sessionSockets.delete(connection.sessionId);
        }
      }
    }

    // 从内存中移除
    this.connections.delete(socketId);

    // 从Redis中移除
    this.redis.del(`ws:connection:${socketId}`);

    console.log(`🗑️ 注销WebSocket连接: ${socketId}`);
  }

  /**
   * 订阅充电会话状态
   */
  private subscribeChargingSession(socketId: string, sessionId: string) {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    // 更新连接信息
    connection.sessionId = sessionId;
    this.connections.set(socketId, connection);

    // 添加到会话socket映射
    if (!this.sessionSockets.has(sessionId)) {
      this.sessionSockets.set(sessionId, new Set());
    }
    this.sessionSockets.get(sessionId)!.add(socketId);

    // 加入Socket.IO房间
    this.io.sockets.sockets.get(socketId)?.join(`session:${sessionId}`);

    console.log(`📡 订阅充电会话: ${socketId} -> 会话 ${sessionId}`);

    // 发送订阅成功消息
    this.io.to(socketId).emit('subscription_success', {
      type: 'charging_session',
      sessionId,
      message: '已订阅充电会话状态更新'
    });
  }

  /**
   * 取消订阅充电会话状态
   */
  private unsubscribeChargingSession(socketId: string, sessionId: string) {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    // 从会话socket映射中移除
    const sessionSocketSet = this.sessionSockets.get(sessionId);
    if (sessionSocketSet) {
      sessionSocketSet.delete(socketId);
      if (sessionSocketSet.size === 0) {
        this.sessionSockets.delete(sessionId);
      }
    }

    // 离开Socket.IO房间
    this.io.sockets.sockets.get(socketId)?.leave(`session:${sessionId}`);

    // 更新连接信息
    if (connection.sessionId === sessionId) {
      connection.sessionId = undefined;
      this.connections.set(socketId, connection);
    }

    console.log(`📡 取消订阅充电会话: ${socketId} -> 会话 ${sessionId}`);
  }

  /**
   * 订阅用户通知
   */
  private subscribeUserNotifications(socketId: string, userId: string) {
    // 加入用户通知房间
    this.io.sockets.sockets.get(socketId)?.join(`user:${userId}`);

    console.log(`🔔 订阅用户通知: ${socketId} -> 用户 ${userId}`);

    // 发送订阅成功消息
    this.io.to(socketId).emit('subscription_success', {
      type: 'user_notifications',
      userId,
      message: '已订阅用户通知'
    });
  }

  /**
   * 处理客户端消息
   */
  private handleClientMessage(socketId: string, data: any) {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    console.log(`📨 收到客户端消息: ${socketId}`, data);

    // 根据消息类型处理
    switch (data.type) {
      case 'heartbeat':
        this.io.to(socketId).emit('heartbeat_response', {
          timestamp: new Date().toISOString()
        });
        break;

      case 'get_charging_status':
        this.handleGetChargingStatus(socketId, data.sessionId);
        break;

      default:
        console.log(`⚠️ 未知消息类型: ${data.type}`);
    }
  }

  /**
   * 处理获取充电状态请求
   */
  private async handleGetChargingStatus(socketId: string, sessionId: string) {
    try {
      // 从Redis获取最新的充电状态
      const statusData = await this.redis.get(`charging:status:${sessionId}`);
      
      if (statusData) {
        const status = JSON.parse(statusData);
        this.io.to(socketId).emit('charging_status_update', {
          type: 'charging_status_update',
          status,
          timestamp: new Date().toISOString()
        });
      } else {
        this.io.to(socketId).emit('error', {
          type: 'charging_status_not_found',
          message: '未找到充电状态数据',
          sessionId
        });
      }
    } catch (error) {
      console.error('❌ 获取充电状态失败:', error);
      this.io.to(socketId).emit('error', {
        type: 'get_charging_status_error',
        message: '获取充电状态失败',
        sessionId
      });
    }
  }

  /**
   * 广播充电状态更新
   */
  public broadcastChargingStatusUpdate(update: ChargingStatusUpdate) {
    const { sessionId } = update;
    
    // 发送到订阅该会话的所有客户端
    this.io.to(`session:${sessionId}`).emit('charging_status_update', {
      type: 'charging_status_update',
      status: update,
      timestamp: new Date().toISOString()
    });

    // 缓存到Redis
    this.redis.setex(
      `charging:status:${sessionId}`,
      3600, // 1小时过期
      JSON.stringify(update)
    );

    console.log(`📡 广播充电状态更新: 会话 ${sessionId}`);
  }

  /**
   * 发送通知给特定用户
   */
  public sendNotificationToUser(userId: string, notification: NotificationMessage) {
    // 发送到用户的所有连接
    this.io.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });

    // 缓存通知到Redis
    this.redis.lpush(
      `notifications:${userId}`,
      JSON.stringify(notification)
    );
    
    // 保持最近100条通知
    this.redis.ltrim(`notifications:${userId}`, 0, 99);

    console.log(`🔔 发送通知给用户 ${userId}: ${notification.title}`);
  }

  /**
   * 发送通知给充电会话相关用户
   */
  public sendNotificationToSession(sessionId: string, notification: NotificationMessage) {
    // 发送到订阅该会话的所有客户端
    this.io.to(`session:${sessionId}`).emit('notification', {
      ...notification,
      sessionId,
      timestamp: new Date().toISOString()
    });

    console.log(`🔔 发送会话通知: 会话 ${sessionId} - ${notification.title}`);
  }

  /**
   * 广播系统通知
   */
  public broadcastSystemNotification(notification: NotificationMessage) {
    this.io.emit('system_notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });

    console.log(`📢 广播系统通知: ${notification.title}`);
  }

  /**
   * 获取在线用户数量
   */
  public getOnlineUserCount(): number {
    return this.userSockets.size;
  }

  /**
   * 获取活跃会话数量
   */
  public getActiveSessionCount(): number {
    return this.sessionSockets.size;
  }

  /**
   * 获取连接统计信息
   */
  public getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      onlineUsers: this.userSockets.size,
      activeSessions: this.sessionSockets.size,
      connections: Array.from(this.connections.entries()).map(([socketId, conn]) => ({
        socketId,
        userId: conn.userId,
        sessionId: conn.sessionId,
        connectedAt: conn.connectedAt,
        platform: conn.platform
      }))
    };
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      
      // 向所有连接发送ping
      this.io.emit('ping', { timestamp: now });
      
      // 检查超时连接
      this.connections.forEach((connection, socketId) => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket) {
          this.unregisterConnection(socketId);
          return;
        }

        const lastPong = socket.data.lastPong || now;
        if (now - lastPong > 90000) { // 90秒超时
          console.log(`⏰ WebSocket连接超时，断开: ${socketId}`);
          socket.disconnect(true);
        }
      });
    }, parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL || '30000')); // 心跳间隔
  }

  /**
   * 关闭WebSocket服务
   */
  public close() {
    console.log('🔌 关闭WebSocket服务...');
    this.io.close();
    this.connections.clear();
    this.userSockets.clear();
    this.sessionSockets.clear();
  }
}