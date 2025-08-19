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
    <>\n      <View \n        className={`notification-badge ${sizeClass} ${statusClass} ${className}`}\n        onClick={handleClick}\n      >\n        <View className='notification-icon'>\n          <Text className='icon-text'>🔔</Text>\n          {!isConnected && (\n            <View className='connection-indicator offline' />\n          )}\n        </View>\n        \n        {unreadCount > 0 && (\n          <View className='notification-count'>\n            <Text className='count-text'>{getDisplayCount()}</Text>\n          </View>\n        )}\n      </View>\n\n      <NotificationCenter \n        visible={showCenter}\n        onClose={handleClose}\n      />\n    </>\n  )\n}\n\nexport default NotificationBadge"