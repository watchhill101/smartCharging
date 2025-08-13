import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Button, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { post } from '../../utils/request';
import { STORAGE_KEYS } from '../../utils/constants';
import './index.scss';

interface FaceLoginProps {
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  autoStart?: boolean;
}

interface CameraStream {
  stop: () => void;
}

const FaceLogin: React.FC<FaceLoginProps> = ({
  onSuccess,
  onError,
  onCancel,
  autoStart = false
}) => {
  // 状态管理
  const [status, setStatus] = useState<'idle' | 'initializing' | 'ready' | 'detecting' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  // 引用
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<CameraStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 清理函数
  const cleanup = useCallback(() => {
    // 停止摄像头流
    if (streamRef.current) {
      streamRef.current.stop();
      streamRef.current = null;
    }

    // 清理定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    // 移除视频元素
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

      // 检查浏览器环境
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        throw new Error('当前环境不支持摄像头功能');
      }

      if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('您的浏览器不支持摄像头功能，请使用现代浏览器');
      }

      // 获取摄像头权限和视频流
      const constraints = {
        video: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          facingMode: 'user', // 前置摄像头
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
      video.style.transform = 'scaleX(-1)'; // 镜像显示

      // 等待视频加载
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('视频加载超时，请检查摄像头连接'));
        }, 15000); // 增加超时时间

        video.onloadeddata = () => {
          clearTimeout(timeout);
          console.log('📹 摄像头初始化成功');
          resolve();
        };

        video.onloadedmetadata = () => {
          console.log(`📏 视频尺寸: ${video.videoWidth}x${video.videoHeight}`);
        };

        video.onerror = (event) => {
          clearTimeout(timeout);
          console.error('视频加载错误:', event);
          reject(new Error('视频加载失败，请检查摄像头设备'));
        };

        // 强制开始播放
        video.play().catch(playError => {
          console.warn('自动播放失败:', playError);
          // 不直接reject，因为有些浏览器需要用户交互才能播放
        });
      });

      // 将video元素添加到容器中
      // 延迟执行，确保DOM已渲染
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

      // 自动开始检测
      if (autoStart) {
        console.log('🚀 autoStart为true，1秒后开始检测');
        setTimeout(() => {
          console.log('⏰ 1秒倒计时结束，调用startFaceDetection');
          startFaceDetection();
        }, 1000);
      } else {
        console.log('⚠️ autoStart为false，不会自动开始检测');
      }

      // 强制状态更新，确保状态同步
      setTimeout(() => {
        console.log('🔄 状态同步检查 - 当前状态:', status);
        console.log('🔄 autoStart值:', autoStart);
      }, 2000);

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

  // 开始人脸检测
  const startFaceDetection = useCallback(async () => {
    console.log('🎭 startFaceDetection被调用，当前状态:', status);

    // 放宽状态检查，允许从多个状态开始检测
    if (status !== 'ready' && status !== 'error' && status !== 'idle') {
      console.log('❌ 状态不正确，无法开始检测。当前状态:', status);
      return;
    }

    try {
      console.log('✅ 状态正确，开始设置检测状态');

      // 立即更新状态
      setStatus('detecting');
      setMessage('正在进行人脸识别...');
      setCountdown(3); // 缩短倒计时到3秒

      console.log('🎭 开始人脸检测倒计时...');

      // 直接开始倒计时，不等待状态更新
      let timeLeft = 3;
      countdownTimerRef.current = setInterval(() => {
        timeLeft--;
        setCountdown(timeLeft);

        if (timeLeft <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          // 倒计时结束，开始连续检测
          console.log('⏰ 倒计时结束，开始连续检测');
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

  // 开始连续检测人脸
  const startContinuousDetection = useCallback(async () => {
    console.log('🔍 开始连续人脸检测...');
    setMessage('正在检测人脸，请保持正对摄像头...');

    // 开始连续检测循环
    intervalRef.current = setInterval(async () => {
      try {
        console.log('🔍 执行单次检测...');
        await detectAndProcessFace();
      } catch (error) {
        console.error('连续检测中的错误:', error);
      }
    }, 500); // 每0.5秒检测一次，更快响应

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
    console.log('🔍 detectAndProcessFace被调用，状态:', status, 'videoRef:', !!videoRef.current);

    if (!videoRef.current) {
      console.log('❌ videoRef不存在，跳过检测');
      return;
    }

    // 临时绕过状态检查，直接进行检测
    console.log('🔄 临时绕过状态检查，直接进行检测');

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

      // 转换为Blob进行检测
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('图像捕获失败'));
          }
        }, 'image/jpeg', 0.8);
      });

      // 发送到后端检测
      const formData = new FormData();
      formData.append('image', blob, 'detection.jpg');

      const apiUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:8080/api/face/detect'
        : '/api/face/detect';

      console.log('🔗 发送检测请求到:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      console.log('📡 检测请求响应状态:', response.status);

      if (!response.ok) {
        console.warn('❌ 人脸检测请求失败:', response.status, response.statusText);
        return;
      }

      const result = await response.json();
      console.log('📄 检测API响应:', result);

      if (result.success && result.data?.faceDetected) {
        console.log('✅ 检测到人脸，置信度:', result.data.confidence, '质量:', result.data.quality);

        // 只要检测到人脸就立即尝试登录，不设置置信度限制
        console.log('🎭 检测到人脸，立即开始登录流程');

        // 停止连续检测
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // 执行登录流程
        await performFaceLogin(blob);
      } else {
        console.log('⏳ 继续检测...', result.data ? `置信度: ${result.data.confidence}` : '未检测到人脸');
      }

    } catch (error) {
      console.warn('检测过程中的错误:', error);
    }
  }, [status]);

  // 执行人脸登录
  const performFaceLogin = useCallback(async (faceBlob: Blob) => {
    try {
      setStatus('processing');
      setMessage('检测到人脸，正在登录...');

      console.log('📸 开始人脸登录，图像大小:', faceBlob.size, 'bytes');

      const formData = new FormData();
      formData.append('image', faceBlob, 'face.jpg');

      const apiUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:8080/api/face/login'
        : '/api/face/login';

      console.log('🚀 发送登录请求到:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      console.log('📡 登录请求响应状态:', response.status);

      const result = await response.json();
      console.log('📄 登录API响应:', result);

      if (!response.ok) {
        // 如果是401错误（未找到匹配），尝试自动注册
        if (response.status === 401 && result.message?.includes('未找到匹配')) {
          console.log('🎭 未找到匹配人脸，尝试注册新人脸');
          await registerAndLogin(faceBlob);
          return;
        }

        console.error('❌ 登录请求失败:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (result.success) {
        console.log('✅ 人脸登录成功:', result.data);

        // 保存登录信息
        try {
          if (result.data.token) {
            Taro.setStorageSync(STORAGE_KEYS.USER_TOKEN, result.data.token);
          }
          if (result.data.refreshToken) {
            Taro.setStorageSync('refresh_token', result.data.refreshToken);
          }
          if (result.data.user) {
            Taro.setStorageSync(STORAGE_KEYS.USER_INFO, result.data.user);
          }
        } catch (storageError) {
          console.warn('存储用户信息失败:', storageError);
        }

        setStatus('success');
        setMessage('登录成功！正在跳转...');

        // 显示成功信息
        try {
          if (typeof Taro !== 'undefined' && Taro.showToast) {
            Taro.showToast({
              title: '登录成功',
              icon: 'success',
              duration: 2000
            });
          } else {
            console.log('✅ 登录成功');
          }
        } catch (toastError) {
          console.warn('显示提示失败:', toastError);
        }

        // 延迟调用成功回调并跳转
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(result.data);
          }
        }, 1000);

      } else {
        // 登录失败，可能需要先注册人脸
        if (result.message?.includes('未找到匹配')) {
          console.log('🎭 未找到匹配人脸，尝试注册新人脸');
          await registerAndLogin(faceBlob);
        } else {
          throw new Error(result.message || '人脸登录失败');
        }
      }

    } catch (error: any) {
      console.error('❌ 人脸登录失败:', error);

      let errorMessage = '人脸登录处理失败';

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = '网络连接失败，请检查网络连接';
      } else if (error.message.includes('HTTP 401')) {
        errorMessage = '人脸识别失败，未找到匹配用户';
      } else if (error.message.includes('HTTP 404')) {
        errorMessage = '服务暂不可用，请稍后重试';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setStatus('error');
      setMessage(errorMessage);
      setRetryCount(prev => prev + 1);

      try {
        if (typeof Taro !== 'undefined' && Taro.showToast) {
          Taro.showToast({
            title: '登录失败',
            icon: 'error',
            duration: 2000
          });
        } else {
          console.log('❌ 登录失败');
        }
      } catch (toastError) {
        console.warn('显示错误提示失败:', toastError);
      }

      if (onError) {
        onError(errorMessage);
      }
    }
  }, [onSuccess, onError]);

  // 注册人脸并登录（自动注册模式）
  const registerAndLogin = useCallback(async (faceBlob: Blob) => {
    try {
      console.log('🆕 开始自动注册人脸档案...');
      setMessage('首次使用，正在创建账户...');

      const formData = new FormData();
      formData.append('image', faceBlob, 'new-face.jpg');

      const apiUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:8080/api/face/auto-register-login'
        : '/api/face/auto-register-login';

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ 自动注册登录成功:', result.data);

        // 保存登录信息
        try {
          if (result.data.token) {
            Taro.setStorageSync(STORAGE_KEYS.USER_TOKEN, result.data.token);
          }
          if (result.data.refreshToken) {
            Taro.setStorageSync('refresh_token', result.data.refreshToken);
          }
          if (result.data.user) {
            Taro.setStorageSync(STORAGE_KEYS.USER_INFO, result.data.user);
          }
        } catch (storageError) {
          console.warn('存储用户信息失败:', storageError);
        }

        setStatus('success');
        setMessage('欢迎新用户！登录成功');

        // 显示欢迎信息
        try {
          if (typeof Taro !== 'undefined' && Taro.showToast) {
            Taro.showToast({
              title: '账户创建成功',
              icon: 'success',
              duration: 3000
            });
          } else {
            console.log('🎉 账户创建成功');
          }
        } catch (toastError) {
          console.warn('显示提示失败:', toastError);
        }

        // 延迟调用成功回调
        setTimeout(() => {
          if (onSuccess) {
            onSuccess({
              ...result.data,
              isNewUser: true
            });
          }
        }, 1500);

      } else {
        throw new Error(result.message || '自动注册失败');
      }

    } catch (error: any) {
      console.error('❌ 自动注册失败:', error);

      let errorMessage = '自动注册失败';

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = '网络连接失败，请检查网络连接';
      } else if (error.message.includes('HTTP 400')) {
        errorMessage = '人脸图像质量不佳，请重新尝试';
      } else if (error.message.includes('HTTP 500')) {
        errorMessage = '服务器错误，请稍后重试';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setStatus('error');
      setMessage(errorMessage);
      setRetryCount(prev => prev + 1);

      try {
        if (typeof Taro !== 'undefined' && Taro.showToast) {
          Taro.showToast({
            title: '注册失败',
            icon: 'error',
            duration: 2000
          });
        } else {
          console.log('❌ 注册失败');
        }
      } catch (toastError) {
        console.warn('显示错误提示失败:', toastError);
      }

      if (onError) {
        onError(errorMessage);
      }
    }
  }, [onSuccess, onError]);



  // 重试
  const handleRetry = useCallback(() => {
    console.log('🔄 用户点击重试，当前状态:', status);

    // 重置状态
    setCountdown(0);
    setCameraError('');

    // 根据重试次数决定策略
    if (retryCount >= 3) {
      // 重试次数过多，重新初始化摄像头
      console.log('🔄 重试次数过多，重新初始化摄像头');
      setRetryCount(0);
      cleanup();
      setTimeout(() => initializeCamera(), 1000);
    } else if (status === 'error') {
      if (cameraError) {
        // 摄像头错误，重新初始化
        console.log('🔄 摄像头错误，重新初始化');
        cleanup();
        setTimeout(() => initializeCamera(), 500);
      } else {
        // 其他错误，重新开始检测
        console.log('🔄 重新开始人脸检测');
        setStatus('ready');
        setMessage('准备重新识别');
        setTimeout(() => startFaceDetection(), 500);
      }
    } else {
      // 直接重新开始检测
      console.log('🔄 直接重新开始检测');
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

    // 组件卸载时清理
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
    <View className='face-login'>
      {/* 头部 */}
      <View className='face-login-header'>
        <Text className='title'>人脸识别登录</Text>
        <Text className='subtitle'>请将面部对准摄像头进行识别</Text>
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
        {retryCount > 0 && (
          <Text className='retry-info'>已重试 {retryCount} 次</Text>
        )}
      </View>

      {/* 操作按钮 */}
      <View className='action-buttons'>
        {status === 'ready' && (
          <Button
            className='btn-primary'
            onClick={startFaceDetection}
          >
            {autoStart ? '重新检测' : '开始检测'}
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

        {status !== 'detecting' && (
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
        <Text className='help-title'>使用提示：</Text>
        <Text className='help-item'>• 系统会自动检测人脸</Text>
        <Text className='help-item'>• 请确保光线充足</Text>
        <Text className='help-item'>• 面部正对摄像头</Text>
        <Text className='help-item'>• 保持距离适中，不要移动</Text>
        <Text className='help-item'>• 检测到人脸后自动登录</Text>
      </View>
    </View>
  );
};

export default FaceLogin; 