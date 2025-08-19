import { View, Text, ScrollView, Button } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import request from '../../utils/request'
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

interface NotificationStats {
  total: number
  unread: number
  byType: Record<string, number>
  byPriority: Record<string, number>
}

interface NotificationCenterProps {
  visible: boolean
  onClose: () => void
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ visible, onClose }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    byType: {},
    byPriority: {}
  })
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('unread')
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const notificationTypeLabels = {
    charging_start: '充电开始',
    charging_complete: '充电完成',
    charging_error: '充电异常',
    payment_success: '支付成功',
    payment_failed: '支付失败',
    balance_low: '余额不足',
    coupon_received: '优惠券到账',
    coupon_expiring: '优惠券过期',
    system_maintenance: '系统维护',
    order_update: '订单更新'
  }

  const priorityColors = {
    low: '#52c41a',
    medium: '#faad14',
    high: '#ff7a45',
    urgent: '#ff4d4f'
  }

  const priorityLabels = {
    low: '一般',
    medium: '重要',
    high: '紧急',
    urgent: '非常紧急'
  }

  useEffect(() => {
    if (visible) {
      loadNotifications(true)
      loadStats()
    }
  }, [visible, activeTab])

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
      
      // 使用模拟数据作为后备
      const mockNotifications: NotificationItem[] = [
        {
          id: 'notif_1',
          type: 'charging_complete',
          title: '充电已完成',
          content: '您的充电会话已完成，请及时移走车辆',
          priority: 'high',
          isRead: false,
          createdAt: '2024-01-20T10:30:00Z'
        },
        {
          id: 'notif_2',
          type: 'coupon_received',
          title: '优惠券到账',
          content: '您获得了新的优惠券"新用户立减10元"，快去使用吧！',
          priority: 'medium',
          isRead: false,
          createdAt: '2024-01-20T09:15:00Z'
        },
        {
          id: 'notif_3',
          type: 'payment_success',
          title: '支付成功',
          content: '您的充电费用支付成功，金额：¥25.50',
          priority: 'medium',
          isRead: true,
          createdAt: '2024-01-19T16:45:00Z',
          readAt: '2024-01-19T17:00:00Z'
        }
      ]
      
      const filteredNotifications = activeTab === 'unread' 
        ? mockNotifications.filter(n => !n.isRead)
        : mockNotifications
      
      setNotifications(filteredNotifications)
      setHasMore(false)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await request({
        url: '/notification/stats',
        method: 'GET'
      })

      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (error) {
      console.error('获取统计信息失败:', error)
      // 使用模拟数据
      setStats({
        total: 5,
        unread: 2,
        byType: {
          charging_complete: 2,
          coupon_received: 1,
          payment_success: 2
        },
        byPriority: {
          high: 2,
          medium: 3
        }
      })
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await request({
        url: `/notification/read/${notificationId}`,
        method: 'PUT'
      })

      if (response.data.success) {
        // 更新本地状态
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, isRead: true, readAt: new Date().toISOString() }
              : n
          )
        )
        
        // 更新统计信息
        setStats(prev => ({
          ...prev,
          unread: Math.max(0, prev.unread - 1)
        }))

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
        // 更新本地状态
        setNotifications(prev => 
          prev.map(n => ({ 
            ...n, 
            isRead: true, 
            readAt: new Date().toISOString() 
          }))
        )
        
        // 更新统计信息
        setStats(prev => ({ ...prev, unread: 0 }))

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
        // 更新本地状态
        const deletedNotification = notifications.find(n => n.id === notificationId)
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        
        // 更新统计信息
        setStats(prev => ({
          ...prev,
          total: prev.total - 1,
          unread: deletedNotification && !deletedNotification.isRead 
            ? prev.unread - 1 
            : prev.unread
        }))

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
        Taro.navigateTo({ url: '/pages/orders/index' })
        break
      case 'balance_low':
        Taro.navigateTo({ url: '/pages/wallet/index' })
        break
      default:
        break
    }
    
    onClose()
  }

  const renderNotificationItem = (notification: NotificationItem) => (
    <View 
      key={notification.id} 
      className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
      onClick={() => handleNotificationClick(notification)}
    >
      <View className='notification-header'>
        <View className='notification-type'>
          <Text className='type-label'>
            {notificationTypeLabels[notification.type] || notification.type}
          </Text>
          <View 
            className='priority-badge'
            style={{ backgroundColor: priorityColors[notification.priority] }}
          >
            <Text className='priority-text'>
              {priorityLabels[notification.priority]}
            </Text>
          </View>
        </View>
        <Text className='notification-time'>{formatTime(notification.createdAt)}</Text>
      </View>

      <Text className='notification-title'>{notification.title}</Text>
      <Text className='notification-content'>{notification.content}</Text>

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
            标记已读
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

  if (!visible) return null

  return (
    <View className='notification-center'>
      <View className='notification-mask' onClick={onClose} />
      
      <View className='notification-panel'>
        {/* 头部 */}
        <View className='notification-header-bar'>
          <Text className='header-title'>通知中心</Text>
          <Button className='close-btn' onClick={onClose}>✕</Button>
        </View>

        {/* 统计信息 */}
        <View className='notification-stats'>
          <View className='stat-item'>
            <Text className='stat-number'>{stats.total}</Text>
            <Text className='stat-label'>总计</Text>
          </View>
          <View className='stat-item'>
            <Text className='stat-number unread'>{stats.unread}</Text>
            <Text className='stat-label'>未读</Text>
          </View>
        </View>

        {/* 标签页 */}
        <View className='notification-tabs'>
          <View 
            className={`tab-item ${activeTab === 'unread' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('unread')
              setPage(1)
            }}
          >
            <Text className='tab-text'>未读</Text>
            {stats.unread > 0 && (
              <View className='tab-badge'>
                <Text className='badge-text'>{stats.unread}</Text>
              </View>
            )}
          </View>
          <View 
            className={`tab-item ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all')
              setPage(1)
            }}
          >
            <Text className='tab-text'>全部</Text>
          </View>
        </View>

        {/* 操作栏 */}
        {stats.unread > 0 && (
          <View className='notification-toolbar'>
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
          className='notification-list'
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
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  )
}

export default NotificationCenter