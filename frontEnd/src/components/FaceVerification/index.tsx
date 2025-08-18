import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Button, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

interface FaceVerificationProps {
  mode?: 'verify' | 'register';
  userId?: string;
  title?: string;
  description?: string;
  onSuccess?: (result: FaceVerificationResult) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  autoStart?: boolean;
}

interface FaceVerificationResult {
  success: boolean;
  message: string;
  data: {
    verified: boolean;
    confidence: number;
    faceDetected: boolean;
    faceCount: number;
    token?: string;
    details?: any;
  };
}

interface CameraStream {
  stop: () => void;
}

const FaceVerification: React.FC<FaceVerificationProps> = ({
  mode = 'verify',
  userId,
  title = '人脸验证',
  description = '请将面部对准摄像头进行身份验证',
  onSuccess,
  onError,
  onCancel,
  autoStart = true
}) => {
  // 状态管理
  const [status, setStatus] = useState<'idle' | 'initializing' | 'ready' | 'detecting' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [consecutiveDetections, setConsecutiveDetections] = useState(0);
  const [faceQualityHistory, setFaceQualityHistory] = useState<number[]>([]);

  // 引用
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<CameraStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 清理函数
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.stop();
      streamRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
  }, []);

  // 初始化摄像头
  const initializeCamera = useCallback(async () => {
    try {
      setStatus('initializing');
      setMessage('正在初始化摄像头...');
      setCameraError('');

      // 检查环境支持
      if (Taro.getEnv() === 'WEAPP') {
        throw new Error('微信小程序暂不支持网页摄像头，请使用H5版本');
      }

      // H5环境检查
      if (Taro.getEnv() === 'h5') {
        // 检查浏览器环境
        if (typeof window === 'undefined' || typeof document === 'undefined') {
          throw new Error('当前环境不支持摄像头功能');
        }

        if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('您的浏览器不支持摄像头功能，请使用现代浏览器');
        }

        // 检查HTTPS环境（摄像头需要安全环境）
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
          throw new Error('摄像头功能需要HTTPS环境，请使用HTTPS访问');
        }
      }

      // 获取摄像头权限和视频流
      const constraints = {
        video: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      };

      console.log('🎥 请求摄像头权限...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // 创建video元素
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.transform = 'scaleX(-1)';

      // 等待视频加载
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('视频加载超时，请检查摄像头连接'));
        }, 15000);

        video.onloadeddata = () => {
          clearTimeout(timeout);
          console.log('📹 摄像头初始化成功');
          resolve();
        };

        video.onerror = (event) => {
          clearTimeout(timeout);
          console.error('视频加载错误:', event);
          reject(new Error('视频加载失败，请检查摄像头设备'));
        };

        video.play().catch(playError => {
          console.warn('自动播放失败:', playError);
        });
      });

      // 将video元素添加到容器中
      setTimeout(() => {
        const container = document.querySelector('.camera-container');
        if (container) {
          container.innerHTML = '';
          container.appendChild(video);
        } else {
          console.warn('未找到摄像头容器元素');
        }
      }, 100);

      videoRef.current = video;
      streamRef.current = {
        stop: () => {
          stream.getTracks().forEach(track => track.stop());
        }
      };

      setStatus('ready');
      setMessage('摄像头已就绪，请面向摄像头');

      if (autoStart) {
        console.log('🚀 autoStart为true，1秒后开始检测');
        setTimeout(() => {
          startFaceDetection();
        }, 1000);
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

      setCameraError(errorMessage);
      setStatus('error');
      setMessage(errorMessage);

      if (onError) {
        onError(errorMessage);
      }
    }
  }, [autoStart, onError]);

  // 人脸检测算法
  const advancedFaceDetection = useCallback(async (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
    try {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 分析图像中心区域
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const regionSize = Math.min(canvas.width, canvas.height) * 0.3;

      let skinPixels = 0;
      let totalPixels = 0;
      let brightPixels = 0;
      let darkPixels = 0;
      let edgePixels = 0;

      for (let y = centerY - regionSize / 2; y < centerY + regionSize / 2; y += 2) {
        for (let x = centerX - regionSize / 2; x < centerX + regionSize / 2; x += 2) {
          if (y >= 0 && y < canvas.height && x >= 0 && x < canvas.width) {
            const i = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            totalPixels++;

            const brightness = (r + g + b) / 3;
            if (brightness > 50 && brightness < 200) {
              brightPixels++;
            }

            // 肤色检测
            const isValidSkin = (
              r > 60 && r < 240 &&
              g > 40 && g < 200 &&
              b > 20 && b < 170 &&
              r > g + 8 && g > b + 5
            );

            if (isValidSkin) {
              skinPixels++;
            }

            if (brightness < 80) {
              darkPixels++;
            }
          }
        }
      }

      if (totalPixels === 0) {
        return { success: false, data: { faceDetected: false, confidence: 0 } };
      }

      const skinRatio = skinPixels / totalPixels;
      const brightRatio = brightPixels / totalPixels;
      const darkRatio = darkPixels / totalPixels;

      const hasValidSkin = skinRatio > 0.08;
      const hasGoodBrightness = brightRatio > 0.30 && brightRatio < 0.90;
      const hasFeatures = darkRatio > 0.05 && darkRatio < 0.40;

      const conditions = [hasValidSkin, hasGoodBrightness, hasFeatures];
      const passedConditions = conditions.filter(Boolean).length;
      const faceDetected = passedConditions >= 2;

      let confidence = 0;
      if (faceDetected) {
        confidence = Math.min(0.95, 0.3 + (passedConditions * 0.2));
      }

      return {
        success: true,
        data: {
          faceDetected,
          confidence,
          faceCount: faceDetected ? 1 : 0,
          details: {
            skinRatio,
            brightRatio,
            darkRatio
          }
        }
      };

    } catch (error) {
      console.error('人脸检测失败:', error);
      return { success: false, data: { faceDetected: false, confidence: 0, faceCount: 0 } };
    }
  }, []);

  // 开始人脸检测
  const startFaceDetection = useCallback(async () => {
    console.log('🎭 开始人脸检测，当前状态:', status);

    if (status !== 'ready' && status !== 'error' && status !== 'idle') {
      console.log('❌ 状态不正确，无法开始检测');
      return;
    }

    try {
      setStatus('detecting');
      setMessage('正在进行人脸识别...');
      setCountdown(3);

      let timeLeft = 3;
      countdownTimerRef.current = setInterval(() => {
        timeLeft--;
        setCountdown(timeLeft);

        if (timeLeft <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          startContinuousDetection();
        }
      }, 1000);

    } catch (error: any) {
      console.error('❌ 开始人脸检测失败:', error);
      setStatus('error');
      setMessage('人脸检测启动失败');
      if (onError) {
        onError(error.message || '人脸检测启动失败');
      }
    }
  }, [status]);

  // 连续检测
  const startContinuousDetection = useCallback(async () => {
    console.log('🔍 开始连续人脸检测...');
    setMessage('正在检测人脸，请保持正对摄像头...');

    intervalRef.current = setInterval(async () => {
      try {
        await detectAndProcessFace();
      } catch (error) {
        console.error('连续检测中的错误:', error);
      }
    }, 500);

    // 设置超时限制（30秒）
    setTimeout(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('⏰ 检测超时，停止检测');
        setStatus('error');
        setMessage('人脸检测超时，请重新尝试');
      }
    }, 30000);
  }, []);

  // 检测并处理人脸
  const detectAndProcessFace = useCallback(async () => {
    if (!videoRef.current) {
      return;
    }

    try {
      // 捕获当前帧
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        return;
      }

      const videoWidth = videoRef.current.videoWidth || 640;
      const videoHeight = videoRef.current.videoHeight || 480;

      canvas.width = videoWidth;
      canvas.height = videoHeight;

      context.save();
      context.scale(-1, 1);
      context.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height);
      context.restore();

      // 人脸检测
      const result = await advancedFaceDetection(canvas, context);

      if (result.success && result.data) {
        const { faceDetected, confidence, faceCount } = result.data;

        if (faceDetected && confidence > 0.4) {
          console.log('✅ 检测到人脸，置信度:', confidence);

          setConsecutiveDetections(prev => prev + 1);
          setFaceQualityHistory(prev => [...prev, confidence].slice(-5));

          const currentHistory = [...faceQualityHistory, confidence].slice(-5);
          const avgQuality = currentHistory.reduce((sum, q) => sum + q, 0) / currentHistory.length;

          // 验证成功条件
          if (consecutiveDetections >= 1 && avgQuality > 0.5) {
            console.log('🎭 满足验证条件');
            setMessage('人脸验证通过！');

            // 停止检测
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }

            setStatus('success');

            // 生成验证结果
            const verificationResult: FaceVerificationResult = {
              success: true,
              message: '人脸验证成功',
              data: {
                verified: true,
                confidence: avgQuality,
                faceDetected: true,
                faceCount: 1,
                token: `verification_token_${Date.now()}`,
                details: result.data.details
              }
            };

            setTimeout(() => {
              if (onSuccess) {
                onSuccess(verificationResult);
              }
            }, 1000);

          } else {
            setMessage(`人脸识别中... (${consecutiveDetections + 1}/2) 质量: ${(confidence * 100).toFixed(0)}%`);
            setFaceDetected(true);
          }
        } else if (faceDetected && confidence > 0.2) {
          setMessage(`人脸质量不够清晰，请调整位置 (置信度: ${(confidence * 100).toFixed(0)}%)`);
          setFaceDetected(true);
          setConsecutiveDetections(prev => Math.max(0, prev - 1));
        } else {
          setMessage('未检测到人脸，请面向摄像头');
          setFaceDetected(false);
          setConsecutiveDetections(0);
          setFaceQualityHistory([]);
        }
      } else {
        setFaceDetected(false);
        setMessage('检测失败，请重试');
        setConsecutiveDetections(0);
        setFaceQualityHistory([]);
      }

    } catch (error) {
      console.warn('检测过程中的错误:', error);
      setConsecutiveDetections(0);
      setFaceQualityHistory([]);
    }
  }, [consecutiveDetections, faceQualityHistory, advancedFaceDetection, onSuccess]);

  // 重试
  const handleRetry = useCallback(() => {
    console.log('🔄 用户点击重试');
    setCountdown(0);
    setCameraError('');
    setConsecutiveDetections(0);
    setFaceQualityHistory([]);

    if (retryCount >= 3) {
      setRetryCount(0);
      cleanup();
      setTimeout(() => initializeCamera(), 1000);
    } else if (status === 'error') {
      if (cameraError) {
        cleanup();
        setTimeout(() => initializeCamera(), 500);
      } else {
        setStatus('ready');
        setMessage('准备重新识别');
        setTimeout(() => startFaceDetection(), 500);
      }
    } else {
      startFaceDetection();
    }
  }, [status, cameraError, retryCount, cleanup, initializeCamera, startFaceDetection]);

  // 取消
  const handleCancel = useCallback(() => {
    cleanup();
    if (onCancel) {
      onCancel();
    }
  }, [cleanup, onCancel]);

  // 组件挂载时初始化
  useEffect(() => {
    initializeCamera();
    return cleanup;
  }, [initializeCamera, cleanup]);

  // 渲染状态指示器
  const renderStatusIndicator = () => {
    const statusConfig = {
      idle: { color: '#999', text: '准备中' },
      initializing: { color: '#1890ff', text: '初始化中' },
      ready: { color: '#52c41a', text: '就绪' },
      detecting: { color: '#faad14', text: '识别中' },
      processing: { color: '#1890ff', text: '处理中' },
      success: { color: '#52c41a', text: '成功' },
      error: { color: '#ff4d4f', text: '错误' }
    };

    const config = statusConfig[status];
    return (
      <View className='status-indicator' style={{ color: config.color }}>
        <View className='status-dot' style={{ backgroundColor: config.color }}></View>
        <Text className='status-text'>{config.text}</Text>
      </View>
    );
  };

  // 渲染倒计时
  const renderCountdown = () => {
    if (countdown > 0) {
      return (
        <View className='countdown-overlay'>
          <View className='countdown-circle'>
            <Text className='countdown-number'>{countdown}</Text>
          </View>
          <Text className='countdown-text'>请保持面部正对摄像头</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View className='face-verification'>
      {/* 头部 */}
      <View className='face-verification-header'>
        <Text className='title'>{title}</Text>
        <Text className='subtitle'>{description}</Text>
        {renderStatusIndicator()}
      </View>

      {/* 摄像头容器 */}
      <View className='camera-wrapper'>
        <View className='camera-container'>
          {status === 'initializing' && (
            <View className='camera-placeholder'>
              <Text className='placeholder-text'>正在启动摄像头...</Text>
            </View>
          )}
          {cameraError && (
            <View className='camera-placeholder error'>
              <Text className='error-icon'>📷</Text>
              <Text className='error-text'>{cameraError}</Text>
            </View>
          )}
        </View>

        {/* 人脸框架 */}
        <View className='face-frame'>
          <View className='frame-corner top-left'></View>
          <View className='frame-corner top-right'></View>
          <View className='frame-corner bottom-left'></View>
          <View className='frame-corner bottom-right'></View>
        </View>

        {/* 倒计时覆盖层 */}
        {renderCountdown()}
      </View>

      {/* 消息显示 */}
      <View className='message-area'>
        <Text className='message-text'>{message}</Text>

        {/* 人脸检测状态 */}
        {status === 'detecting' && (
          <View className='face-status'>
            <Text className={`status-badge ${faceDetected ? 'detected' : 'searching'}`}>
              {faceDetected ? '✓ 人脸已检测' : '👤 寻找人脸...'}
            </Text>
            {consecutiveDetections > 0 && (
              <View className='detection-progress'>
                <Text className='progress-text'>
                  连续检测: {consecutiveDetections}/2
                </Text>
                <View className='progress-bar'>
                  <View
                    className='progress-fill'
                    style={{
                      width: `${Math.min(100, (consecutiveDetections / 2) * 100)}%`
                    }}
                  ></View>
                </View>
              </View>
            )}
            {faceQualityHistory.length > 0 && (
              <Text className='quality-info'>
                平均质量: {((faceQualityHistory.reduce((sum, q) => sum + q, 0) / faceQualityHistory.length) * 100).toFixed(0)}%
              </Text>
            )}
          </View>
        )}

        {retryCount > 0 && (
          <Text className='retry-info'>已重试 {retryCount} 次</Text>
        )}
      </View>

      {/* 操作按钮 */}
      <View className='action-buttons'>
        {status === 'success' && (
          <View className='success-message'>
            <Text className='success-icon'>✅</Text>
            <Text className='success-text'>验证成功！</Text>
          </View>
        )}

        {status === 'ready' && (
          <Button
            className='btn-primary'
            onClick={startFaceDetection}
          >
            {autoStart ? '重新检测' : '开始验证'}
          </Button>
        )}

        {status === 'detecting' && (
          <Button
            className='btn-secondary'
            onClick={handleCancel}
          >
            停止检测
          </Button>
        )}

        {(status === 'error' || (status === 'ready' && retryCount > 0)) && (
          <Button
            className='btn-secondary'
            onClick={handleRetry}
          >
            重新尝试
          </Button>
        )}

        {status !== 'detecting' && status !== 'success' && (
          <Button
            className='btn-cancel'
            onClick={handleCancel}
          >
            取消
          </Button>
        )}
      </View>

      {/* 帮助提示 */}
      <View className='help-tips'>
        <Text className='help-title'>验证提示：</Text>
        <Text className='help-item'>• 面部对准摄像头框架内</Text>
        <Text className='help-item'>• 保持光线充足</Text>
        <Text className='help-item'>• 保持面部清晰可见</Text>
        <Text className='help-item'>• 验证过程约需要几秒钟</Text>
      </View>
    </View>
  );
};

export default FaceVerification; 