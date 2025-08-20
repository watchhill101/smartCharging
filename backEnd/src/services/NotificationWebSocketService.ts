import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { RedisService } from './RedisService';

export interface ConnectedUser {
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
}

export interface NotificationMessage {
  id: string;
  userId: string;
  type: string;
  subType: string;
  title: string;
  content: string;
  data?: any;
  priority: string;
  timestamp: Date;
}

export class NotificationWebSocketService {
  private io: SocketIOServer;
  private redisService: RedisService;
  private connectedUsers: Map<string, ConnectedUser> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(server: HTTPServer, redisService: RedisService) {
    this.redisService = redisService;
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupSocketHandlers();
    this.startHeartbeat();
  }

  private setupSocketHandlers(): void {
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', (socket: Socket) => {
      console.log(`Socket connected: ${socket.id}`);
      
      const userId = (socket as any).userId;
      if (userId) {
        this.handleUserConnection(userId, socket.id);
      }

      // 处理用户主动请求通知
      socket.on('request_notifications', async (data) => {
        await this.handleNotificationRequest(socket, data);
      });

      // 处理通知已读状态
      socket.on('mark_notification_read', async (data) => {
        await this.handleMarkNotificationRead(socket, data);
      });

      // 处理心跳
      socket.on('heartbeat', () => {
        this.handleHeartbeat(socket.id);
      });

      // 处理断开连接
      socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
        this.handleUserDisconnection(socket.id);
      });

      // 发送连接成功消息
      socket.emit('connected', {
        message: '通知服务连接成功',
        timestamp: new Date()
      });
    });
  }

  private async authenticateSocket(socket: Socket, next: (err?: Error) => void): Promise<void> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }
    const decoded = jwt.verify(token, jwtSecret) as any;
      (socket as any).userId = decoded.id;
      
      next();
    } catch (error) {
      console.error('Socket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  }

  private handleUserConnection(userId: string, socketId: string): void {
    const connectedUser: ConnectedUser = {
      userId,
      socketId,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    this.connectedUsers.set(socketId, connectedUser);

    // 维护用户到socket的映射
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);

    // 缓存用户在线状态
    this.redisService.setex(`user:${userId}:online`, 300, socketId); // 5分钟过期

    console.log(`User ${userId} connected with socket ${socketId}`);
  }

  private handleUserDisconnection(socketId: string): void {
    const connectedUser = this.connectedUsers.get(socketId);
    if (connectedUser) {
      const { userId } = connectedUser;
      
      // 移除socket映射
      this.connectedUsers.delete(socketId);
      
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socketId);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
          // 清除在线状态缓存
          this.redisService.del(`user:${userId}:online`);
        }
      }

      console.log(`User ${userId} disconnected from socket ${socketId}`);
    }
  }

  private async handleNotificationRequest(socket: Socket, data: any): Promise<void> {
    try {
      const userId = (socket as any).userId;
      const { page = 1, limit = 20, type, isRead } = data;

      // 从Redis获取用户通知
      const notifications = await this.getUserNotifications(userId, { page, limit, type, isRead });
      
      socket.emit('notifications_response', {
        success: true,
        data: notifications
      });
    } catch (error) {
      console.error('Handle notification request failed:', error);
      socket.emit('notifications_response', {
        success: false,
        message: '获取通知失败'
      });
    }
  }

  private async handleMarkNotificationRead(socket: Socket, data: any): Promise<void> {
    try {
      const userId = (socket as any).userId;
      const { notificationId } = data;

      // 标记通知为已读
      await this.markNotificationAsRead(userId, notificationId);
      
      socket.emit('notification_read_response', {
        success: true,
        notificationId
      });
    } catch (error) {
      console.error('Mark notification read failed:', error);
      socket.emit('notification_read_response', {
        success: false,
        message: '标记已读失败'
      });
    }
  }

  private handleHeartbeat(socketId: string): void {
    const connectedUser = this.connectedUsers.get(socketId);
    if (connectedUser) {
      connectedUser.lastActivity = new Date();
    }
  }

  /**
   * 发送通知给指定用户
   */
  async sendNotificationToUser(userId: string, notification: NotificationMessage): Promise<boolean> {
    try {
      const userSocketSet = this.userSockets.get(userId);
      
      if (!userSocketSet || userSocketSet.size === 0) {
        console.log(`User ${userId} is not connected, storing notification for later delivery`);
        // 用户不在线，存储通知到Redis
        await this.storeNotificationForOfflineUser(userId, notification);
        return false;
      }

      // 发送给用户的所有连接
      let sent = false;
      for (const socketId of userSocketSet) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('new_notification', notification);
          sent = true;
        }
      }

      if (sent) {
        console.log(`Notification sent to user ${userId}`);
        // 同时存储到Redis作为历史记录
        await this.storeNotificationForOfflineUser(userId, notification);
      }

      return sent;
    } catch (error) {
      console.error('Send notification to user failed:', error);
      return false;
    }
  }

  /**
   * 广播系统通知
   */
  async broadcastSystemNotification(notification: NotificationMessage): Promise<void> {
    try {
      this.io.emit('system_notification', notification);
      console.log('System notification broadcasted to all connected users');
    } catch (error) {
      console.error('Broadcast system notification failed:', error);
    }
  }

  /**
   * 发送通知给多个用户
   */
  async sendNotificationToUsers(userIds: string[], notification: NotificationMessage): Promise<void> {
    const promises = userIds.map(userId => 
      this.sendNotificationToUser(userId, { ...notification, userId })
    );
    
    await Promise.all(promises);
  }

  /**
   * 获取在线用户数量
   */
  getOnlineUserCount(): number {
    return this.userSockets.size;
  }

  /**
   * 获取用户是否在线
   */
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * 获取所有在线用户
   */
  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  /**
   * 存储离线用户通知
   */
  private async storeNotificationForOfflineUser(userId: string, notification: NotificationMessage): Promise<void> {
    try {
      const notificationKey = `user:${userId}:notifications`;
      await this.redisService.lpush(notificationKey, JSON.stringify(notification));
      
      // 限制通知数量，只保留最新的100条
      await this.redisService.ltrim(notificationKey, 0, 99);
      
      // 设置过期时间30天
      await this.redisService.expire(notificationKey, 30 * 24 * 60 * 60);
    } catch (error) {
      console.error('Store notification for offline user failed:', error);
    }
  }

  /**
   * 获取用户通知
   */
  private async getUserNotifications(userId: string, options: {
    page: number;
    limit: number;
    type?: string;
    isRead?: boolean;
  }): Promise<any> {
    try {
      const { page, limit } = options;
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      const notificationKey = `user:${userId}:notifications`;
      const notifications = await this.redisService.lrange(notificationKey, start, end);
      
      const parsedNotifications = notifications.map(notification => {
        try {
          return JSON.parse(notification);
        } catch (error) {
          console.error('Parse notification failed:', error);
          return null;
        }
      }).filter(Boolean);

      // 获取总数
      const total = await this.redisService.llen(notificationKey);

      return {
        notifications: parsedNotifications,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Get user notifications failed:', error);
      throw error;
    }
  }

  /**
   * 标记通知为已读
   */
  private async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      // 这里可以实现更复杂的已读状态管理
      // 目前简单记录到Redis
      const readKey = `user:${userId}:read_notifications`;
      await this.redisService.sadd(readKey, notificationId);
      await this.redisService.expire(readKey, 30 * 24 * 60 * 60); // 30天过期
    } catch (error) {
      console.error('Mark notification as read failed:', error);
      throw error;
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    setInterval(() => {
      const now = new Date();
      const timeout = 5 * 60 * 1000; // 5分钟超时

      for (const [socketId, connectedUser] of this.connectedUsers.entries()) {
        if (now.getTime() - connectedUser.lastActivity.getTime() > timeout) {
          console.log(`Socket ${socketId} timeout, disconnecting...`);
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.disconnect(true);
          }
          this.handleUserDisconnection(socketId);
        }
      }
    }, 60 * 1000); // 每分钟检查一次
  }

  /**
   * 关闭WebSocket服务
   */
  close(): void {
    this.io.close();
    console.log('WebSocket service closed');
  }
}