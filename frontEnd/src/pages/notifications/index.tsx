import { View, Text, ScrollView, Button } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import request from '../../utils/request'
import { webSocketClient } from '../../services/WebSocketClient'
import './index.scss'
import { showToast } from '../utils/toast'

interface NotificationItem {
  id: string
  type: string
  title: string
  content: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  isRead: boolean
  createdAt: string
  readAt?: string
  data?: any
}

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [activeTab, setActiveTab] = useState<'unread' | 'all'>('unread')
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const notificationIcons = {
    charging_start: '🔌',
    charging_complete: '✅',
    charging_error: '⚠️',
    payment_success: '💰',
    payment_failed: '❌',
    balance_low: '💳',
    coupon_received: '🎫',
    coupon_expiring: '⏰',
    system_maintenance: '🔧',
    order_update: '📋'
  }

  const priorityColors = {
    low: '#52c41a',
    medium: '#faad14',
    high: '#ff7a45',
    urgent: '#ff4d4f'
  }

  useEffect(() => {
    loadNotifications(true)
    loadUnreadCount()
    
    // 连接WebSocket
    webSocketClient.connect().catch(console.error)
    
    // 监听实时通知
    webSocketClient.on('notification', handleRealtimeNotification)
    
    return () => {
      webSocketClient.off('notification', handleRealtimeNotification)
    }
  }, [])

  useEffect(() => {
    loadNotifications(true)
  }, [activeTab])

  const handleRealtimeNotification = (notification: any) => {
    console.log('收到实时通知:', notification)
    
    // 添加到通知列表顶部
    setNotifications(prev => [notification, ...prev])
    
    // 更新未读数量
    if (!notification.isRead) {
      setUnreadCount(prev => prev + 1)
    }
    
    // 显示Toast提示
    showToast({
      title: notification.title,
      icon: 'none',
      duration: 2000
    })
  }

  const loadNotifications = async (reset: boolean = false) => {
    try {
      setIsLoading(true)
      
      const currentPage = reset ? 1 : page
      const response = await request({
        url: '/notification/list',
        method: 'GET',
        data: {
          page: currentPage,
          limit: 20,
          unreadOnly: activeTab === 'unread'
        }
      })

      if (response.data.success) {
        const newNotifications = response.data.data.notifications || []
        
        if (reset) {
          setNotifications(newNotifications)
          setPage(2)
        } else {
          setNotifications(prev => [...prev, ...newNotifications])
          setPage(prev => prev + 1)
        }
        
        setHasMore(newNotifications.length === 20)
      } else {
        throw new Error(response.data.message || '获取通知失败')
      }
    } catch (error: any) {
      console.error('获取通知失败:', error)
      
      // 使用模拟数据
      const mockNotifications: NotificationItem[] = [
        {
          id: 'notif_1',
          type: 'charging_complete',
          title: '充电已完成',
          content: '您在XX充电站的充电会话已完成，本次充电费用：¥25.50',
          priority: 'high',
          isRead: false,
          createdAt: '2024-01-20T10:30:00Z'
        },
        {
          id: 'notif_2',
          type: 'coupon_received',
          title: '优惠券到账',
          content: '恭喜您获得"新用户立减10元"优惠券，有效期至2024年2月15日',
          priority: 'medium',
          isRead: false,
          createdAt: '2024-01-20T09:15:00Z'
        },
        {
          id: 'notif_3',
          type: 'payment_success',
          title: '支付成功',
          content: '您的充电费用支付成功，金额：¥25.50，余额：¥74.50',
          priority: 'medium',
          isRead: true,
          createdAt: '2024-01-19T16:45:00Z',
          readAt: '2024-01-19T17:00:00Z'
        },
        {
          id: 'notif_4',
          type: 'balance_low',
          title: '余额不足提醒',
          content: '您的账户余额不足¥20，建议及时充值以免影响充电',
          priority: 'high',
          isRead: false,
          createdAt: '2024-01-19T14:20:00Z'
        }
      ]
      
      const filteredNotifications = activeTab === 'unread' 
        ? mockNotifications.filter(n => !n.isRead)
        : mockNotifications
      
      setNotifications(filteredNotifications)
      setUnreadCount(mockNotifications.filter(n => !n.isRead).length)
      setHasMore(false)
    } finally {
      setIsLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    try {
      const response = await request({
        url: '/notification/unread-count',
        method: 'GET'
      })

      if (response.data.success) {
        setUnreadCount(response.data.data.count)
      }
    } catch (error) {
      console.error('获取未读数量失败:', error)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await request({
        url: `/notification/read/${notificationId}`,
        method: 'PUT'
      })

      if (response.data.success) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, isRead: true, readAt: new Date().toISOString() }
              : n
          )
        )
        
        setUnreadCount(prev => Math.max(0, prev - 1))
        
        showToast({
          title: '已标记为已读',
          icon: 'success'
        })
      }
    } catch (error) {
      console.error('标记已读失败:', error)
      showToast({
        title: '操作失败',
        icon: 'error'
      })
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const response = await request({
        url: '/notification/read-all',
        method: 'PUT'
      })

      if (response.data.success) {
        setNotifications(prev => 
          prev.map(n => ({ 
            ...n, 
            isRead: true, 
            readAt: new Date().toISOString() 
          }))
        )
        
        setUnreadCount(0)
        
        showToast({
          title: '全部已读',
          icon: 'success'
        })
      }
    } catch (error) {
      console.error('全部标记已读失败:', error)
      showToast({
        title: '操作失败',
        icon: 'error'
      })
    }
  }

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const response = await request({
        url: `/notification/${notificationId}`,
        method: 'DELETE'
      })

      if (response.data.success) {
        const deletedNotification = notifications.find(n => n.id === notificationId)
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        
        if (deletedNotification && !deletedNotification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
        
        showToast({
          title: '通知已删除',
          icon: 'success'
        })
      }
    } catch (error) {
      console.error('删除通知失败:', error)
      showToast({
        title: '删除失败',
        icon: 'error'
      })
    }
  }

  const formatTime = (timeStr: string) => {
    const time = new Date(timeStr)
    const now = new Date()
    const diff = now.getTime() - time.getTime()
    
    if (diff < 60 * 1000) {
      return '刚刚'
    } else if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))}分钟前`
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
    } else {
      return `${time.getMonth() + 1}月${time.getDate()}日`
    }
  }

  const handleNotificationClick = (notification: NotificationItem) => {
    // 如果未读，标记为已读
    if (!notification.isRead) {
      handleMarkAsRead(notification.id)
    }

    // 根据通知类型进行相应的跳转
    switch (notification.type) {
      case 'charging_complete':
      case 'charging_start':
      case 'charging_error':
        Taro.switchTab({ url: '/pages/charging/index' })
        break
      case 'coupon_received':
      case 'coupon_expiring':
        Taro.navigateTo({ url: '/pages/coupons/index' })
        break
      case 'payment_success':
      case 'payment_failed':
        Taro.switchTab({ url: '/pages/profile/index' })
        break
      case 'balance_low':
        Taro.switchTab({ url: '/pages/profile/index' })
        break
      default:
        break
    }
  }

  const renderNotificationItem = (notification: NotificationItem) => (
    <View 
      key={notification.id} 
      className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
      onClick={() => handleNotificationClick(notification)}
    >
      <View className='notification-main'>
        <View className='notification-icon'>
          <Text className='icon-text'>
            {notificationIcons[notification.type] || '📢'}
          </Text>
        </View>

        <View className='notification-content'>
          <View className='notification-header'>
            <Text className='notification-title'>{notification.title}</Text>
            <View 
              className='priority-dot'
              style={{ backgroundColor: priorityColors[notification.priority] }}
            />
          </View>
          
          <Text className='notification-text'>{notification.content}</Text>
          
          <View className='notification-footer'>
            <Text className='notification-time'>{formatTime(notification.createdAt)}</Text>
            {notification.isRead && notification.readAt && (
              <Text className='read-status'>已读</Text>
            )}
          </View>
        </View>
      </View>

      <View className='notification-actions'>
        {!notification.isRead && (
          <Button 
            className='action-btn read-btn'
            size='mini'
            onClick={(e) => {
              e.stopPropagation()
              handleMarkAsRead(notification.id)
            }}
          >
            已读
          </Button>
        )}
        <Button 
          className='action-btn delete-btn'
          size='mini'
          onClick={(e) => {
            e.stopPropagation()
            handleDeleteNotification(notification.id)
          }}
        >
          删除
        </Button>
      </View>

      {!notification.isRead && <View className='unread-indicator' />}
    </View>
  )

  return (
    <View className='notifications-page'>
      {/* 头部 */}
      <View className='notifications-header'>
        <Text className='header-title'>消息通知</Text>
        <Text className='header-subtitle'>
          {unreadCount > 0 ? `${unreadCount}条未读消息` : '暂无未读消息'}
        </Text>
      </View>

      {/* 标签页 */}
      <View className='notification-tabs'>
        <View 
          className={`tab-item ${activeTab === 'unread' ? 'active' : ''}`}
          onClick={() => setActiveTab('unread')}
        >
          <Text className='tab-text'>未读</Text>
          {unreadCount > 0 && (
            <View className='tab-badge'>
              <Text className='badge-text'>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View 
          className={`tab-item ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <Text className='tab-text'>全部</Text>
        </View>
      </View>

      {/* 操作栏 */}
      {unreadCount > 0 && (
        <View className='toolbar'>
          <Button 
            className='toolbar-btn'
            size='mini'
            onClick={handleMarkAllAsRead}
          >
            全部已读
          </Button>
        </View>
      )}

      {/* 通知列表 */}
      <ScrollView 
        className='notifications-list'
        scrollY
        onScrollToLower={() => {
          if (hasMore && !isLoading) {
            loadNotifications(false)
          }
        }}
      >
        {notifications.length > 0 ? (
          <>
            {notifications.map(renderNotificationItem)}
            {isLoading && (
              <View className='loading-more'>
                <Text className='loading-text'>加载中...</Text>
              </View>
            )}
            {!hasMore && notifications.length > 0 && (
              <View className='no-more'>
                <Text className='no-more-text'>没有更多通知了</Text>
              </View>
            )}
          </>
        ) : (
          <View className='empty-state'>
            <Text className='empty-icon'>🔔</Text>
            <Text className='empty-text'>
              {activeTab === 'unread' ? '暂无未读通知' : '暂无通知'}
            </Text>
            <Text className='empty-tip'>
              {activeTab === 'unread' ? '所有通知都已阅读' : '开始使用应用后会收到相关通知'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

export default NotificationsPage