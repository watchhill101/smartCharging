import { render, fireEvent, waitFor } from '@testing-library/react'
import FaceLogin from '../index'

// Mock Taro APIs
jest.mock('@tarojs/taro', () => ({
  createCameraContext: jest.fn(() => ({
    takePhoto: jest.fn()
  })),
  createCanvasContext: jest.fn(() => ({})),
  canvasToTempFilePath: jest.fn(),
  getFileSystemManager: jest.fn(() => ({
    readFile: jest.fn()
  })),
  showToast: jest.fn(),
  setStorageSync: jest.fn(),
  getStorageSync: jest.fn()
}))

// Mock request utility
jest.mock('../../../utils/request', () => ({
  post: jest.fn()
}))

// Mock platform utility
jest.mock('../../../utils/platform', () => ({
  env: {
    isH5: false
  }
}))

// Mock constants
jest.mock('../../../utils/constants', () => ({
  STORAGE_KEYS: {
    USER_TOKEN: 'user_token',
    USER_INFO: 'user_info'
  }
}))

import { post } from '../../../utils/request'
const mockPost = post as jest.MockedFunction<typeof post>

// Mock navigator.mediaDevices for H5 environment
const mockGetUserMedia = jest.fn()
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia
  },
  writable: true
})

// Mock location for HTTPS check
Object.defineProperty(global.location, 'protocol', {
  value: 'https:',
  writable: true
})

Object.defineProperty(global.location, 'hostname', {
  value: 'localhost',
  writable: true
})

// Mock atob for base64 decoding
global.atob = jest.fn((str) => {
  return Buffer.from(str, 'base64').toString('binary')
})

// Mock Blob
global.Blob = jest.fn().mockImplementation((content, options) => ({
  content,
  type: options?.type || 'application/octet-stream'
})) as any

// Mock FormData
global.FormData = jest.fn().mockImplementation(() => ({
  append: jest.fn()
})) as any

