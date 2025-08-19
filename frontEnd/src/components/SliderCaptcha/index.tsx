import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Canvas, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button as NutButton, Toast } from '@nutui/nutui-react-taro';
import './index.scss';

export interface SliderCaptchaProps {
  // 验证配置
  width?: number;
  height?: number;
  sliderSize?: number;
  tolerance?: number;
  
  // 图片配置
  backgroundImage?: string;
  refreshOnFail?: boolean;
  
  // 回调函数
  onSuccess?: (token: string) => void;
  onFail?: (error: string) => void;
  onRefresh?: () => void;
  
  // 显示配置
  visible?: boolean;
  loading?: boolean;
  disabled?: boolean;
  
  // 文案配置
  text?: {
    loading: string;
    slide: string;
    success: string;
    fail: string;
    refresh: string;
  };
  
  className?: string;
}

interface CaptchaState {
  // 验证状态
  status: 'idle' | 'dragging' | 'verifying' | 'success' | 'fail';
  
  // 位置信息
  sliderX: number;
  puzzleX: number;
  puzzleY: number;
  
  // 拖拽信息
  startX: number;
  currentX: number;
  
  // 验证数据
  token: string;
  trail: Array<{ x: number; y: number; t: number }>;
  
  // 图片信息
  backgroundImageUrl: string;
  puzzleImageUrl: string;
}

