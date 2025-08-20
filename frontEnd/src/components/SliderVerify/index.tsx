import { View, Text } from '@tarojs/components'
import { useState, useRef, useCallback } from 'react'
import { useLoad } from '@tarojs/taro'
import { vibrateShort as taroVibrateShort, createSelectorQuery } from '@tarojs/taro'
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
  width = 248,
  height = 42
}: SliderVerifyProps) {
  const [isMoving, setIsMoving] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [slideDistance, setSlideDistance] = useState(0)
  const [puzzleOffset, setPuzzleOffset] = useState(0)
  const [verifyPath, setVerifyPath] = useState<number[]>([])

  const sliderRef = useRef<any>(null)
  const containerRef = useRef<any>(null)
  const startTimeRef = useRef<number>(0)
  const trackRef = useRef<TouchPosition[]>([])
  const containerRectRef = useRef<any>(null)

  // 获取容器位置信息
  const getContainerRect = useCallback(() => {
    return new Promise((resolve) => {
      const query = createSelectorQuery()
      query.select('.slider-verify').boundingClientRect((rect) => {
        containerRectRef.current = rect
        resolve(rect)
      }).exec()
    })
  }, [])

  const [sessionId, setSessionId] = useState<string | null>(null)

  // 生成滑块挑战
  const generateSliderChallenge = useCallback(async () => {
    try {
      console.log('🎲 请求滑块挑战...')
      const response = await post('/auth/slider-challenge', { width })
      
      if (response.success && response.data) {
        setPuzzleOffset(response.data.puzzleOffset)
        setSessionId(response.data.sessionId)
        console.log(`🎯 获取滑块挑战: offset=${response.data.puzzleOffset.toFixed(1)}px, sessionId=${response.data.sessionId}`)
        return response.data.puzzleOffset
      } else {
        // 回退到本地生成
        return generatePuzzlePositionLocal()
      }
    } catch (error) {
      console.warn('⚠️ 滑块挑战请求失败，使用本地生成:', error)
      return generatePuzzlePositionLocal()
    }
  }, [width])

  // 本地生成随机拼图位置（回退方案）
  const generatePuzzlePositionLocal = useCallback(() => {
    const effectiveWidth = width - 40 // 减去滑块宽度
    const minOffset = effectiveWidth * 0.3 // 30%位置开始
    const maxOffset = effectiveWidth * 0.8 // 80%位置结束
    const offset = Math.random() * (maxOffset - minOffset) + minOffset
    setPuzzleOffset(offset)
    setSessionId(null) // 本地生成时清空sessionId
    console.log(`🎯 本地生成拼图位置: ${offset.toFixed(1)}px, 有效宽度: ${effectiveWidth}px`)
    return offset
  }, [width])

  // 初始化验证
  const initVerify = useCallback(async () => {
    setIsVerified(false)
    setIsVerifying(false)
    setSlideDistance(0)
    setVerifyPath([])
    trackRef.current = []
    await generateSliderChallenge()
    // 获取容器位置信息
    await getContainerRect()
  }, [generateSliderChallenge, getContainerRect])

  // 开始拖拽
  const handleTouchStart = useCallback(async (e: any) => {
    if (isVerified || isVerifying) return

    // 确保有容器位置信息
    if (!containerRectRef.current) {
      await getContainerRect()
    }

    const touch = e.touches[0]
    const containerRect = containerRectRef.current

    // 计算相对于容器的X坐标
    const startX = containerRect ? touch.clientX - containerRect.left : touch.clientX

    setIsMoving(true)
    startTimeRef.current = Date.now()
    trackRef.current = [{ startX, currentX: startX }]

    console.log('🎯 开始拖拽:', {
      clientX: touch.clientX,
      containerLeft: containerRect?.left || 0,
      startX
    })

    // 添加震动反馈
    try {
      taroVibrateShort()
    } catch (error) {
      console.log('震动反馈不可用:', error)
    }
  }, [isVerified, isVerifying, getContainerRect])

  // 拖拽移动
  const handleTouchMove = useCallback((e: any) => {
    if (!isMoving || isVerified || isVerifying) return

    const touch = e.touches[0]
    const containerRect = containerRectRef.current
    const startX = trackRef.current[0]?.startX || 0

    // 计算相对于容器的X坐标
    const currentX = containerRect ? touch.clientX - containerRect.left : touch.clientX

    const effectiveWidth = width - 40 // 减去滑块宽度
    const distance = Math.max(0, Math.min(currentX - startX, effectiveWidth))
    setSlideDistance(distance)

    // 记录拖拽轨迹
    trackRef.current.push({
      startX,
      currentX: distance
    })

    // 记录验证路径（用于后端验证）
    setVerifyPath(prev => [...prev, Math.round(distance)])

    console.log('🎯 拖拽移动:', {
      clientX: touch.clientX,
      currentX,
      distance: distance.toFixed(1)
    })
  }, [isMoving, isVerified, isVerifying, width])

  // 结束拖拽
  const handleTouchEnd = useCallback(async () => {
    if (!isMoving || isVerified || isVerifying) return

    setIsMoving(false)
    setIsVerifying(true)

    const endTime = Date.now()
    const duration = endTime - startTimeRef.current
    const accuracy = Math.abs(slideDistance - puzzleOffset)

    console.log(`🎯 滑块验证数据:`, {
      slideDistance: slideDistance.toFixed(1),
      puzzleOffset: puzzleOffset.toFixed(1),
      accuracy: accuracy.toFixed(1),
      duration,
      pathLength: verifyPath.length
    })

    try {
      // 发送验证请求到后端
      const response = await post('/auth/slider-verify', {
        slideDistance,
        puzzleOffset,
        accuracy,
        duration,
        verifyPath,
        trackData: trackRef.current,
        sessionId // 包含会话ID
      })

      console.log('🔍 滑块验证响应:', response)

      if (response.success && response.data.verified) {
        console.log('✅ 滑块验证成功!')
        setIsVerified(true)
        try {
          taroVibrateShort()
        } catch (error) {
          console.log('震动反馈不可用:', error)
        }
        onSuccess(response.data.token)
      } else {
        console.log('❌ 滑块验证失败:', response.data?.reason || '未知原因')
        // 验证失败，重置滑块
        setTimeout(() => {
          initVerify()
        }, 1000)
        onError?.(`验证失败: ${response.data?.reason || '请重试'}`)
      }
    } catch (error) {
      console.error('滑块验证请求失败:', error)
      setTimeout(() => {
        initVerify()
      }, 1000)
      onError?.('网络请求失败，请重试')
    } finally {
      setIsVerifying(false)
    }
  }, [isMoving, isVerified, isVerifying, slideDistance, puzzleOffset, verifyPath, onSuccess, onError, initVerify])

  // 组件挂载时初始化
  useLoad(() => {
    initVerify()
  })

  return (
    <View
      ref={containerRef}
      className='slider-verify'
      style={{ height: `${height}px` }}
    >
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