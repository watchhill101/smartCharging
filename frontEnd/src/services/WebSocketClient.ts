import Taro from '@tarojs/taro'
import { TaroSafe } from '../utils/taroSafe'
import { STORAGE_KEYS } from '../utils/constants'

export interface WebSocketMessage {
  type: string
  data?: any
  timestamp?: string
}

export interface NotificationMessage {
  type: 'charging_status' | 'payment_result' | 'system_notice' | 'error'
  title: string
  content: string
  data?: any
  timestamp: string
  userId?: string
  sessionId?: string
}

export interface ChargingStatusUpdate {
  sessionId: string
  pileId: string
  status: 'preparing' | 'charging' | 'suspended' | 'finishing' | 'completed' | 'faulted'
  currentPower: number
  energyDelivered: number
  duration: number
  cost: number
  voltage: number
  current: number
  temperature: number
  timestamp: string
}

export class WebSocketClient {
  private socket: Taro.SocketTask | null = null
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectInterval: number = 3000
  private heartbeatInterval: NodeJS.Timeout | null = null
  private messageHandlers: Map<string, Function[]> = new Map()
  private connectionPromise: Promise<void> | null = null

  constructor() {
    this.setupEventHandlers()
  }

  /**
   * 连接WebSocket
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise
    }

    this.connectionPromise = this._connect()
    return this.connectionPromise
  }

  private async _connect(): Promise<void> {
    try {
      // 获取认证token
      const token = TaroSafe.getStorageSync(STORAGE_KEYS.USER_TOKEN)
      if (!token) {
        throw new Error('未找到认证token')
      }

      // 构建WebSocket URL
      const wsUrl = `${this.getWebSocketUrl()}?token=${encodeURIComponent(token)}`
      
      console.log('🔌 正在连接WebSocket服务器...')

      return new Promise((resolve, reject) => {
        this.socket = Taro.connectSocket({
          url: wsUrl,
          success: () => {
            console.log('📡 WebSocket连接请求已发送')
          },
          fail: (error) => {
            console.error('❌ WebSocket连接失败:', error)
            reject(new Error('WebSocket连接失败'))
          }
        })

        // 连接成功
        this.socket.onOpen(() => {
          console.log('✅ WebSocket连接已建立')
          this.isConnected = true
          this.reconnectAttempts = 0
          this.connectionPromise = null
          this.startHeartbeat()
          this.subscribeToNotifications()
          resolve()
        })

        // 连接失败
        this.socket.onError((error) => {
          console.error('❌ WebSocket连接错误:', error)
          this.isConnected = false
          this.connectionPromise = null
          reject(new Error('WebSocket连接错误'))
        })

        // 连接关闭
        this.socket.onClose((res) => {
          console.log('📡 WebSocket连接已关闭:', res)
          this.isConnected = false
          this.connectionPromise = null
          this.stopHeartbeat()
          
          // 自动重连
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect()
          }
        })

        // 接收消息
        this.socket.onMessage((res) => {
          this.handleMessage(res.data)
        })
      })
    } catch (error) {
      console.error('WebSocket连接异常:', error)
      this.connectionPromise = null
      throw error
    }
  }

  /**
   * 获取WebSocket URL
   */
  private getWebSocketUrl(): string {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'wss://api.smartcharging.com'
      : 'ws://localhost:8080'
    
    return baseUrl
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 监听应用生命周期
    TaroSafe.onAppShow(() => {
      if (!this.isConnected) {
        this.connect().catch(console.error)
      }
    })

    TaroSafe.onAppHide(() => {
      this.disconnect()
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close({
        code: 1000,
        reason: '主动断开连接'
      })
      this.socket = null
    }
    
    this.isConnected = false
    this.stopHeartbeat()
    console.log('🔌 WebSocket连接已断开')
  }

  /**
   * 发送消息
   */
  async sendMessage(message: WebSocketMessage): Promise<void> {
    if (!this.isConnected || !this.socket) {
      await this.connect()
    }

    return new Promise((resolve, reject) => {
      this.socket!.send({
        data: JSON.stringify({
          ...message,
          timestamp: new Date().toISOString()
        }),
        success: () => {
          console.log('📤 消息已发送:', message.type)
          resolve()
        },
        fail: (error) => {
          console.error('❌ 消息发送失败:', error)
          reject(new Error('消息发送失败'))
        }
      })
    })
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)
      console.log('📥 收到消息:', message.type, message)

      // 触发对应的事件处理器
      const handlers = this.messageHandlers.get(message.type) || []
      handlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('消息处理器执行失败:', error)
        }
      })

      // 处理特殊消息类型
      switch (message.type) {
        case 'connected':
          this.handleConnected(message)
          break
        case 'notification':
          this.handleNotification(message)
          break
        case 'charging_status_update':
          this.handleChargingStatusUpdate(message)
          break
        case 'system_notification':
          this.handleSystemNotification(message)
          break
        case 'ping':
          this.handlePing(message)
          break
        default:
          console.log('未处理的消息类型:', message.type)
      }
    } catch (error) {
      console.error('消息解析失败:', error)
    }
  }

  /**
   * 处理连接成功消息
   */
  private handleConnected(message: any): void {
    console.log('🎉 WebSocket连接确认:', message.message)
  }

  /**
   * 处理通知消息
   */
  private handleNotification(message: NotificationMessage): void {
    console.log('🔔 收到通知:', message.title)
    
    // 显示系统通知
    this.showSystemNotification(message)
    
    // 触发通知事件
    this.emit('notification', message)
  }

  /**
   * 处理充电状态更新
   */
  private handleChargingStatusUpdate(message: any): void {
    console.log('⚡ 充电状态更新:', message.status)
    this.emit('charging_status_update', message.status)
  }

  /**
   * 处理系统通知
   */
  private handleSystemNotification(message: NotificationMessage): void {
    console.log('📢 系统通知:', message.title)
    this.showSystemNotification(message)
    this.emit('system_notification', message)
  }

  /**
   * 处理心跳消息
   */
  private handlePing(message: any): void {
    // 回复pong
    this.sendMessage({
      type: 'pong',
      data: { timestamp: message.timestamp }
    }).catch(console.error)
  }

  /**
   * 显示系统通知
   */
  private showSystemNotification(message: NotificationMessage): void {
    // 根据优先级决定通知方式
    if (message.type === 'error' || message.type === 'system_notice') {
      Taro.showModal({
        title: message.title,
        content: message.content,
        showCancel: false,
        confirmText: '知道了'
      })
    } else {
      TaroSafe.showToast({
        title: message.title,
        icon: 'none',
        duration: 3000
      })
    }
  }

  /**
   * 订阅通知
   */
  private subscribeToNotifications(): void {
    this.sendMessage({
      type: 'subscribe_notifications'
    }).catch(console.error)
  }

  /**
   * 订阅充电会话状态
   */
  subscribeChargingSession(sessionId: string): void {
    this.sendMessage({
      type: 'subscribe_charging_session',
      data: { sessionId }
    }).catch(console.error)
  }

  /**
   * 取消订阅充电会话状态
   */
  unsubscribeChargingSession(sessionId: string): void {
    this.sendMessage({
      type: 'unsubscribe_charging_session',
      data: { sessionId }
    }).catch(console.error)
  }

  /**
   * 获取充电状态
   */
  getChargingStatus(sessionId: string): void {
    this.sendMessage({
      type: 'get_charging_status',
      data: { sessionId }
    }).catch(console.error)
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({
          type: 'heartbeat'
        }).catch(() => {
          // 心跳失败，可能连接已断开
          this.isConnected = false
        })
      }
    }, 30000) // 30秒心跳
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * 计划重连
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`🔄 ${delay}ms后尝试第${this.reconnectAttempts}次重连...`)
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect().catch(console.error)
      }
    }, delay)
  }

  /**
   * 添加事件监听器
   */
  on(event: string, handler: Function): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, [])
    }
    this.messageHandlers.get(event)!.push(handler)
  }

  /**
   * 移除事件监听器
   */
  off(event: string, handler?: Function): void {
    if (!handler) {
      this.messageHandlers.delete(event)
      return
    }

    const handlers = this.messageHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data?: any): void {
    const handlers = this.messageHandlers.get(event) || []
    handlers.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        console.error('事件处理器执行失败:', error)
      }
    })
  }

  /**
   * 获取连接状态
   */
  isConnectedStatus(): boolean {
    return this.isConnected
  }

  /**
   * 获取连接统计信息
   */
  getConnectionInfo(): {
    isConnected: boolean
    reconnectAttempts: number
    hasSocket: boolean
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      hasSocket: !!this.socket
    }
  }
}

// 创建全局WebSocket客户端实例
export const webSocketClient = new WebSocketClient()