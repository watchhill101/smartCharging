import { View, Text } from '@tarojs/components'
import { useState, useRef, useCallback } from 'react'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { post } from '../../utils/request'
import './index.scss'

interface SliderVerifyProps {
  onSuccess: (token: string) => void
  onError?: (error: string) => void
  width?: number
  height?: number
}

interface TouchPosition {
  startX: number
  currentX: number
}

export default function SliderVerify({
  onSuccess,
  onError,
  width,
  height = 42
}: SliderVerifyProps) {
  const [isMoving, setIsMoving] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [slideDistance, setSlideDistance] = useState(0)
  const [puzzleOffset, setPuzzleOffset] = useState(0)
  const [verifyPath, setVerifyPath] = useState<number[]>([])
  const [containerWidth, setContainerWidth] = useState(248)

  const sliderRef = useRef<any>(null)
  const startTimeRef = useRef<number>(0)
  const trackRef = useRef<TouchPosition[]>([])

  // 生成随机拼图位置
  const generatePuzzlePosition = useCallback(() => {
    const effectiveWidth = width || containerWidth
    const minOffset = effectiveWidth * 0.25
    const maxOffset = effectiveWidth * 0.7
    const offset = Math.random() * (maxOffset - minOffset) + minOffset
    setPuzzleOffset(offset)
    return offset
  }, [width, containerWidth])

  // 初始化验证
  const initVerify = useCallback(() => {
    setIsVerified(false)
    setIsVerifying(false)
    setSlideDistance(0)
    setVerifyPath([])
    trackRef.current = []
    generatePuzzlePosition()
  }, [generatePuzzlePosition])

  // 开始拖拽
  const handleTouchStart = useCallback((e: any) => {
    if (isVerified || isVerifying) return

    const touch = e.touches[0]
    const startX = touch.clientX

    setIsMoving(true)
    startTimeRef.current = Date.now()
    trackRef.current = [{ startX, currentX: startX }]

    Taro.vibrateShort()
  }, [isVerified, isVerifying])

  // 拖拽移动
  const handleTouchMove = useCallback((e: any) => {
    if (!isMoving || isVerified || isVerifying) return

    const touch = e.touches[0]
    const currentX = touch.clientX
    const startX = trackRef.current[0]?.startX || 0

    const effectiveWidth = width || containerWidth
    const distance = Math.max(0, Math.min(currentX - startX, effectiveWidth - 40))
    setSlideDistance(distance)

    // 记录拖拽轨迹
    trackRef.current.push({
      startX,
      currentX: currentX - startX
    })

    // 记录验证路径（用于后端验证）
    setVerifyPath(prev => [...prev, Math.round(distance)])
  }, [isMoving, isVerified, isVerifying, width, containerWidth])

  // 结束拖拽
  const handleTouchEnd = useCallback(async () => {
    if (!isMoving || isVerified || isVerifying) return

    setIsMoving(false)
    setIsVerifying(true)

    const endTime = Date.now()
    const duration = endTime - startTimeRef.current
    const accuracy = Math.abs(slideDistance - puzzleOffset)

    try {
      // 发送验证请求到后端
      const response = await post('/auth/slider-verify', {
        slideDistance,
        puzzleOffset,
        accuracy,
        duration,
        verifyPath,
        trackData: trackRef.current
      })

      if (response.success && response.data.verified) {
        setIsVerified(true)
        Taro.vibrateShort()
        onSuccess(response.data.token)
      } else {
        // 验证失败，重置滑块
        setTimeout(() => {
          initVerify()
        }, 1000)
        onError?.('验证失败，请重试')
      }
    } catch (error) {
      console.error('滑块验证失败:', error)
      setTimeout(() => {
        initVerify()
      }, 1000)
      onError?.('验证失败，请重试')
    } finally {
      setIsVerifying(false)
    }
  }, [isMoving, isVerified, isVerifying, slideDistance, puzzleOffset, verifyPath, onSuccess, onError, initVerify])

  // 组件挂载时初始化
  useLoad(() => {
    // 获取容器宽度
    if (!width) {
      Taro.nextTick(() => {
        Taro.createSelectorQuery()
          .select('.slider-verify')
          .boundingClientRect()
          .exec((res) => {
            if (res[0] && res[0].width) {
              setContainerWidth(res[0].width)
            }
          })
      })
    }
    initVerify()
  })

  return (
    <View className='slider-verify' style={{ height: `${height}px` }}>
      {/* 验证背景轨道 */}
      <View className='slider-track'>
        <View className='slider-track-bg'>
          {/* 拼图缺口 */}
          <View
            className='puzzle-gap'
            style={{
              left: `${puzzleOffset}px`,
              opacity: isVerified ? 0 : 1
            }}
          />

          {/* 成功状态显示 */}
          {isVerified && (
            <View className='verify-success'>
              <Text className='success-icon'>✓</Text>
              <Text className='success-text'>验证成功</Text>
            </View>
          )}

          {/* 默认提示文字 */}
          {!isVerified && !isVerifying && (
            <Text className='slider-hint'>拖动滑块完成验证</Text>
          )}

          {/* 验证中提示 */}
          {isVerifying && (
            <Text className='slider-hint verifying'>正在验证...</Text>
          )}
        </View>

        {/* 已滑动的进度条 */}
        <View
          className='slider-progress'
          style={{
            width: `${slideDistance}px`,
            background: isVerified ? '#52c41a' : isVerifying ? '#faad14' : '#1890ff'
          }}
        />
      </View>

      {/* 滑块按钮 */}
      <View
        ref={sliderRef}
        className={`slider-button ${isMoving ? 'moving' : ''} ${isVerified ? 'verified' : ''}`}
        style={{
          transform: `translateX(${slideDistance}px)`,
          background: isVerified ? '#52c41a' : isVerifying ? '#faad14' : '#1890ff'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Text className='slider-icon'>
          {isVerified ? '✓' : isVerifying ? '⟳' : '→'}
        </Text>
      </View>

      {/* 重试按钮 */}
      {!isVerified && !isMoving && !isVerifying && (
        <View className='retry-button' onClick={initVerify}>
          <Text className='retry-icon'>⟲</Text>
        </View>
      )}
    </View>
  )
} 