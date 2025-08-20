/**
 * WebSocket实时数据推送服务
 * 用于接收充电状态、通知等实时数据
 */

import Taro from '@tarojs/taro';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  timeout?: number;
}

export interface WebSocketEventHandlers {
  onOpen?: () => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: any) => void;
  onClose?: (code: number, reason: string) => void;
  onReconnect?: (attempt: number) => void;
}

export class WebSocketService {
  private socketTask: Taro.SocketTask | null = null;
  private config: WebSocketConfig;
  private handlers: WebSocketEventHandlers;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: string[] = [];
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map();

  constructor(config: WebSocketConfig, handlers: WebSocketEventHandlers = {}) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      timeout: 10000,
      ...config
    };
    this.handlers = handlers;
  }

  /**
   * 连接WebSocket
   */
  async connect(): Promise<void> {
    try {
      // 连接WebSocket

      this.socketTask = Taro.connectSocket({
        url: this.config.url,
        protocols: this.config.protocols,
        timeout: this.config.timeout
      });

      this.setupEventHandlers();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket连接超时'));
        }, this.config.timeout);

        this.socketTask!.onOpen(() => {
          clearTimeout(timeout);
          resolve();
        });

        this.socketTask!.onError((error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      console.error('❌ WebSocket连接失败:', error);
      throw error;
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.socketTask) return;

    // 连接打开
    this.socketTask.onOpen(() => {
      // WebSocket连接已建立
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // 发送队列中的消息
      this.flushMessageQueue();
      
      // 启动心跳
      this.startHeartbeat();
      
      this.handlers.onOpen?.();
    });

    // 接收消息
    this.socketTask.onMessage((event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data as string);
        // 收到WebSocket消息
        
        // 处理心跳响应
        if (message.type === 'pong') {
          return;
        }
        
        // 分发消息给订阅者
        this.dispatchMessage(message);
        
        this.handlers.onMessage?.(message);
        
      } catch (error) {
        console.error('❌ 解析WebSocket消息失败:', error);
      }
    });

    // 连接错误
    this.socketTask.onError((error) => {
      console.error('❌ WebSocket连接错误:', error);
      this.isConnected = false;
      this.handlers.onError?.(error);
    });

    // 连接关闭
    this.socketTask.onClose((event) => {
      // WebSocket连接已关闭
      this.isConnected = false;
      this.stopHeartbeat();
      
      this.handlers.onClose?.(event.code, event.reason);
      
      // 自动重连
      if (this.reconnectAttempts < this.config.maxReconnectAttempts!) {
        this.scheduleReconnect();
      }
    });
  }

  /**
   * 发送消息
   */
  send(message: any): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    
    if (this.isConnected && this.socketTask) {
      try {
        this.socketTask.send({
          data: messageStr
        });
        // 发送WebSocket消息
      } catch (error) {
        console.error('❌ 发送WebSocket消息失败:', error);
        // 添加到队列等待重连后发送
        this.messageQueue.push(messageStr);
      }
    } else {
      // 连接未建立，添加到队列
      this.messageQueue.push(messageStr);
      // 消息已加入队列，等待连接建立
    }
  }

  /**
   * 订阅特定类型的消息
   */
  subscribe(messageType: string, handler: (data: any) => void): () => void {
    if (!this.subscriptions.has(messageType)) {
      this.subscriptions.set(messageType, new Set());
    }
    
    this.subscriptions.get(messageType)!.add(handler);
    
    // 订阅消息类型
    
    // 返回取消订阅函数
    return () => {
      this.unsubscribe(messageType, handler);
    };
  }

  /**
   * 取消订阅
   */
  unsubscribe(messageType: string, handler: (data: any) => void): void {
    const handlers = this.subscriptions.get(messageType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(messageType);
      }
    }
    
    // 取消订阅消息类型
  }

  /**
   * 分发消息给订阅者
   */
  private dispatchMessage(message: WebSocketMessage): void {
    const handlers = this.subscriptions.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message.data);
        } catch (error) {
          console.error(`❌ 消息处理器执行失败 (${message.type}):`, error);
        }
      });
    }
  }

  /**
   * 刷新消息队列
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message && this.socketTask) {
        try {
          this.socketTask.send({ data: message });
          // 发送队列消息
        } catch (error) {
          console.error('❌ 发送队列消息失败:', error);
          // 重新加入队列
          this.messageQueue.unshift(message);
          break;
        }
      }
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    if (this.config.heartbeatInterval && this.config.heartbeatInterval > 0) {
      this.heartbeatTimer = setInterval(() => {
        if (this.isConnected) {
          this.send({
            type: 'ping',
            timestamp: new Date().toISOString()
          });
        }
      }, this.config.heartbeatInterval);
    }
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval! * Math.pow(1.5, this.reconnectAttempts - 1);
    
    // 准备重连
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        this.handlers.onReconnect?.(this.reconnectAttempts);
        await this.connect();
      } catch (error) {
        console.error(`❌ 第${this.reconnectAttempts}次重连失败:`, error);
      }
    }, delay);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    // 主动断开WebSocket连接
    
    // 清理定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    // 关闭连接
    if (this.socketTask) {
      this.socketTask.close({
        code: 1000,
        reason: '主动断开'
      });
      this.socketTask = null;
    }
    
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.subscriptions.clear();
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): {
    isConnected: boolean;
    reconnectAttempts: number;
    queuedMessages: number;
    subscriptions: number;
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      subscriptions: this.subscriptions.size
    };
  }

  /**
   * 订阅充电状态更新
   */
  subscribeChargingStatus(sessionId: string, handler: (data: any) => void): () => void {
    // 发送订阅请求
    this.send({
      type: 'subscribe',
      data: {
        event: 'charging_status',
        sessionId
      }
    });

    return this.subscribe('charging_status_update', (data) => {
      if (data.sessionId === sessionId) {
        handler(data);
      }
    });
  }

  /**
   * 订阅充电桩状态更新
   */
  subscribePileStatus(pileId: string, handler: (data: any) => void): () => void {
    this.send({
      type: 'subscribe',
      data: {
        event: 'pile_status',
        pileId
      }
    });

    return this.subscribe('pile_status_update', (data) => {
      if (data.pileId === pileId) {
        handler(data);
      }
    });
  }

  /**
   * 订阅通知消息
   */
  subscribeNotifications(userId: string, handler: (data: any) => void): () => void {
    this.send({
      type: 'subscribe',
      data: {
        event: 'notifications',
        userId
      }
    });

    return this.subscribe('notification', handler);
  }

  /**
   * 取消订阅充电状态
   */
  unsubscribeChargingStatus(sessionId: string): void {
    this.send({
      type: 'unsubscribe',
      data: {
        event: 'charging_status',
        sessionId
      }
    });
  }

  /**
   * 取消订阅充电桩状态
   */
  unsubscribePileStatus(pileId: string): void {
    this.send({
      type: 'unsubscribe',
      data: {
        event: 'pile_status',
        pileId
      }
    });
  }
}

// 创建全局WebSocket服务实例
let globalWebSocketService: WebSocketService | null = null;

/**
 * 获取全局WebSocket服务实例
 */
export function getWebSocketService(): WebSocketService | null {
  return globalWebSocketService;
}

/**
 * 初始化全局WebSocket服务
 */
export function initWebSocketService(config: WebSocketConfig, handlers?: WebSocketEventHandlers): WebSocketService {
  if (globalWebSocketService) {
    globalWebSocketService.disconnect();
  }

  globalWebSocketService = new WebSocketService(config, handlers);
  return globalWebSocketService;
}

/**
 * 销毁全局WebSocket服务
 */
export function destroyWebSocketService(): void {
  if (globalWebSocketService) {
    globalWebSocketService.disconnect();
    globalWebSocketService = null;
  }
}