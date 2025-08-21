import { useEffect, useRef, useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { TaroSafe } from '../utils/taroSafe'
import { showToast } from '../utils/toast'
import { STORAGE_KEYS, TIME_CONSTANTS, WEBSOCKET_CONSTANTS } from '../utils/constants'

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: string
}

export interface NotificationMessage {
  id: string
  userId: string
  type: string
  subType: string
  title: string
  content: string
  data?: any
  priority: string
  timestamp: string
}

interface UseWebSocketOptions {
  url: string
  protocols?: string[]
  onOpen?: () => void
  onMessage?: (message: WebSocketMessage) => void
  onError?: (error: any) => void
  onClose?: () => void
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
}

interface UseWebSocketReturn {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  sendMessage: (message: any) => void
  connect: () => void
  disconnect: () => void
  reconnect: () => void
}

export const useWebSocket = (options: UseWebSocketOptions): UseWebSocketReturn => {
  const {
    url,
    protocols = [],
    onOpen,
    onMessage,
    onError,
    onClose,
    reconnectInterval = TIME_CONSTANTS.THREE_SECONDS,
    maxReconnectAttempts = 5,
    heartbeatInterval = TIME_CONSTANTS.THIRTY_SECONDS
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<Taro.SocketTask | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isManualCloseRef = useRef(false)

  const clearTimeouts = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }
  }, [])

  const startHeartbeat = useCallback(() => {
    clearTimeouts()
    
    heartbeatTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && isConnected) {
        try {
          socketRef.current.send({
            data: JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString()
            })
          })
          startHeartbeat() // 继续下一次心跳
        } catch (error) {
          console.error('发送心跳失败:', error)
        }
      }
    }, heartbeatInterval)
  }, [isConnected, heartbeatInterval, clearTimeouts])

  const connect = useCallback(() => {
    if (isConnecting || isConnected) {
      return
    }

    setIsConnecting(true)
    setError(null)
    isManualCloseRef.current = false

    try {
      // 获取认证token
      const token = TaroSafe.getStorageSync('user_token')
      if (!token) {
        // 如果没有token，可能用户还未登录，暂时不建立连接
        console.log('WebSocket: 用户未登录，跳过连接')
        setIsConnecting(false)
        return
      }

      // 构建WebSocket URL
      const wsUrl = `${url}?token=${encodeURIComponent(token)}`

      socketRef.current = Taro.connectSocket({
        url: wsUrl,
        protocols
      })

      socketRef.current.onOpen(() => {
        console.log('WebSocket连接已建立')
        setIsConnected(true)
        setIsConnecting(false)
        setError(null)
        reconnectAttemptsRef.current = 0
        
        startHeartbeat()
        onOpen?.()
      })

      socketRef.current.onMessage((event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data as string)
          console.log('收到WebSocket消息:', message)
          onMessage?.(message)
        } catch (error) {
          console.error('解析WebSocket消息失败:', error)
        }
      })

      socketRef.current.onError((error) => {
        console.error('WebSocket错误:', error)
        setError('连接错误')
        setIsConnecting(false)
        onError?.(error)
      })

      socketRef.current.onClose((event) => {
        console.log('WebSocket连接已关闭:', event)
        setIsConnected(false)
        setIsConnecting(false)
        clearTimeouts()
        
        onClose?.()

        // 如果不是手动关闭且未达到最大重连次数，则自动重连
        if (!isManualCloseRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          console.log(`准备第${reconnectAttemptsRef.current}次重连...`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('连接失败，已达到最大重连次数')
        }
      })

    } catch (error: any) {
      console.error('创建WebSocket连接失败:', error)
      setError(error.message || '连接失败')
      setIsConnecting(false)
    }
  }, [
    url, 
    protocols, 
    isConnecting, 
    isConnected, 
    onOpen, 
    onMessage, 
    onError, 
    onClose,
    reconnectInterval,
    maxReconnectAttempts,
    startHeartbeat,
    clearTimeouts
  ])

  const disconnect = useCallback(() => {
    isManualCloseRef.current = true
    clearTimeouts()
    
    if (socketRef.current) {
      socketRef.current.close({
        code: WEBSOCKET_CONSTANTS.NORMAL_CLOSURE,
        reason: '手动关闭'
      })
      socketRef.current = null
    }
    
    setIsConnected(false)
    setIsConnecting(false)
    setError(null)
    reconnectAttemptsRef.current = 0
  }, [clearTimeouts])

  const reconnect = useCallback(() => {
    disconnect()
    setTimeout(() => {
      connect()
    }, TIME_CONSTANTS.ONE_SECOND)
  }, [disconnect, connect])

  const sendMessage = useCallback((message: any) => {
    if (!socketRef.current || !isConnected) {
      console.warn('WebSocket未连接，无法发送消息')
      return
    }

    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message)
      socketRef.current.send({
        data: messageStr
      })
    } catch (error) {
      console.error('发送WebSocket消息失败:', error)
    }
  }, [isConnected])

  // 组件挂载时自动连接
  useEffect(() => {
    connect()

    // 组件卸载时断开连接
    return () => {
      disconnect()
    }
  }, []) // 只在组件挂载时执行一次

  // 监听应用前后台切换
  useEffect(() => {
    const handleAppShow = () => {
      console.log('应用进入前台，检查WebSocket连接')
      if (!isConnected && !isConnecting) {
        connect()
      }
    }

    const handleAppHide = () => {
      console.log('应用进入后台')
      // 可以选择在后台时断开连接以节省资源
      // disconnect()
    }

    TaroSafe.onAppShow(handleAppShow)
    TaroSafe.onAppHide(handleAppHide)

    return () => {
      // 安全的清理函数
      try {
        if (typeof Taro.offAppShow === 'function') {
          Taro.offAppShow(handleAppShow)
        }
        if (typeof Taro.offAppHide === 'function') {
          Taro.offAppHide(handleAppHide)
        }
      } catch (error) {
        console.warn('清理生命周期监听器失败:', error)
      }
    }
  }, [isConnected, isConnecting, connect])

  return {
    isConnected,
    isConnecting,
    error,
    sendMessage,
    connect,
    disconnect,
    reconnect
  }
}

