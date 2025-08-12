import React from 'react'
import { View } from '@tarojs/components'

/**
 * 环境检测工具
 */
export const env = {
  // 是否为小程序环境
  isMiniProgram: ['weapp', 'alipay', 'swan', 'tt', 'qq', 'jd'].includes(process.env.TARO_ENV || ''),
  
  // 是否为 H5 环境
  isH5: process.env.TARO_ENV === 'h5',
  
  // 是否为微信小程序
  isWeapp: process.env.TARO_ENV === 'weapp',
  
  // 获取当前平台
  getPlatform: () => process.env.TARO_ENV || 'unknown'
}

/**
 * 条件渲染高阶组件 - 用于解决小程序不支持动态创建组件的问题
 */
interface ConditionalRenderProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface PlatformRenderProps extends ConditionalRenderProps {
  platforms: string[]
}

export const ConditionalRender = {
  // 仅在 H5 环境渲染
  H5Only: ({ children, fallback = null }: ConditionalRenderProps) => {
    return env.isH5 ? <>{children}</> : <>{fallback}</>
  },
  
  // 仅在小程序环境渲染
  MiniProgramOnly: ({ children, fallback = null }: ConditionalRenderProps) => {
    return env.isMiniProgram ? <>{children}</> : <>{fallback}</>
  },
  
  // 平台条件渲染
  Platform: ({ platforms, children, fallback = null }: PlatformRenderProps) => {
    return platforms.includes(env.getPlatform()) ? <>{children}</> : <>{fallback}</>
  }
}

/**
 * 安全的按钮组件 - 避免使用可能包含 Lottie 动画的组件
 */
interface SafeButtonProps {
  type?: string
  className?: string
  children: React.ReactNode
  onClick?: () => void
}

export const SafeButton: React.FC<SafeButtonProps> = (props) => {
  const { children, className = '', onClick, type } = props
  
  // 统一使用简化版本，避免 Lottie 相关问题
  return (
    <View 
      className={`safe-button ${type === 'primary' ? 'safe-button--primary' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </View>
  )
}
