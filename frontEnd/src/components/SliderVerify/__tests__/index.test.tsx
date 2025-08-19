import { render, fireEvent, waitFor } from '@testing-library/react'
import SliderVerify from '../index'

// Mock Taro APIs
jest.mock('@tarojs/taro', () => ({
  useLoad: jest.fn((callback) => callback()),
  vibrateShort: jest.fn(),
  createSelectorQuery: jest.fn(() => ({
    select: jest.fn(() => ({
      boundingClientRect: jest.fn((callback) => ({
        exec: jest.fn(() => {
          callback({
            left: 0,
            top: 0,
            width: 248,
            height: 42
          })
        })
      }))
    }))
  }))
}))

// Mock request utility
jest.mock('../../../utils/request', () => ({
  post: jest.fn()
}))

import { post } from '../../../utils/request'
const mockPost = post as jest.MockedFunction<typeof post>

describe('SliderVerify Component', () => {
  const defaultProps = {
    onSuccess: jest.fn(),
    onError: jest.fn(),
    width: 248,
    height: 42
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应该正确渲染滑块验证组件', () => {
    const { getByText, container } = render(<SliderVerify {...defaultProps} />)
    
    expect(getByText('拖动滑块完成验证')).toBeTruthy()
    expect(container.querySelector('.slider-verify')).toBeTruthy()
    expect(container.querySelector('.slider-button')).toBeTruthy()
    expect(container.querySelector('.puzzle-gap')).toBeTruthy()
  })

  it('应该使用默认的宽度和高度', () => {
    const { container } = render(
      <SliderVerify onSuccess={jest.fn()} onError={jest.fn()} />
    )
    
    const sliderVerify = container.querySelector('.slider-verify')
    expect(sliderVerify).toHaveStyle({ height: '42px' })
  })

  it('应该使用自定义的宽度和高度', () => {
    const { container } = render(
      <SliderVerify 
        onSuccess={jest.fn()} 
        onError={jest.fn()} 
        width={300} 
        height={50} 
      />
    )
    
    const sliderVerify = container.querySelector('.slider-verify')
    expect(sliderVerify).toHaveStyle({ height: '50px' })
  })

  it('应该在拖拽开始时设置正确的状态', async () => {
    const { container } = render(<SliderVerify {...defaultProps} />)
    
    const sliderButton = container.querySelector('.slider-button')
    expect(sliderButton).toBeTruthy()

    // 模拟触摸开始
    fireEvent.touchStart(sliderButton!, {
      touches: [{ clientX: 10, clientY: 20 }]
    })

    await waitFor(() => {
      expect(sliderButton).toHaveClass('moving')
    })
  })

  it('应该在拖拽移动时更新滑块位置', async () => {
    const { container } = render(<SliderVerify {...defaultProps} />)
    
    const sliderButton = container.querySelector('.slider-button')
    expect(sliderButton).toBeTruthy()

    // 开始拖拽
    fireEvent.touchStart(sliderButton!, {
      touches: [{ clientX: 10, clientY: 20 }]
    })

    // 移动滑块
    fireEvent.touchMove(sliderButton!, {
      touches: [{ clientX: 60, clientY: 20 }]
    })

    await waitFor(() => {
      const transform = sliderButton!.style.transform
      expect(transform).toContain('translateX(50px)')
    })
  })

  it('应该在验证成功时调用onSuccess回调', async () => {
    const onSuccess = jest.fn()
    const { container } = render(
      <SliderVerify {...defaultProps} onSuccess={onSuccess} />
    )

    // Mock成功的API响应
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        verified: true,
        token: 'test_token_123'
      }
    })

    const sliderButton = container.querySelector('.slider-button')
    
    // 模拟完整的拖拽操作
    fireEvent.touchStart(sliderButton!, {
      touches: [{ clientX: 10, clientY: 20 }]
    })

    fireEvent.touchMove(sliderButton!, {
      touches: [{ clientX: 110, clientY: 20 }]
    })

    fireEvent.touchEnd(sliderButton!)

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('test_token_123')
    })
  })

  it('应该在验证失败时调用onError回调', async () => {
    const onError = jest.fn()
    const { container } = render(
      <SliderVerify {...defaultProps} onError={onError} />
    )

    // Mock失败的API响应
    mockPost.mockResolvedValueOnce({
      success: false,
      data: {
        verified: false,
        reason: '精度不够'
      }
    })

    const sliderButton = container.querySelector('.slider-button')
    
    // 模拟拖拽操作
    fireEvent.touchStart(sliderButton!, {
      touches: [{ clientX: 10, clientY: 20 }]
    })

    fireEvent.touchMove(sliderButton!, {
      touches: [{ clientX: 50, clientY: 20 }]
    })

    fireEvent.touchEnd(sliderButton!)

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('验证失败: 精度不够')
    })
  })

  it('应该在网络错误时调用onError回调', async () => {
    const onError = jest.fn()
    const { container } = render(
      <SliderVerify {...defaultProps} onError={onError} />
    )

    // Mock网络错误
    mockPost.mockRejectedValueOnce(new Error('Network error'))

    const sliderButton = container.querySelector('.slider-button')
    
    // 模拟拖拽操作
    fireEvent.touchStart(sliderButton!, {
      touches: [{ clientX: 10, clientY: 20 }]
    })

    fireEvent.touchMove(sliderButton!, {
      touches: [{ clientX: 110, clientY: 20 }]
    })

    fireEvent.touchEnd(sliderButton!)

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('网络请求失败，请重试')
    })
  })

  it('应该在验证成功后显示成功状态', async () => {
    const { container, getByText } = render(<SliderVerify {...defaultProps} />)

    // Mock成功的API响应
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        verified: true,
        token: 'test_token_123'
      }
    })

    const sliderButton = container.querySelector('.slider-button')
    
    // 模拟拖拽操作
    fireEvent.touchStart(sliderButton!, {
      touches: [{ clientX: 10, clientY: 20 }]
    })

    fireEvent.touchMove(sliderButton!, {
      touches: [{ clientX: 110, clientY: 20 }]
    })

    fireEvent.touchEnd(sliderButton!)

    await waitFor(() => {
      expect(getByText('验证成功')).toBeTruthy()
      expect(sliderButton).toHaveClass('verified')
    })
  })

  it('应该在验证中显示加载状态', async () => {
    const { container, getByText } = render(<SliderVerify {...defaultProps} />)

    // Mock延迟的API响应
    mockPost.mockImplementationOnce(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          success: true,
          data: { verified: true, token: 'test_token' }
        }), 100)
      )
    )

    const sliderButton = container.querySelector('.slider-button')
    
    // 模拟拖拽操作
    fireEvent.touchStart(sliderButton!, {
      touches: [{ clientX: 10, clientY: 20 }]
    })

    fireEvent.touchMove(sliderButton!, {
      touches: [{ clientX: 110, clientY: 20 }]
    })

    fireEvent.touchEnd(sliderButton!)

    // 检查验证中状态
    await waitFor(() => {
      expect(getByText('正在验证...')).toBeTruthy()
    })
  })

  it('应该限制滑块移动范围', async () => {
    const { container } = render(<SliderVerify {...defaultProps} width={248} />)
    
    const sliderButton = container.querySelector('.slider-button')
    
    // 开始拖拽
    fireEvent.touchStart(sliderButton!, {
      touches: [{ clientX: 10, clientY: 20 }]
    })

    // 尝试移动超出范围
    fireEvent.touchMove(sliderButton!, {
      touches: [{ clientX: 300, clientY: 20 }] // 超出248-40=208的有效范围
    })

    await waitFor(() => {
      const transform = sliderButton!.style.transform
      // 应该被限制在有效范围内
      expect(transform).toContain('translateX(208px)')
    })
  })

  it('应该支持重试功能', async () => {
    const { container } = render(<SliderVerify {...defaultProps} />)
    
    const retryButton = container.querySelector('.retry-button')
    expect(retryButton).toBeTruthy()

    // 点击重试按钮
    fireEvent.click(retryButton!)

    // 验证组件重置
    await waitFor(() => {
      const sliderButton = container.querySelector('.slider-button')
      const transform = sliderButton!.style.transform
      expect(transform).toContain('translateX(0px)')
    })
  })

  it('应该正确处理触摸事件的边界情况', async () => {
    const { container } = render(<SliderVerify {...defaultProps} />)
    
    const sliderButton = container.querySelector('.slider-button')
    
    // 测试没有touches的情况
    fireEvent.touchStart(sliderButton!, { touches: [] })
    fireEvent.touchMove(sliderButton!, { touches: [] })
    fireEvent.touchEnd(sliderButton!)

    // 应该不会崩溃，组件应该保持稳定状态
    expect(container.querySelector('.slider-verify')).toBeTruthy()
  })

  it('应该在已验证状态下阻止新的拖拽操作', async () => {
    const { container } = render(<SliderVerify {...defaultProps} />)

    // Mock成功的API响应
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        verified: true,
        token: 'test_token_123'
      }
    })

    const sliderButton = container.querySelector('.slider-button')
    
    // 第一次拖拽成功
    fireEvent.touchStart(sliderButton!, {
      touches: [{ clientX: 10, clientY: 20 }]
    })
    fireEvent.touchMove(sliderButton!, {
      touches: [{ clientX: 110, clientY: 20 }]
    })
    fireEvent.touchEnd(sliderButton!)

    await waitFor(() => {
      expect(sliderButton).toHaveClass('verified')
    })

    // 尝试第二次拖拽
    fireEvent.touchStart(sliderButton!, {
      touches: [{ clientX: 10, clientY: 20 }]
    })

    // 应该不会开始新的拖拽
    expect(sliderButton).not.toHaveClass('moving')
  })
})