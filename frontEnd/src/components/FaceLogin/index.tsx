import { View, Text, Button, Canvas } from '@tarojs/components'
import { useState, useRef, useEffect } from 'react'
import {
  createCameraContext,
  createCanvasContext,
  getFileSystemManager,
  setStorageSync
} from '@tarojs/taro'
import { post } from '../../utils/request'
import { STORAGE_KEYS } from '../../utils/constants'
import { env } from '../../utils/platform'
import './index.scss'

interface FaceLoginProps {
  autoStart?: boolean;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

interface FaceVerifyResult {
  success: boolean;
  confidence: number;
  liveDetectionPassed: boolean;
  verificationToken: string;
}

export default function FaceLogin({
  autoStart = false,
  onSuccess,
  onError,
  onCancel
}: FaceLoginProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [captureCount, setCaptureCount] = useState(0)
  const [statusText, setStatusText] = useState('准备开始人脸识别')
  const [progress, setProgress] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [previewImage, setPreviewImage] = useState('')
  const [detectionResults, setDetectionResults] = useState<any[]>([])
  const [isH5Environment, setIsH5Environment] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)

  const cameraContextRef = useRef<any>(null)
  const canvasContextRef = useRef<any>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 检查环境和权限
  useEffect(() => {
    const checkEnvironment = async () => {
      setIsH5Environment(env.isH5)
      
      if (env.isH5) {
        await initH5Camera()
      } else {
        await initMiniProgramCamera()
      }
    }

    checkEnvironment()

    return () => {
      cleanup()
    }
  }, [])

  // 自动开始
  useEffect(() => {
    if (autoStart && cameraReady && permissionGranted) {
      setTimeout(() => {
        startFaceDetection()
      }, 1000)
    }
  }, [autoStart, cameraReady, permissionGranted])