describe('FaceLogin Component', () => {
  const defaultProps = {
    autoStart: false,
    onSuccess: jest.fn(),
    onError: jest.fn(),
    onCancel: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应该正确渲染人脸登录组件', () => {
    const { getByText } = render(<FaceLogin {...defaultProps} />)
    
    expect(getByText('人脸识别登录')).toBeTruthy()
    expect(getByText('请将面部对准摄像头')).toBeTruthy()
    expect(getByText('准备开始人脸识别')).toBeTruthy()
  })

  it('应该显示操作按钮', () => {
    const { getByText } = render(<FaceLogin {...defaultProps} />)
    
    expect(getByText('取消')).toBeTruthy()
  })

  it('应该显示识别提示信息', () => {
    const { getByText } = render(<FaceLogin {...defaultProps} />)
    
    expect(getByText('识别提示：')).toBeTruthy()
    expect(getByText('• 请确保光线充足')).toBeTruthy()
    expect(getByText('• 保持面部正对摄像头')).toBeTruthy()
    expect(getByText('• 识别过程中请勿移动')).toBeTruthy()
  })

  it('应该在点击取消按钮时调用onCancel', () => {
    const onCancel = jest.fn()
    const { getByText } = render(
      <FaceLogin {...defaultProps} onCancel={onCancel} />
    )
    
    const cancelButton = getByText('取消')
    fireEvent.click(cancelButton)
    
    expect(onCancel).toHaveBeenCalled()
  })

  it('应该在摄像头就绪后显示开始按钮', async () => {
    const { getByText } = render(<FaceLogin {...defaultProps} />)
    
    // 等待摄像头初始化
    await waitFor(() => {
      expect(getByText('开始识别')).toBeTruthy()
    }, { timeout: 2000 })
  })

  it('应该在识别过程中显示进度', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        faceDetected: true,
        confidence: 0.9,
        features: {
          encoding: new Array(128).fill(0.5),
          landmarks: new Array(68).fill([100, 100])
        },
        quality: 'excellent'
      }
    })

    const { getByText, container } = render(<FaceLogin {...defaultProps} />)
    
    // 等待摄像头就绪
    await waitFor(() => {
      expect(getByText('开始识别')).toBeTruthy()
    })

    // 点击开始识别
    const startButton = getByText('开始识别')
    fireEvent.click(startButton)

    // 检查识别状态
    await waitFor(() => {
      expect(getByText('正在进行人脸检测...')).toBeTruthy()
    })

    // 检查进度条
    const progressBar = container.querySelector('.progress-bar')
    expect(progressBar).toBeTruthy()
  })

  it('应该在识别成功时调用onSuccess', async () => {
    const onSuccess = jest.fn()
    
    // Mock人脸检测成功
    mockPost
      .mockResolvedValueOnce({
        success: true,
        data: {
          faceDetected: true,
          confidence: 0.9,
          features: {
            encoding: new Array(128).fill(0.5),
            landmarks: new Array(68).fill([100, 100])
          },
          quality: 'excellent'
        }
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          faceDetected: true,
          confidence: 0.85,
          features: {
            encoding: new Array(128).fill(0.4),
            landmarks: new Array(68).fill([95, 95])
          },
          quality: 'good'
        }
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          faceDetected: true,
          confidence: 0.88,
          features: {
            encoding: new Array(128).fill(0.45),
            landmarks: new Array(68).fill([98, 98])
          },
          quality: 'good'
        }
      })
      // Mock人脸登录成功
      .mockResolvedValueOnce({
        success: true,
        data: {
          token: 'test_token_123',
          refreshToken: 'refresh_token_123',
          user: {
            id: 'user_123',
            phone: 'temp_123456789',
            nickName: '人脸用户1234',
            balance: 100
          },
          faceInfo: {
            faceId: 'face_123',
            similarity: 0.95,
            confidence: 0.9
          },
          isNewUser: true
        }
      })

    const { getByText } = render(
      <FaceLogin {...defaultProps} onSuccess={onSuccess} />
    )
    
    // 等待摄像头就绪并开始识别
    await waitFor(() => {
      expect(getByText('开始识别')).toBeTruthy()
    })

    const startButton = getByText('开始识别')
    fireEvent.click(startButton)

    // 等待识别完成
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        token: 'test_token_123',
        refreshToken: 'refresh_token_123',
        user: {
          id: 'user_123',
          phone: 'temp_123456789',
          nickName: '人脸用户1234',
          balance: 100
        },
        faceInfo: {
          faceId: 'face_123',
          similarity: 0.95,
          confidence: 0.9
        },
        isNewUser: true
      })
    }, { timeout: 10000 })
  })

  it('应该在识别失败时调用onError', async () => {
    const onError = jest.fn()
    
    // Mock人脸检测失败
    mockPost.mockResolvedValue({
      success: false,
      message: '未检测到人脸'
    })

    const { getByText } = render(
      <FaceLogin {...defaultProps} onError={onError} />
    )
    
    // 等待摄像头就绪并开始识别
    await waitFor(() => {
      expect(getByText('开始识别')).toBeTruthy()
    })

    const startButton = getByText('开始识别')
    fireEvent.click(startButton)

    // 等待识别失败
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('未检测到有效的人脸，请确保面部清晰可见')
    }, { timeout: 10000 })
  })

  it('应该在网络错误时调用onError', async () => {
    const onError = jest.fn()
    
    // Mock网络错误
    mockPost.mockRejectedValue(new Error('Network error'))

    const { getByText } = render(
      <FaceLogin {...defaultProps} onError={onError} />
    )
    
    // 等待摄像头就绪并开始识别
    await waitFor(() => {
      expect(getByText('开始识别')).toBeTruthy()
    })

    const startButton = getByText('开始识别')
    fireEvent.click(startButton)

    // 等待网络错误处理
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('人脸识别过程中出现错误')
    }, { timeout: 10000 })
  })

  it('应该显示状态指示器', async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: {
        faceDetected: true,
        confidence: 0.9,
        features: {
          encoding: new Array(128).fill(0.5),
          landmarks: new Array(68).fill([100, 100])
        },
        quality: 'excellent'
      }
    })

    const { container, getByText } = render(<FaceLogin {...defaultProps} />)
    
    // 等待摄像头就绪并开始识别
    await waitFor(() => {
      expect(getByText('开始识别')).toBeTruthy()
    })

    const startButton = getByText('开始识别')
    fireEvent.click(startButton)

    // 检查状态指示器
    await waitFor(() => {
      const statusDots = container.querySelectorAll('.status-dot')
      expect(statusDots.length).toBeGreaterThan(0)
    })
  })

  it('应该支持重新识别功能', async () => {
    mockPost.mockResolvedValue({
      success: false,
      message: '识别失败'
    })

    const { getByText } = render(<FaceLogin {...defaultProps} />)
    
    // 等待摄像头就绪并开始识别
    await waitFor(() => {
      expect(getByText('开始识别')).toBeTruthy()
    })

    const startButton = getByText('开始识别')
    fireEvent.click(startButton)

    // 等待识别完成（失败）
    await waitFor(() => {
      expect(getByText('重新识别')).toBeTruthy()
    }, { timeout: 10000 })

    // 点击重新识别
    const restartButton = getByText('重新识别')
    fireEvent.click(restartButton)

    // 应该重置状态
    expect(getByText('准备开始人脸识别')).toBeTruthy()
  })

  it('应该在autoStart为true时自动开始识别', async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: {
        faceDetected: true,
        confidence: 0.9,
        features: {
          encoding: new Array(128).fill(0.5),
          landmarks: new Array(68).fill([100, 100])
        },
        quality: 'excellent'
      }
    })

    const { getByText } = render(
      <FaceLogin {...defaultProps} autoStart={true} />
    )
    
    // 应该自动开始识别
    await waitFor(() => {
      expect(getByText('正在进行人脸检测...')).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('应该正确处理base64图片转换', async () => {
    const mockFormData = {
      append: jest.fn()
    }
    ;(global.FormData as jest.Mock).mockReturnValue(mockFormData)

    mockPost.mockResolvedValue({
      success: true,
      data: {
        faceDetected: true,
        confidence: 0.9,
        features: {
          encoding: new Array(128).fill(0.5),
          landmarks: new Array(68).fill([100, 100])
        },
        quality: 'excellent'
      }
    })

    const { getByText } = render(<FaceLogin {...defaultProps} />)
    
    // 等待摄像头就绪并开始识别
    await waitFor(() => {
      expect(getByText('开始识别')).toBeTruthy()
    })

    const startButton = getByText('开始识别')
    fireEvent.click(startButton)

    // 验证FormData的使用
    await waitFor(() => {
      expect(mockFormData.append).toHaveBeenCalledWith(
        'image',
        expect.any(Object),
        'face.jpg'
      )
    }, { timeout: 5000 })
  })
})