const SliderCaptcha: React.FC<SliderCaptchaProps> = ({
  width = 300,
  height = 150,
  sliderSize = 42,
  tolerance = 5,
  backgroundImage,
  refreshOnFail = true,
  onSuccess,
  onFail,
  onRefresh,
  visible = true,
  loading = false,
  disabled = false,
  text = {
    loading: '加载中...',
    slide: '向右滑动完成验证',
    success: '验证成功',
    fail: '验证失败，请重试',
    refresh: '刷新'
  },
  className = ''
}) => {
  const [state, setState] = useState<CaptchaState>({
    status: 'idle',
    sliderX: 0,
    puzzleX: 0,
    puzzleY: 0,
    startX: 0,
    currentX: 0,
    token: '',
    trail: [],
    backgroundImageUrl: '',
    puzzleImageUrl: ''
  });

  const canvasRef = useRef<any>(null);
  const puzzleCanvasRef = useRef<any>(null);
  const sliderRef = useRef<any>(null);
  const containerRef = useRef<any>(null);

  // 生成随机拼图位置
  const generatePuzzlePosition = useCallback(() => {
    const minX = sliderSize + 10;
    const maxX = width - sliderSize - 10;
    const minY = 10;
    const maxY = height - sliderSize - 10;
    
    return {
      x: Math.random() * (maxX - minX) + minX,
      y: Math.random() * (maxY - minY) + minY
    };
  }, [width, height, sliderSize]);

  // 初始化验证码
  const initCaptcha = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'idle' }));
    
    try {
      // 生成拼图位置
      const position = generatePuzzlePosition();
      
      // 这里应该调用后端API获取验证码图片和token
      // const response = await captchaService.generateCaptcha({
      //   width,
      //   height,
      //   puzzleX: position.x,
      //   puzzleY: position.y
      // });
      
      // 模拟API响应
      const mockResponse = {
        token: `captcha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        backgroundImage: backgroundImage || 'https://picsum.photos/300/150',
        puzzleImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        puzzleX: position.x,
        puzzleY: position.y
      };
      
      setState(prev => ({
        ...prev,
        token: mockResponse.token,
        backgroundImageUrl: mockResponse.backgroundImage,
        puzzleImageUrl: mockResponse.puzzleImage,
        puzzleX: mockResponse.puzzleX,
        puzzleY: mockResponse.puzzleY,
        sliderX: 0,
        trail: []
      }));
      
    } catch (error) {
      console.error('❌ 初始化验证码失败:', error);
      onFail?.('初始化失败，请重试');
    }
  }, [width, height, backgroundImage, generatePuzzlePosition, onFail]);

  // 组件初始化
  useEffect(() => {
    if (visible && !loading) {
      initCaptcha();
    }
  }, [visible, loading, initCaptcha]);

  // 开始拖拽
  const handleTouchStart = useCallback((event: any) => {
    if (disabled || state.status !== 'idle') return;
    
    const touch = event.touches[0];
    const startX = touch.clientX;
    
    setState(prev => ({
      ...prev,
      status: 'dragging',
      startX,
      currentX: startX,
      trail: [{ x: startX, y: touch.clientY, t: Date.now() }]
    }));
  }, [disabled, state.status]);

  // 拖拽中
  const handleTouchMove = useCallback((event: any) => {
    if (state.status !== 'dragging') return;
    
    const touch = event.touches[0];
    const currentX = touch.clientX;
    const deltaX = currentX - state.startX;
    const maxX = width - sliderSize;
    
    // 限制滑块移动范围
    const newSliderX = Math.max(0, Math.min(deltaX, maxX));
    
    setState(prev => ({
      ...prev,
      currentX,
      sliderX: newSliderX,
      trail: [...prev.trail, { x: currentX, y: touch.clientY, t: Date.now() }]
    }));
  }, [state.status, state.startX, width, sliderSize]);

  // 结束拖拽
  const handleTouchEnd = useCallback(async () => {
    if (state.status !== 'dragging') return;
    
    setState(prev => ({ ...prev, status: 'verifying' }));
    
    try {
      // 计算验证结果
      const deltaX = state.sliderX;
      const expectedX = state.puzzleX - sliderSize / 2;
      const isValid = Math.abs(deltaX - expectedX) <= tolerance;
      
      // 这里应该调用后端API验证
      // const response = await captchaService.verifyCaptcha({
      //   token: state.token,
      //   x: deltaX,
      //   trail: state.trail
      // });
      
      // 模拟验证延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (isValid) {
        setState(prev => ({ ...prev, status: 'success' }));
        onSuccess?.(state.token);
        
        Toast.show({
          content: text.success,
          type: 'success',
          duration: 1500
        });
      } else {
        setState(prev => ({ ...prev, status: 'fail' }));
        onFail?.('验证失败');
        
        Toast.show({
          content: text.fail,
          type: 'error',
          duration: 2000
        });
        
        // 自动刷新
        if (refreshOnFail) {
          setTimeout(() => {
            initCaptcha();
          }, 1000);
        }
      }
    } catch (error) {
      console.error('❌ 验证失败:', error);
      setState(prev => ({ ...prev, status: 'fail' }));
      onFail?.('验证异常，请重试');
    }
  }, [
    state.status,
    state.sliderX,
    state.puzzleX,
    state.token,
    state.trail,
    sliderSize,
    tolerance,
    onSuccess,
    onFail,
    text.success,
    text.fail,
    refreshOnFail,
    initCaptcha
  ]);

  // 刷新验证码
  const handleRefresh = useCallback(() => {
    onRefresh?.();
    initCaptcha();
  }, [onRefresh, initCaptcha]);

  // 获取状态文案
  const getStatusText = useCallback(() => {
    switch (state.status) {
      case 'idle':
        return text.slide;
      case 'dragging':
        return text.slide;
      case 'verifying':
        return text.loading;
      case 'success':
        return text.success;
      case 'fail':
        return text.fail;
      default:
        return text.slide;
    }
  }, [state.status, text]);

  // 获取滑块样式
  const getSliderStyle = useCallback(() => {
    const baseStyle = {
      transform: `translateX(${state.sliderX}px)`,
      transition: state.status === 'dragging' ? 'none' : 'transform 0.3s ease'
    };
    
    if (state.status === 'success') {
      return { ...baseStyle, backgroundColor: '#52c41a' };
    } else if (state.status === 'fail') {
      return { ...baseStyle, backgroundColor: '#ff4d4f' };
    }
    
    return baseStyle;
  }, [state.sliderX, state.status]);

  // 获取轨道样式
  const getTrackStyle = useCallback(() => {
    const baseStyle = {
      width: `${state.sliderX + sliderSize}px`
    };
    
    if (state.status === 'success') {
      return { ...baseStyle, backgroundColor: '#52c41a' };
    } else if (state.status === 'fail') {
      return { ...baseStyle, backgroundColor: '#ff4d4f' };
    }
    
    return baseStyle;
  }, [state.sliderX, sliderSize, state.status]);

  if (!visible) return null;

  return (
    <View className={`slider-captcha ${className}`}>
      {/* 验证码图片区域 */}
      <View className="captcha-image-container">
        {loading ? (
          <View className="loading-placeholder">
            <Text className="loading-text">{text.loading}</Text>
          </View>
        ) : (
          <>
            {/* 背景图片 */}
            <Image
              src={state.backgroundImageUrl}
              mode="aspectFill"
              className="background-image"
              style={{ width: `${width}px`, height: `${height}px` }}
            />
            
            {/* 拼图缺口 */}
            <View
              className="puzzle-hole"
              style={{
                left: `${state.puzzleX - sliderSize / 2}px`,
                top: `${state.puzzleY - sliderSize / 2}px`,
                width: `${sliderSize}px`,
                height: `${sliderSize}px`
              }}
            />
            
            {/* 拼图块 */}
            <View
              className="puzzle-piece"
              style={{
                left: `${state.sliderX}px`,
                top: `${state.puzzleY - sliderSize / 2}px`,
                width: `${sliderSize}px`,
                height: `${sliderSize}px`,
                backgroundImage: `url(${state.puzzleImageUrl})`
              }}
            />
            
            {/* 刷新按钮 */}
            <View className="refresh-btn" onClick={handleRefresh}>
              <Text className="refresh-icon">🔄</Text>
            </View>
          </>
        )}
      </View>

      {/* 滑块控制区域 */}
      <View className="slider-container" ref={containerRef}>
        <View className="slider-track">
          {/* 滑动轨道 */}
          <View className="track-bg">
            <View className="track-fill" style={getTrackStyle()} />
          </View>
          
          {/* 提示文字 */}
          <Text className={`slider-text ${state.status}`}>
            {getStatusText()}
          </Text>
          
          {/* 滑块 */}
          <View
            ref={sliderRef}
            className={`slider-button ${state.status}`}
            style={getSliderStyle()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <View className="slider-icon">
              {state.status === 'success' ? '✓' : 
               state.status === 'fail' ? '✗' : 
               state.status === 'verifying' ? '⟳' : '→'}
            </View>
          </View>
        </View>
      </View>

      {/* 调试信息（开发环境） */}
      {process.env.NODE_ENV === 'development' && (
        <View className="debug-info">
          <Text className="debug-text">
            状态: {state.status} | 
            滑块位置: {state.sliderX.toFixed(0)} | 
            目标位置: {(state.puzzleX - sliderSize / 2).toFixed(0)} | 
            误差: {Math.abs(state.sliderX - (state.puzzleX - sliderSize / 2)).toFixed(0)}
          </Text>
        </View>
      )}
    </View>
  );
};

export default SliderCaptcha;