// 通知专用的WebSocket Hook
export const useNotificationWebSocket = () => {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'new_notification':
        const notification = message.data as NotificationMessage
        setNotifications(prev => [notification, ...prev])
        setUnreadCount(prev => prev + 1)
        
        // 显示系统通知
        showToast({
          title: notification.title,
          icon: 'none',
          duration: TIME_CONSTANTS.TWO_SECONDS
        })
        break

      case 'notification_read':
        const { notificationId } = message.data
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, isRead: true }
              : n
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
        break

      case 'system_notification':
        const systemNotification = message.data as NotificationMessage
        // 系统通知使用更显眼的提示
        Taro.showModal({
          title: '系统通知',
          content: systemNotification.content,
          showCancel: false,
          confirmText: '知道了'
        })
        break

      case 'connected':
        console.log('通知服务连接成功:', message.data)
        break

      default:
        console.log('未知消息类型:', message.type, message.data)
    }
  }, [])

  const handleError = useCallback((error: any) => {
    console.error('通知WebSocket错误:', error)
    showToast({
      title: '通知服务连接异常',
      icon: 'none'
    })
  }, [])

  const webSocket = useWebSocket({
    url: process.env.NODE_ENV === 'development' 
      ? 'ws://localhost:8080'
      : 'wss://your-domain.com',
    onMessage: handleMessage,
    onError: handleError,
    onOpen: () => {
      console.log('通知WebSocket连接成功')
    },
    onClose: () => {
      console.log('通知WebSocket连接关闭')
    }
  })

  const requestNotifications = useCallback((options: {
    page?: number
    limit?: number
    type?: string
    isRead?: boolean
  } = {}) => {
    webSocket.sendMessage({
      type: 'request_notifications',
      data: options
    })
  }, [webSocket])

  const markNotificationRead = useCallback((notificationId: string) => {
    webSocket.sendMessage({
      type: 'mark_notification_read',
      data: { notificationId }
    })
  }, [webSocket])

  return {
    ...webSocket,
    notifications,
    unreadCount,
    requestNotifications,
    markNotificationRead,
    setNotifications,
    setUnreadCount
  }
}