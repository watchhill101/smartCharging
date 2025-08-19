import { View, Text, Button, Canvas } from '@tarojs/components'
import { useState, useRef, useEffect } from 'react'
import Taro, {
  createCameraContext,
  createCanvasContext,
  canvasToTempFilePath,
  getFileSystemManager,
  showToast,
  setStorageSync,
  getStorageSync
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
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('当前浏览器不支持摄像头功能')
      }

      // 检查HTTPS
      if (location.protocol !== 'https:' && 
          location.hostname !== 'localhost' && 
          location.hostname !== '127.0.0.1') {
        throw new Error('摄像头功能需要HTTPS环境')
      }

      setStatusText('正在请求摄像头权限...')
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' // 前置摄像头
        },
        audio: false
      })

      streamRef.current = stream
      
      // 创建video元素
      const video = document.createElement('video')
      video.srcObject = stream
      video.autoplay = true
      video.playsInline = true
      video.muted = true
      videoRef.current = video

      video.onloadedmetadata = () => {
        setCameraReady(true)
        setPermissionGranted(true)
        setStatusText('摄像头已就绪')
        console.log('✅ H5摄像头初始化成功')
      }

    } catch (error: any) {
      console.error('❌ H5摄像头初始化失败:', error)
      let errorMessage = '摄像头初始化失败'
      
      if (error.name === 'NotAllowedError') {
        errorMessage = '请允许访问摄像头权限'
      } else if (error.name === 'NotFoundError') {
        errorMessage = '未找到摄像头设备'
      } else if (error.name === 'NotSupportedError') {
        errorMessage = '当前浏览器不支持摄像头'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      setStatusText(errorMessage)
      onError(errorMessage)
    }
  }

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

  // 开始人脸检测
  const startFaceDetection = async () => {
    if (isCapturing || isProcessing) {
      return
    }

    setIsCapturing(true)
    setCaptureCount(0)
    setProgress(0)
    setDetectionResults([])
    setStatusText('正在进行人脸检测...')

    try {
      // 连续捕获多张照片进行活体检测
      const capturePromises = []
      const totalCaptures = 3
      
      for (let i = 0; i < totalCaptures; i++) {
        capturePromises.push(
          new Promise<void>((resolve) => {
            setTimeout(async () => {
              await captureAndDetect(i + 1, totalCaptures)
              resolve()
            }, i * 1000) // 每秒捕获一张
          })
        )
      }

      await Promise.all(capturePromises)
      
      // 分析检测结果
      await analyzeDetectionResults()
      
    } catch (error) {
      console.error('❌ 人脸检测失败:', error)
      setStatusText('人脸检测失败')
      onError('人脸检测过程中出现错误')
    } finally {
      setIsCapturing(false)
    }
  }

  // 捕获并检测人脸
  const captureAndDetect = async (currentCapture: number, totalCaptures: number) => {
    try {
      setStatusText(`正在捕获第 ${currentCapture}/${totalCaptures} 张照片...`)
      setCaptureCount(currentCapture)
      setProgress((currentCapture / totalCaptures) * 50) // 前50%进度用于捕获

      let imageData: string
      
      if (isH5Environment) {
        imageData = await captureFromH5Camera()
      } else {
        imageData = await captureFromMiniProgramCamera()
      }

      // 发送到后端进行人脸检测
      setStatusText(`正在分析第 ${currentCapture} 张照片...`)
      
      // 将base64转换为FormData
      const formData = new FormData()
      const base64Data = imageData.split(',')[1] // 移除data:image/jpeg;base64,前缀
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/jpeg' })
      formData.append('image', blob, 'face.jpg')
      
      const detectionResult = await post('/v1_0/auth/api/face/detect', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      if (detectionResult.success && detectionResult.data) {
        setDetectionResults(prev => [...prev, {
          index: currentCapture,
          ...detectionResult.data,
          imageData
        }])
        
        console.log(`✅ 第 ${currentCapture} 张照片检测成功:`, detectionResult.data)
      } else {
        console.warn(`⚠️ 第 ${currentCapture} 张照片检测失败:`, detectionResult.message)
        setDetectionResults(prev => [...prev, {
          index: currentCapture,
          success: false,
          message: detectionResult.message,
          imageData
        }])
      }

    } catch (error) {
      console.error(`❌ 第 ${currentCapture} 张照片处理失败:`, error)
      setDetectionResults(prev => [...prev, {
        index: currentCapture,
        success: false,
        error: error,
        imageData: ''
      }])
    }
  }

  // H5环境下从摄像头捕获图片
  const captureFromH5Camera = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const video = videoRef.current
        if (!video) {
          throw new Error('视频元素未初始化')
        }

        // 创建canvas进行截图
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        
        if (!ctx) {
          throw new Error('Canvas上下文创建失败')
        }

        // 绘制当前视频帧
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // 转换为base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8)
        resolve(imageData)
        
      } catch (error) {
        console.error('H5摄像头捕获失败:', error)
        reject(error)
      }
    })
  }

  // 小程序环境下从摄像头捕获图片
  const captureFromMiniProgramCamera = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const cameraContext = cameraContextRef.current
        if (!cameraContext) {
          throw new Error('摄像头上下文未初始化')
        }

        // 拍照
        cameraContext.takePhoto({
          quality: 'high',
          success: (res: any) => {
            // 将临时文件转换为base64
            const fs = getFileSystemManager()
            fs.readFile({
              filePath: res.tempImagePath,
              encoding: 'base64',
              success: (fileRes: any) => {
                const imageData = `data:image/jpeg;base64,${fileRes.data}`
                resolve(imageData)
              },
              fail: (error: any) => {
                console.error('读取图片文件失败:', error)
                reject(error)
              }
            })
          },
          fail: (error: any) => {
            console.error('拍照失败:', error)
            reject(error)
          }
        })
        
      } catch (error) {
        console.error('小程序摄像头捕获失败:', error)
        reject(error)
      }
    })
  }

  // 分析检测结果
  const analyzeDetectionResults = async () => {
    setIsProcessing(true)
    setStatusText('正在分析检测结果...')
    setProgress(60)

    try {
      // 筛选成功的检测结果
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
      
      const verifyResult = await post('/v1_0/auth/api/face/auto-register-login', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

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
  }

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

  // 清理资源
  const cleanup = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current)
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current = null
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