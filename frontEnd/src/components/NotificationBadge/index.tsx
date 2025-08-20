import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { useNotification } from '../../contexts/NotificationContext'
import NotificationCenter from '../NotificationCenter'
import './index.scss'

interface NotificationBadgeProps {
  className?: string
  size?: 'small' | 'medium' | 'large'
  showCount?: boolean
  maxCount?: number
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  className = '',
  size = 'medium',
  showCount = true,
  maxCount = 99
}) => {
  const [showCenter, setShowCenter] = useState(false)
  const { unreadCount, isConnected } = useNotification()

  const handleClick = () => {
    setShowCenter(true)
  }

  const handleClose = () => {
    setShowCenter(false)
  }

  const getDisplayCount = () => {
    if (!showCount || unreadCount === 0) return ''
    if (unreadCount > maxCount) return `${maxCount}+`
    return unreadCount.toString()
  }

  const sizeClass = `notification-badge--${size}`
  const statusClass = isConnected ? 'connected' : 'disconnected'

  return (
    <>
      <View 
        className={`notification-badge ${sizeClass} ${statusClass} ${className}`}
        onClick={handleClick}
      >
        <View className='notification-icon'>
          <Text className='icon-text'>🔔</Text>
          {!isConnected && (
            <View className='connection-indicator offline' />
          )}
        </View>
        
        {unreadCount > 0 && (
          <View className='notification-count'>
            <Text className='count-text'>{getDisplayCount()}</Text>
          </View>
        )}
      </View>

      <NotificationCenter 
        visible={showCenter}
        onClose={handleClose}
      />
    </>
  )
}

export default NotificationBadge