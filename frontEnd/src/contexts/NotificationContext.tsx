import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { useNotificationWebSocket, NotificationMessage } from '../hooks/useWebSocket'
import { TIME_CONSTANTS } from '../utils/constants'

interface NotificationState {
  notifications: NotificationMessage[]
  unreadCount: number
  isConnected: boolean
  isLoading: boolean
  error: string | null
}

type NotificationAction =
  | { type: 'SET_NOTIFICATIONS'; payload: NotificationMessage[] }
  | { type: 'ADD_NOTIFICATION'; payload: NotificationMessage }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'MARK_ALL_AS_READ' }
  | { type: 'DELETE_NOTIFICATION'; payload: string }
  | { type: 'SET_UNREAD_COUNT'; payload: number }
  | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isConnected: false,
  isLoading: false,
  error: null
}

const notificationReducer = (state: NotificationState, action: NotificationAction): NotificationState => {
  switch (action.type) {
    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
        unreadCount: action.payload.filter(n => !n.isRead).length
      }

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: action.payload.isRead ? state.unreadCount : state.unreadCount + 1
      }

    case 'MARK_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }

    case 'MARK_ALL_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0
      }

    case 'DELETE_NOTIFICATION':
      const deletedNotification = state.notifications.find(n => n.id === action.payload)
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
        unreadCount: deletedNotification && !deletedNotification.isRead 
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount
      }

    case 'SET_UNREAD_COUNT':
      return {
        ...state,
        unreadCount: action.payload
      }

    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload
      }

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      }

    default:
      return state
  }
}

interface NotificationContextType extends NotificationState {
  addNotification: (notification: NotificationMessage) => void
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  deleteNotification: (notificationId: string) => void
  refreshNotifications: () => void
  sendMessage: (message: any) => void
  reconnect: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

interface NotificationProviderProps {
  children: ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState)
  
  const webSocket = useNotificationWebSocket()

  // 同步WebSocket状态到Context
  useEffect(() => {
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: webSocket.isConnected })
  }, [webSocket.isConnected])

  useEffect(() => {
    dispatch({ type: 'SET_ERROR', payload: webSocket.error })
  }, [webSocket.error])

  useEffect(() => {
    dispatch({ type: 'SET_NOTIFICATIONS', payload: webSocket.notifications })
  }, [webSocket.notifications])

  useEffect(() => {
    dispatch({ type: 'SET_UNREAD_COUNT', payload: webSocket.unreadCount })
  }, [webSocket.unreadCount])

  const addNotification = (notification: NotificationMessage) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
  }

  const markAsRead = (notificationId: string) => {
    dispatch({ type: 'MARK_AS_READ', payload: notificationId })
    webSocket.markNotificationRead(notificationId)
  }

  const markAllAsRead = () => {
    dispatch({ type: 'MARK_ALL_AS_READ' })
    // 这里可以调用API批量标记已读
  }

  const deleteNotification = (notificationId: string) => {
    dispatch({ type: 'DELETE_NOTIFICATION', payload: notificationId })
    // 这里可以调用API删除通知
  }

  const refreshNotifications = () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    webSocket.requestNotifications()
    setTimeout(() => {
      dispatch({ type: 'SET_LOADING', payload: false })
    }, TIME_CONSTANTS.ONE_SECOND)
  }

  const contextValue: NotificationContextType = {
    ...state,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    sendMessage: webSocket.sendMessage,
    reconnect: webSocket.reconnect
  }

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

// 通知类型工具函数
export const getNotificationIcon = (type: string, subType: string): string => {
  switch (type) {
    case 'charging':
      switch (subType) {
        case 'started': return '🔌'
        case 'completed': return '⚡'
        case 'failed': return '❌'
        case 'interrupted': return '⚠️'
        default: return '🔋'
      }
    case 'payment':
      switch (subType) {
        case 'success': return '💰'
        case 'failed': return '❌'
        case 'refund': return '💸'
        default: return '💳'
      }
    case 'coupon':
      switch (subType) {
        case 'received': return '🎫'
        case 'expiry_warning': return '⏰'
        case 'expired': return '⏰'
        default: return '🎟️'
      }
    case 'system':
      return '📢'
    case 'maintenance':
      return '🔧'
    default:
      return '🔔'
  }
}

export const getNotificationTypeLabel = (type: string, subType: string): string => {
  switch (type) {
    case 'charging':
      switch (subType) {
        case 'started': return '充电开始'
        case 'completed': return '充电完成'
        case 'failed': return '充电失败'
        case 'interrupted': return '充电中断'
        default: return '充电通知'
      }
    case 'payment':
      switch (subType) {
        case 'success': return '支付成功'
        case 'failed': return '支付失败'
        case 'refund': return '退款到账'
        default: return '支付通知'
      }
    case 'coupon':
      switch (subType) {
        case 'received': return '优惠券到账'
        case 'expiry_warning': return '优惠券即将过期'
        case 'expired': return '优惠券已过期'
        default: return '优惠券通知'
      }
    case 'system':
      return '系统通知'
    case 'maintenance':
      return '维护通知'
    default:
      return '通知'
  }
}

export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'low': return '#52c41a'
    case 'medium': return '#faad14'
    case 'high': return '#ff7a45'
    case 'urgent': return '#ff4d4f'
    default: return '#d9d9d9'
  }
}

export const getPriorityLabel = (priority: string): string => {
  switch (priority) {
    case 'low': return '一般'
    case 'medium': return '重要'
    case 'high': return '紧急'
    case 'urgent': return '非常紧急'
    default: return '未知'
  }
}