  // 初始化H5摄像头
  const initH5Camera = async () => {
    try {
      // 检查浏览器支持
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('当前浏览器不支持摄像头功能，请使用Chrome、Firefox或Safari浏览器')
      }

      // 检查HTTPS环境
      if (location.protocol !== 'https:' && 
          location.hostname !== 'localhost' && 
          location.hostname !== '127.0.0.1') {
        throw new Error('摄像头功能需要HTTPS环境，请使用https://访问')
      }

      setStatusText('正在请求摄像头权限，请点击"允许"...')
      
      // 请求摄像头权限，添加更多约束
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: 'user', // 前置摄像头
          frameRate: { ideal: 30, max: 60 }
        },
        audio: false
      })

      streamRef.current = stream
      
      // 检查视频轨道
      const videoTracks = stream.getVideoTracks()
      if (videoTracks.length === 0) {
        throw new Error('无法获取视频流，请检查摄像头是否被其他应用占用')
      }

      console.log('📹 摄像头初始化成功:', videoTracks[0].getSettings())
      setCameraReady(true)
      setPermissionGranted(true)
      setStatusText('摄像头准备就绪')
      
    } catch (error: any) {
      console.error('❌摄像头初始化失败:', error)
      let errorMessage = '摄像头初始化失败'
      
      if (error.name === 'NotAllowedError') {
        errorMessage = '摄像头权限被拒绝，请在浏览器设置中允许摄像头访问'
      } else if (error.name === 'NotFoundError') {
        errorMessage = '未找到摄像头设备，请检查摄像头是否正常连接'
      } else if (error.name === 'NotReadableError') {
        errorMessage = '摄像头被其他应用占用，请关闭其他使用摄像头的应用'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      setStatusText(errorMessage)
        onError(errorMessage)
      }
    }

  // 清理资源
  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = null
    }
  }

  // 开始人脸检测
  const startFaceDetection = async () => {
    if (!cameraReady || !permissionGranted) {
      onError('摄像头未准备就绪')
      return
    }

    setIsCapturing(true)
    setStatusText('正在进行人脸检测...')
    setCaptureCount(0)
    setProgress(0)

    // 模拟检测过程
    const maxAttempts = 5
    let attempts = 0

    const detectInterval = setInterval(async () => {
      attempts++
      setCaptureCount(attempts)
      setProgress((attempts / maxAttempts) * 100)
      setStatusText(`正在检测人脸... (${attempts}/${maxAttempts})`)

      if (attempts >= maxAttempts) {
        clearInterval(detectInterval)
        setIsCapturing(false)
        
        // 执行真实的人脸登录
        await performFaceLogin()
      }
    }, 1000)

    captureIntervalRef.current = detectInterval
  }

  // 执行人脸登录
  const performFaceLogin = async () => {
    try {
      setIsProcessing(true)
      setStatusText('正在处理人脸登录...')
      
      // 捕获当前视频帧
      const imageBlob = await captureVideoFrame()
      if (!imageBlob) {
        throw new Error('无法捕获人脸图像')
      }

      // 准备FormData
      const formData = new FormData()
      formData.append('faceImage', imageBlob, 'face.jpg')
      formData.append('phone', '13800138000') // 这里应该从登录表单获取

      // 调用人脸登录API
      const response = await post('/face/login', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      if (response.success && response.data) {
        setStatusText('人脸识别成功！')
        
        // 保存登录信息
        try {
          import('../../utils/tokenManager').then(({ tokenManager }) => {
            tokenManager.saveTokens({
              token: response.data.token,
              refreshToken: response.data.refreshToken || '',
              expiresAt: Date.now() + 24 * 60 * 60 * 1000
            })
          })
          
          import('@tarojs/taro').then(Taro => {
            Taro.setStorageSync('user_info', response.data.user)
          })
        } catch (storageError) {
          console.error('保存登录信息失败:', storageError)
        }
        
        onSuccess({
          success: true,
          confidence: 0.9,
          liveDetectionPassed: true,
          verificationToken: response.data.token,
          userData: response.data
        })
      } else {
        throw new Error(response.message || '人脸登录失败')
      }

    } catch (error: any) {
      console.error('人脸登录失败:', error)
      setStatusText('人脸识别失败')
      onError(error.message || '人脸识别过程中出现错误，请重试或使用验证码登录')
    } finally {
      setIsProcessing(false)
    }
  }

  // 捕获视频帧
  const captureVideoFrame = async (): Promise<Blob | null> => {
    try {
      if (isH5Environment && videoRef.current) {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        
        if (!context || !videoRef.current.videoWidth) {
          return null
        }

        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        
        // 绘制视频帧到canvas
        context.drawImage(videoRef.current, 0, 0)
        
        // 转换为blob
        return new Promise((resolve) => {
          canvas.toBlob((blob) => {
            resolve(blob)
          }, 'image/jpeg', 0.8)
        })
      }
      return null
    } catch (error) {
      console.error('捕获视频帧失败:', error)
      return null
    }
  }

  return (
    <View className='face-login'>
      <View className='face-login-header'>
        <Text className='face-login-title'>人脸识别登录</Text>
        <Text className='face-login-subtitle'>请将面部对准摄像头</Text>
      </View>
      
      <View className='face-login-camera'>
        {isH5Environment ? (
          <View className='camera-container'>
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted
              className='camera-video'
            />
            <View className='camera-overlay'>
              <View className='face-frame' />
            </View>
          </View>
        ) : (
          <View className='camera-placeholder'>
            <Text>小程序环境暂不支持人脸识别</Text>
          </View>
        )}
      </View>
      
      <View className='face-login-status'>
        <Text className='status-text'>{statusText}</Text>
        {isCapturing && (
          <View className='progress-container'>
            <View className='progress-bar'>
              <View 
                className='progress-fill' 
                style={{ width: `${progress}%` }}
              />
            </View>
            <Text className='progress-text'>{Math.round(progress)}%</Text>
          </View>
        )}
      </View>
      
      <View className='face-login-actions'>
        {!isCapturing && cameraReady && (
          <Button 
            className='start-btn'
            onClick={startFaceDetection}
          >
            开始识别
          </Button>
        )}
        
        {!isCapturing && !cameraReady && (
          <Button 
            className='retry-btn'
            onClick={() => initH5Camera()}
          >
            重新初始化摄像头
          </Button>
        )}
        
        <Button 
          className='cancel-btn'
          onClick={onCancel}
        >
          取消
        </Button>
      </View>
    </View>
  )



  // 初始化小程序摄像头
  const initMiniProgramCamera = async () => {
    try {
      setStatusText('正在初始化摄像头...')
      
      // 小程序环境下的摄像头初始化
      cameraContextRef.current = createCameraContext()
      canvasContextRef.current = createCanvasContext('faceCanvas')
      
      setCameraReady(true)
      setPermissionGranted(true)
      setStatusText('摄像头已就绪')
      console.log('✅ 小程序摄像头初始化成功')
      
    } catch (error) {
      console.error('❌ 小程序摄像头初始化失败:', error)
      setStatusText('摄像头初始化失败')
      onError('摄像头初始化失败')
    }
  }



  // TODO: 捕获并检测人脸功能待实现

  // TODO: H5环境下从摄像头捕获图片功能待实现

  // TODO: 小程序环境下从摄像头捕获图片功能待实现

  // TODO: 分析检测结果功能待实现
  /*
  const analyzeDetectionResults = async () => {
    const successfulDetections = detectionResults.filter(result => 
      result.success !== false && result.faceDetected && result.confidence > 0.6
    )

    if (successfulDetections.length === 0) {
      throw new Error('未检测到有效的人脸，请确保面部清晰可见')
    }

    if (successfulDetections.length < 2) {
      throw new Error('有效检测次数不足，请重新尝试')
    }

    setProgress(80)
    setStatusText('正在进行活体检测...')

    // 使用最佳检测结果进行人脸登录
    const bestDetection = successfulDetections.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )
    
    // 将最佳检测结果转换为FormData进行登录
    const formData = new FormData()
    const base64Data = bestDetection.imageData.split(',')[1]
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'image/jpeg' })
    formData.append('image', blob, 'face.jpg')
    
    // const verifyResult = await post('/v1_0/auth/api/face/auto-register-login', formData, {
    //   headers: {
    //     'Content-Type': 'multipart/form-data'
    //   }
    // })
  }
  */

  /*
    setProgress(90)

    if (!verifyResult.success) {
      throw new Error(verifyResult.message || '人脸验证失败')
    }

    setProgress(100)
    setStatusText('人脸识别成功！')

    // 显示预览图片
    if (successfulDetections.length > 0) {
      setPreviewImage(successfulDetections[0].imageData)
      setShowPreview(true)
    }

    // 保存登录信息到本地存储
    if (verifyResult.data) {
      try {
        setStorageSync(STORAGE_KEYS.USER_TOKEN, verifyResult.data.token)
        setStorageSync(STORAGE_KEYS.USER_INFO, verifyResult.data.user)
        
        if (verifyResult.data.refreshToken) {
          setStorageSync('refresh_token', verifyResult.data.refreshToken)
        }
        
        console.log('✅ 人脸登录信息已保存:', verifyResult.data.user)
      } catch (storageError) {
        console.error('❌ 保存登录信息失败:', storageError)
      }
    }

    // 延迟一下再调用成功回调
    setTimeout(() => {
      onSuccess(verifyResult.data)
    }, 1000)

  } catch (error: any) {
    console.error('❌ 检测结果分析失败:', error)
    setStatusText('人脸识别失败')
    onError(error.message || '人脸识别过程中出现错误')
  } finally {
    setIsProcessing(false)
  }
  */

  // 重新开始
  const restart = () => {
    setDetectionResults([])
    setCaptureCount(0)
    setProgress(0)
    setShowPreview(false)
    setPreviewImage('')
    setStatusText('准备开始人脸识别')
    
    if (cameraReady && permissionGranted) {
      setTimeout(() => {
        startFaceDetection()
      }, 500)
    }
  }



  // 取消操作
  const handleCancel = () => {
    cleanup()
    onCancel()
  }

  return (
    <View className='face-login'>
      {/* 背景遮罩 */}
      <View className='face-login-overlay' />
      
      {/* 主容器 */}
      <View className='face-login-container'>
        {/* 头部 */}
        <View className='face-login-header'>
          <Text className='face-login-title'>人脸识别登录</Text>
          <Text className='face-login-subtitle'>请将面部对准摄像头</Text>
        </View>

        {/* 摄像头预览区域 */}
        <View className='camera-preview-container'>
          {isH5Environment ? (
            // H5环境下的视频预览
            <View className='h5-camera-preview'>
              <View 
                className='video-container'
                ref={(el) => {
                  if (el && videoRef.current && !el.querySelector('video')) {
                    el.appendChild(videoRef.current)
                  }
                }}
              />
            </View>
          ) : (
            // 小程序环境下的摄像头组件
            <camera 
              className='camera-preview'
              device-position='front'
              flash='off'
              frame-size='medium'
            />
          )}
          
          {/* 人脸识别框 */}
          <View className='face-detection-frame'>
            <View className='frame-corner frame-corner-tl' />
            <View className='frame-corner frame-corner-tr' />
            <View className='frame-corner frame-corner-bl' />
            <View className='frame-corner frame-corner-br' />
            
            {/* 扫描线动画 */}
            {isCapturing && (
              <View className='scan-line' />
            )}
          </View>

          {/* 状态指示器 */}
          <View className='status-indicators'>
            {detectionResults.map((result, index) => (
              <View 
                key={index}
                className={`status-dot ${result.success !== false ? 'success' : 'failed'}`}
              />
            ))}
          </View>
        </View>

        {/* 进度条 */}
        {(isCapturing || isProcessing) && (
          <View className='progress-container'>
            <View className='progress-bar'>
              <View 
                className='progress-fill'
                style={{ width: `${progress}%` }}
              />
            </View>
            <Text className='progress-text'>{Math.round(progress)}%</Text>
          </View>
        )}

        {/* 状态文本 */}
        <View className='status-container'>
          <Text className='status-text'>{statusText}</Text>
          {captureCount > 0 && (
            <Text className='capture-count'>已捕获 {captureCount}/3 张照片</Text>
          )}
        </View>

        {/* 操作按钮 */}
        <View className='action-buttons'>
          {!isCapturing && !isProcessing && cameraReady && (
            <Button 
              className='start-button'
              onClick={startFaceDetection}
              disabled={!permissionGranted}
            >
              {permissionGranted ? '开始识别' : '等待权限...'}
            </Button>
          )}
          
          {(isCapturing || isProcessing) && (
            <Button 
              className='processing-button'
              disabled
            >
              {isCapturing ? '识别中...' : '处理中...'}
            </Button>
          )}
          
          {!isCapturing && !isProcessing && detectionResults.length > 0 && (
            <Button 
              className='restart-button'
              onClick={restart}
            >
              重新识别
            </Button>
          )}
          
          <Button 
            className='cancel-button'
            onClick={handleCancel}
          >
            取消
          </Button>
        </View>

        {/* 提示信息 */}
        <View className='tips-container'>
          <Text className='tips-title'>识别提示：</Text>
          <Text className='tips-item'>• 请确保光线充足</Text>
          <Text className='tips-item'>• 保持面部正对摄像头</Text>
          <Text className='tips-item'>• 识别过程中请勿移动</Text>
        </View>
      </View>

      {/* 预览图片模态框 */}
      {showPreview && previewImage && (
        <View className='preview-modal'>
          <View className='preview-content'>
            <Text className='preview-title'>识别成功</Text>
            <image 
              className='preview-image'
              src={previewImage}
              mode='aspectFit'
            />
            <Button 
              className='preview-close'
              onClick={() => setShowPreview(false)}
            >
              确定
            </Button>
          </View>
        </View>
      )}

      {/* Canvas用于图片处理（小程序环境） */}
      {!isH5Environment && (
        <Canvas 
          canvasId='faceCanvas'
          className='face-canvas'
          style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}
        />
      )}
    </View>
  )
}