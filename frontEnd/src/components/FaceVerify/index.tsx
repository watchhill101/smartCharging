import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Button, Image } from '@tarojs/components';
import { Camera, CameraType } from '@tarojs/taro';
import { showToast, showModal, chooseImage } from '@tarojs/taro';
import { Cell, Button as NutButton, Progress, Overlay, Popup } from '@nutui/nutui-react-taro';
import './index.scss';

export interface FaceVerifyProps {
  mode: 'register' | 'login' | 'verify';
  onSuccess?: (result: FaceVerifyResult) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  visible?: boolean;
  title?: string;
  description?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface FaceVerifyResult {
  success: boolean;
  faceId?: string;
  confidence?: number;
  livenessScore?: number;
  imageData?: string;
  features?: any;
}

interface DetectionState {
  step: 'prepare' | 'detecting' | 'processing' | 'success' | 'failed';
  progress: number;
  message: string;
  confidence?: number;
  livenessScore?: number;
  retryCount: number;
}

const FaceVerify: React.FC<FaceVerifyProps> = ({
  mode = 'verify',
  onSuccess,
  onError,
  onCancel,
  visible = false,
  title,
  description,
  maxRetries = 3,
  timeout = 30000
}) => {
  const [detectionState, setDetectionState] = useState<DetectionState>({
    step: 'prepare',
    progress: 0,
    message: '准备开始人脸检测...',
    retryCount: 0
  });
  
  const [cameraVisible, setCameraVisible] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // 获取标题和描述
  const getTitle = () => {
    if (title) return title;
    switch (mode) {
      case 'register': return '注册人脸';
      case 'login': return '人脸登录';
      case 'verify': return '人脸验证';
      default: return '人脸识别';
    }
  };

  const getDescription = () => {
    if (description) return description;
    switch (mode) {
      case 'register': return '请将面部对准摄像头，我们将为您创建人脸档案';
      case 'login': return '请将面部对准摄像头进行身份验证';
      case 'verify': return '请将面部对准摄像头进行验证';
      default: return '请将面部对准摄像头';
    }
  };

  // 重置状态
  const resetState = useCallback(() => {
    setDetectionState({
      step: 'prepare',
      progress: 0,
      message: '准备开始人脸检测...',
      retryCount: 0
    });
    setCapturedImage('');
    setIsProcessing(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // 开始人脸检测
  const startDetection = useCallback(async () => {
    try {
      setDetectionState(prev => ({
        ...prev,
        step: 'detecting',
        message: '正在检测人脸...',
        progress: 20
      }));

      setCameraVisible(true);

      // 设置超时
      timeoutRef.current = setTimeout(() => {
        handleError('检测超时，请重试');
      }, timeout);

    } catch (error) {
      console.error('启动人脸检测失败:', error);
      handleError('无法启动摄像头，请检查权限设置');
    }
  }, [timeout]);

  // 拍照
  const takePhoto = useCallback(async () => {
    try {
      if (!cameraRef.current) {
        throw new Error('摄像头未准备就绪');
      }

      setDetectionState(prev => ({
        ...prev,
        step: 'processing',
        message: '正在处理图像...',
        progress: 60
      }));

      // 这里应该调用Taro的相机API拍照
      // 由于Taro相机API的限制，我们使用chooseImage作为替代
      const result = await chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['camera']
      });

      if (result.tempFilePaths && result.tempFilePaths.length > 0) {
        const imagePath = result.tempFilePaths[0];
        setCapturedImage(imagePath);
        await processImage(imagePath);
      }

    } catch (error) {
      console.error('拍照失败:', error);
      handleError('拍照失败，请重试');
    }
  }, []);

  // 处理图像
  const processImage = useCallback(async (imagePath: string) => {
    try {
      setIsProcessing(true);
      
      setDetectionState(prev => ({
        ...prev,
        message: '正在分析人脸特征...',
        progress: 80
      }));

      // 模拟API调用
      const result = await mockFaceDetection(imagePath);

      if (result.success) {
        setDetectionState(prev => ({
          ...prev,
          step: 'success',
          message: '人脸验证成功！',
          progress: 100,
          confidence: result.confidence,
          livenessScore: result.livenessScore
        }));

        setTimeout(() => {
          onSuccess?.(result);
        }, 1500);
      } else {
        throw new Error(result.message || '人脸检测失败');
      }

    } catch (error: any) {
      console.error('图像处理失败:', error);
      handleError(error.message || '图像处理失败');
    } finally {
      setIsProcessing(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [onSuccess]);

  // 处理错误
  const handleError = useCallback((message: string) => {
    const newRetryCount = detectionState.retryCount + 1;
    
    if (newRetryCount < maxRetries) {
      setDetectionState(prev => ({
        ...prev,
        step: 'failed',
        message: `${message} (${newRetryCount}/${maxRetries})`,
        retryCount: newRetryCount
      }));
    } else {
      setDetectionState(prev => ({
        ...prev,
        step: 'failed',
        message: '检测失败次数过多，请稍后重试',
        retryCount: newRetryCount
      }));
      
      setTimeout(() => {
        onError?.(message);
      }, 2000);
    }

    setCameraVisible(false);
    setIsProcessing(false);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [detectionState.retryCount, maxRetries, onError]);

  // 重试
  const handleRetry = useCallback(() => {
    setCapturedImage('');
    startDetection();
  }, [startDetection]);

  // 取消
  const handleCancel = useCallback(() => {
    resetState();
    setCameraVisible(false);
    onCancel?.();
  }, [resetState, onCancel]);

  // 模拟人脸检测API
  const mockFaceDetection = async (imagePath: string): Promise<FaceVerifyResult> => {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    // 模拟检测结果
    const random = Math.random();
    
    if (random > 0.8) {
      // 20% 概率失败
      const errors = [
        '未检测到人脸',
        '图片模糊，请重新拍摄',
        '光线不足，请在明亮环境下拍摄',
        '检测到多个人脸',
        '人脸角度不正确'
      ];
      throw new Error(errors[Math.floor(Math.random() * errors.length)]);
    }

    // 80% 概率成功
    const confidence = 0.7 + Math.random() * 0.25;
    const livenessScore = 0.6 + Math.random() * 0.35;

    return {
      success: true,
      faceId: `face_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      confidence,
      livenessScore,
      imageData: imagePath,
      features: {
        encoding: Array.from({ length: 128 }, () => Math.random() - 0.5),
        landmarks: Array.from({ length: 68 }, () => [
          Math.random() * 200 + 100,
          Math.random() * 200 + 100
        ])
      }
    };
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 当visible变化时重置状态
  useEffect(() => {
    if (visible) {
      resetState();
    }
  }, [visible, resetState]);

  return (
    <Popup
      visible={visible}
      position="center"
      closeable
      onClose={handleCancel}
      className="face-verify-popup"
    >
      <View className="face-verify">
        <View className="face-verify__header">
          <Text className="face-verify__title">{getTitle()}</Text>
          <Text className="face-verify__description">{getDescription()}</Text>
        </View>

        <View className="face-verify__content">
          {/* 摄像头区域 */}
          {cameraVisible && (
            <View className="face-verify__camera">
              <View className="camera-container">
                <View className="camera-frame">
                  <View className="frame-corners">
                    <View className="corner corner--top-left" />
                    <View className="corner corner--top-right" />
                    <View className="corner corner--bottom-left" />
                    <View className="corner corner--bottom-right" />
                  </View>
                  
                  {capturedImage ? (
                    <Image 
                      src={capturedImage} 
                      className="captured-image"
                      mode="aspectFit"
                    />
                  ) : (
                    <View className="camera-placeholder">
                      <Text>请将面部对准框内</Text>
                    </View>
                  )}
                </View>
              </View>

              {!capturedImage && !isProcessing && (
                <View className="camera-controls">
                  <NutButton
                    type="primary"
                    size="large"
                    onClick={takePhoto}
                    className="capture-btn"
                  >
                    拍照
                  </NutButton>
                </View>
              )}
            </View>
          )}

          {/* 状态显示 */}
          <View className="face-verify__status">
            <Progress 
              percentage={detectionState.progress}
              strokeColor="#fa2c19"
              showText
              className="progress-bar"
            />
            
            <Text className="status-message">{detectionState.message}</Text>
            
            {detectionState.confidence && (
              <Text className="confidence-score">
                置信度: {(detectionState.confidence * 100).toFixed(1)}%
              </Text>
            )}
            
            {detectionState.livenessScore && (
              <Text className="liveness-score">
                活体得分: {(detectionState.livenessScore * 100).toFixed(1)}%
              </Text>
            )}
          </View>

          {/* 操作按钮 */}
          <View className="face-verify__actions">
            {detectionState.step === 'prepare' && (
              <NutButton
                type="primary"
                size="large"
                onClick={startDetection}
                block
              >
                开始检测
              </NutButton>
            )}

            {detectionState.step === 'failed' && detectionState.retryCount < maxRetries && (
              <NutButton
                type="primary"
                size="large"
                onClick={handleRetry}
                block
              >
                重试 ({detectionState.retryCount}/{maxRetries})
              </NutButton>
            )}

            <NutButton
              type="default"
              size="large"
              onClick={handleCancel}
              block
              className="cancel-btn"
            >
              取消
            </NutButton>
          </View>
        </View>

        {/* 使用提示 */}
        <View className="face-verify__tips">
          <Text className="tips-title">使用提示：</Text>
          <Text className="tips-item">• 请在光线充足的环境下使用</Text>
          <Text className="tips-item">• 保持面部正对摄像头</Text>
          <Text className="tips-item">• 避免佩戴口罩或墨镜</Text>
          <Text className="tips-item">• 保持设备稳定，避免抖动</Text>
        </View>
      </View>
    </Popup>
  );
};

export default FaceVerify;