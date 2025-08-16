import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconProp, SizeProp } from '@fortawesome/fontawesome-svg-core'
import { View } from '@tarojs/components'
import './index.scss'

interface IconProps {
  /** 图标名称，支持字符串或数组格式 */
  icon: IconProp
  /** 图标大小 */
  size?: SizeProp
  /** 图标颜色 */
  color?: string
  /** 自定义类名 */
  className?: string
  /** 点击事件 */
  onClick?: () => void
  /** 是否旋转 */
  spin?: boolean
  /** 是否脉冲动画 */
  pulse?: boolean
  /** 旋转角度 */
  rotation?: 90 | 180 | 270
  /** 水平翻转 */
  flip?: 'horizontal' | 'vertical' | 'both'
}

const Icon: React.FC<IconProps> = ({
  icon,
  size = 'lg',
  color,
  className = '',
  onClick,
  spin = false,
  pulse = false,
  rotation,
  flip
}) => {
  return (
    <View className={`icon-wrapper ${className}`} onClick={onClick}>
      <FontAwesomeIcon 
        icon={icon}
        size={size}
        color={color}
        spin={spin}
        pulse={pulse}
        rotation={rotation}
        flip={flip}
      />
    </View>
  )
}

export default Icon