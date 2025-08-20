import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { post } from '../../utils/request';
import { tokenManager } from '../../utils/tokenManager';
import { STORAGE_KEYS } from '../../utils/constants';
import './FaceLoginOptimized.scss';

interface FaceLoginOptimizedProps {
  phone: string;
  onSuccess: (result: FaceLoginResult) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  autoStart?: boolean;
}

interface FaceLoginResult {
  success: boolean;
  confidence: number;
  token: string;
  user: any;
  message: string;
}

interface CameraState {
  status: 'initializing' | 'ready' | 'detecting' | 'processing' | 'success' | 'error';
  message: string;
  progress: number;
  countdown: number;
}

const FaceLoginOptimized: React.FC<FaceLoginOptimizedProps> = ({
  phone,
  onSuccess,
  onError,
  onCancel,
  autoStart = false
}) => {
  // 状态管理
  const [cameraState, setCameraState] = useState<CameraState>({
    status: 'initializing',
    message: '正在初始化摄像头...',
    progress: 0,
    countdown: 0
  });

  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionQuality, setDetectionQuality] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  // 引用
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 清理资源
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // 初始化摄像头
  const initializeCamera = useCallback(async () => {
    try {
      setCameraState(prev => ({ ...prev, status: 'initializing', message: '正在启动摄像头...' }));

      // 环境检查
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        throw new Error('当前环境不支持摄像头功能');
      }

      // 权限检查
      const constraints = {
        video: {
          width: { ideal: 640, min: 320, max: 1280 },
          height: { ideal: 480, min: 240, max: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 15, max: 60 }
        },
        audio: false
      };

      console.log('🎥 请求摄像头权限...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // 创建video元素
      if (!videoRef.current) {
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.transform = 'scaleX(-1)'; // 镜像翻转
        videoRef.current = video;
      }

      videoRef.current.srcObject = stream;
      streamRef.current = stream;

      // 等待视频加载
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('视频加载超时'));
        }, 10000);

        if (videoRef.current) {
          videoRef.current.onloadeddata = () => {
            clearTimeout(timeout);
            console.log('📹 摄像头初始化成功');
            resolve();
          };

          videoRef.current.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('视频加载失败'));
          };
        }
      });

      // 添加video到DOM
      setTimeout(() => {
        const container = document.querySelector('.camera-preview-container');
        if (container && videoRef.current) {
          container.innerHTML = '';
          container.appendChild(videoRef.current);
        }
      }, 100);

      setCameraState(prev => ({ 
        ...prev, 
        status: 'ready', 
        message: '摄像头已就绪，请面向摄像头' 
      }));

      if (autoStart) {
        setTimeout(() => startFaceDetection(), 1000);
      }

    } catch (error: any) {
      console.error('❌ 摄像头初始化失败:', error);
      
      let errorMessage = '摄像头初始化失败';
      if (error.name === 'NotAllowedError') {
        errorMessage = '请允许访问摄像头权限';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '未找到摄像头设备';
      } else if (error.name === 'NotReadableError') {
        errorMessage = '摄像头被其他应用占用';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setCameraState(prev => ({ 
        ...prev, 
        status: 'error', 
        message: errorMessage 
      }));
    }
  }, [autoStart]);

  // 开始人脸检测
  const startFaceDetection = useCallback(() => {
    if (cameraState.status !== 'ready') {
      return;
    }

    console.log('🎭 开始人脸检测...');
    setCameraState(prev => ({ 
      ...prev, 
      status: 'detecting', 
      message: '请保持面部正对摄像头...',
      countdown: 3
    }));

    // 倒计时
    let countdown = 3;
    countdownTimerRef.current = setInterval(() => {
      countdown--;
      setCameraState(prev => ({ ...prev, countdown }));
      
      if (countdown <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        startContinuousDetection();
      }
    }, 1000);
  }, [cameraState.status]);

  // 连续检测
  const startContinuousDetection = useCallback(() => {
    setCameraState(prev => ({ 
      ...prev, 
      message: '正在检测人脸，请保持不动...' 
    }));

    let detectionCount = 0;
    const maxDetections = 10;
    const qualityThreshold = 0.7;
    let bestCapture: { blob: Blob; quality: number } | null = null;

    detectionIntervalRef.current = setInterval(async () => {
      try {
        const captureResult = await captureFrame();
        if (captureResult) {
          detectionCount++;
          const progress = (detectionCount / maxDetections) * 100;
          
          setCameraState(prev => ({ ...prev, progress }));
          setFaceDetected(true);
          setDetectionQuality(captureResult.quality);

          // 保存最佳捕获
          if (!bestCapture || captureResult.quality > bestCapture.quality) {
            bestCapture = captureResult;
          }

          // 检测完成
          if (detectionCount >= maxDetections) {
            if (detectionIntervalRef.current) {
              clearInterval(detectionIntervalRef.current);
              detectionIntervalRef.current = null;
            }

            if (bestCapture && bestCapture.quality >= qualityThreshold) {
              await performFaceLogin(bestCapture.blob);
            } else {
              setCameraState(prev => ({ 
                ...prev, 
                status: 'error', 
                message: '人脸质量不够清晰，请重试' 
              }));
            }
          }
        } else {
          setFaceDetected(false);
          setDetectionQuality(0);
        }
      } catch (error) {
        console.error('检测过程出错:', error);
      }
    }, 300);

    // 超时保护
    setTimeout(() => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
        setCameraState(prev => ({ 
          ...prev, 
          status: 'error', 
          message: '检测超时，请重试' 
        }));
      }
    }, 30000);
  }, []);

  // 捕获帧
  const captureFrame = useCallback(async (): Promise<{ blob: Blob; quality: number } | null> => {
    if (!videoRef.current || !canvasRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.videoWidth === 0) {
      return null;
    }

    // 设置canvas尺寸
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 绘制视频帧
    context.save();
    context.scale(-1, 1);
    context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    context.restore();

    // 简单的质量评估（基于图像数据）
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const quality = assessImageQuality(imageData);

    // 转换为blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve({ blob, quality });
        } else {
          resolve(null);
        }
      }, 'image/jpeg', 0.8);
    });
  }, []);

  // 简单的图像质量评估
  const assessImageQuality = (imageData: ImageData): number => {
    const data = imageData.data;
    let brightness = 0;
    let variance = 0;
    
    // 计算亮度
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      brightness += (r + g + b) / 3;
    }
    brightness /= (data.length / 4);

    // 计算方差（清晰度指标）
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const pixelBrightness = (r + g + b) / 3;
      variance += Math.pow(pixelBrightness - brightness, 2);
    }
    variance /= (data.length / 4);

    // 综合评分
    const brightnessScore = brightness > 50 && brightness < 200 ? 1 : 0.5;
    const sharpnessScore = Math.min(variance / 1000, 1);
    
    return (brightnessScore + sharpnessScore) / 2;
  };

  // 执行人脸登录
  const performFaceLogin = useCallback(async (imageBlob: Blob) => {
    try {
      setCameraState(prev => ({ 
        ...prev, 
        status: 'processing', 
        message: '正在验证身份...',
        progress: 0
      }));

      // 准备FormData
      const formData = new FormData();
      formData.append('faceImage', imageBlob, 'face.jpg');
      formData.append('phone', phone);

      console.log('📤 发送人脸登录请求...');

      // 调用人脸登录API
      const response = await post('/face/login', formData);

      if (response.success && response.data) {
        setCameraState(prev => ({ 
          ...prev, 
          status: 'success', 
          message: '人脸识别成功！',
          progress: 100
        }));

        // 保存登录信息
        try {
          tokenManager.saveTokens({
            token: response.data.token,
            refreshToken: response.data.refreshToken || '',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000
          });

          Taro.setStorageSync(STORAGE_KEYS.USER_INFO, response.data.user);
          console.log('✅ 登录信息已保存');
        } catch (storageError) {
          console.error('❌ 保存登录信息失败:', storageError);
        }

        // 延迟调用成功回调
        setTimeout(() => {
          onSuccess({
            success: true,
            confidence: 0.9,
            token: response.data.token,
            user: response.data.user,
            message: '人脸识别登录成功'
          });
        }, 1000);

      } else {
        throw new Error(response.message || '人脸登录失败');
      }

    } catch (error: any) {
      console.error('❌ 人脸登录失败:', error);
      setCameraState(prev => ({ 
        ...prev, 
        status: 'error', 
        message: error.message || '人脸识别失败，请重试' 
      }));
      
      setTimeout(() => {
        onError(error.message || '人脸识别失败，请重试或使用验证码登录');
      }, 1000);
    }
  }, [phone, onSuccess, onError]);

  // 重试
  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setFaceDetected(false);
    setDetectionQuality(0);
    
    if (retryCount >= 2) {
      // 重试次数过多，重新初始化摄像头
      cleanup();
      setTimeout(() => initializeCamera(), 1000);
      setRetryCount(0);
    } else {
      setCameraState(prev => ({ 
        ...prev, 
        status: 'ready', 
        message: '准备重新识别',
        progress: 0
      }));
      setTimeout(() => startFaceDetection(), 500);
    }
  }, [retryCount, cleanup, initializeCamera, startFaceDetection]);

  // 组件挂载时初始化
  useEffect(() => {
    initializeCamera();
    return cleanup;
  }, [initializeCamera, cleanup]);

  // 渲染状态指示器
  const renderStatusIndicator = () => {
    const statusConfig = {
      initializing: { color: '#1890ff', icon: '🔄', text: '初始化中' },
      ready: { color: '#52c41a', icon: '📹', text: '就绪' },
      detecting: { color: '#faad14', icon: '🎯', text: '检测中' },
      processing: { color: '#1890ff', icon: '⚡', text: '处理中' },
      success: { color: '#52c41a', icon: '✅', text: '成功' },
      error: { color: '#ff4d4f', icon: '❌', text: '错误' }
    };

    const config = statusConfig[cameraState.status];
    return (
      <View className='status-indicator'>
        <Text className='status-icon'>{config.icon}</Text>
        <Text className='status-text' style={{ color: config.color }}>
          {config.text}
        </Text>
      </View>
    );
  };

  return (
    <View className='face-login-optimized'>
      {/* 背景遮罩 */}
      <View className='overlay' />
      
      {/* 主容器 */}
      <View className='container'>
        {/* 头部 */}
        <View className='header'>
          <Text className='title'>人脸识别登录</Text>
          <Text className='subtitle'>请将面部对准摄像头进行身份验证</Text>
          {renderStatusIndicator()}
        </View>

        {/* 摄像头预览区域 */}
        <View className='camera-section'>
          <View className='camera-preview-container'>
            {cameraState.status === 'initializing' && (
              <View className='camera-placeholder'>
                <Text className='placeholder-icon'>📷</Text>
                <Text className='placeholder-text'>正在启动摄像头...</Text>
              </View>
            )}
            {cameraState.status === 'error' && (
              <View className='camera-placeholder error'>
                <Text className='error-icon'>⚠️</Text>
                <Text className='error-text'>{cameraState.message}</Text>
              </View>
            )}
          </View>

          {/* 人脸框架 */}
          <View className='face-frame'>
            <View className='frame-corner top-left' />
            <View className='frame-corner top-right' />
            <View className='frame-corner bottom-left' />
            <View className='frame-corner bottom-right' />
            
            {/* 扫描动画 */}
            {cameraState.status === 'detecting' && (
              <View className='scan-animation' />
            )}
          </View>

          {/* 倒计时覆盖层 */}
          {cameraState.countdown > 0 && (
            <View className='countdown-overlay'>
              <View className='countdown-circle'>
                <Text className='countdown-number'>{cameraState.countdown}</Text>
              </View>
              <Text className='countdown-text'>请保持面部正对摄像头</Text>
            </View>
          )}
        </View>

        {/* 进度条 */}
        {(cameraState.status === 'detecting' || cameraState.status === 'processing') && (
          <View className='progress-section'>
            <View className='progress-bar'>
              <View 
                className='progress-fill' 
                style={{ width: `${cameraState.progress}%` }}
              />
            </View>
            <Text className='progress-text'>{Math.round(cameraState.progress)}%</Text>
          </View>
        )}

        {/* 状态信息 */}
        <View className='status-section'>
          <Text className='status-message'>{cameraState.message}</Text>
          
          {/* 人脸检测状态 */}
          {cameraState.status === 'detecting' && (
            <View className='detection-status'>
              <View className={`face-indicator ${faceDetected ? 'detected' : 'searching'}`}>
                <Text className='indicator-text'>
                  {faceDetected ? '✓ 人脸已检测' : '👤 寻找人脸...'}
                </Text>
              </View>
              {detectionQuality > 0 && (
                <Text className='quality-info'>
                  图像质量: {(detectionQuality * 100).toFixed(0)}%
                </Text>
              )}
            </View>
          )}

          {retryCount > 0 && (
            <Text className='retry-info'>已重试 {retryCount} 次</Text>
          )}
        </View>

        {/* 操作按钮 */}
        <View className='actions'>
          {cameraState.status === 'success' && (
            <View className='success-message'>
              <Text className='success-icon'>🎉</Text>
              <Text className='success-text'>识别成功！正在跳转...</Text>
            </View>
          )}

          {cameraState.status === 'ready' && (
            <Button className='btn-primary' onClick={startFaceDetection}>
              开始识别
            </Button>
          )}

          {(cameraState.status === 'error') && (
            <Button className='btn-secondary' onClick={handleRetry}>
              重新尝试
            </Button>
          )}

          {cameraState.status !== 'detecting' && cameraState.status !== 'processing' && (
            <Button className='btn-cancel' onClick={onCancel}>
              取消
            </Button>
          )}
        </View>

        {/* 帮助提示 */}
        <View className='help-tips'>
          <Text className='tips-title'>识别提示：</Text>
          <View className='tips-list'>
            <Text className='tip-item'>• 面部完整出现在框架内</Text>
            <Text className='tip-item'>• 保持光线充足</Text>
            <Text className='tip-item'>• 摘下眼镜和口罩</Text>
            <Text className='tip-item'>• 识别过程请保持不动</Text>
          </View>
        </View>
      </View>

      {/* 隐藏的canvas用于图像处理 */}
      <canvas 
        ref={canvasRef}
        style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}
      />
    </View>
  );
};

export default FaceLoginOptimized;
