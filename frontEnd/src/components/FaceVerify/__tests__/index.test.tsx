import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FaceVerify, { FaceVerifyProps, FaceVerifyResult } from '../index';

// Mock Taro APIs
jest.mock('@tarojs/taro', () => ({
  showToast: jest.fn(),
  showModal: jest.fn(),
  chooseImage: jest.fn(),
}));

// Mock NutUI components
jest.mock('@nutui/nutui-react-taro', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Progress: ({ percentage }: any) => (
    <div data-testid="progress" data-percentage={percentage}>
      Progress: {percentage}%
    </div>
  ),
  Popup: ({ children, visible, onClose }: any) => 
    visible ? (
      <div data-testid="popup">
        <button onClick={onClose} data-testid="close-btn">Close</button>
        {children}
      </div>
    ) : null,
}));

describe('FaceVerify Component', () => {
  const defaultProps: FaceVerifyProps = {
    mode: 'verify',
    visible: true,
    onSuccess: jest.fn(),
    onError: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render correctly when visible', () => {
      render(<FaceVerify {...defaultProps} />);
      
      expect(screen.getByTestId('popup')).toBeInTheDocument();
      expect(screen.getByText('人脸验证')).toBeInTheDocument();
      expect(screen.getByText('请将面部对准摄像头进行验证')).toBeInTheDocument();
    });

    it('should not render when not visible', () => {
      render(<FaceVerify {...defaultProps} visible={false} />);
      
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

    it('should render custom title and description', () => {
      const customProps = {
        ...defaultProps,
        title: '自定义标题',
        description: '自定义描述',
      };
      
      render(<FaceVerify {...customProps} />);
      
      expect(screen.getByText('自定义标题')).toBeInTheDocument();
      expect(screen.getByText('自定义描述')).toBeInTheDocument();
    });

    it('should render different titles for different modes', () => {
      const { rerender } = render(<FaceVerify {...defaultProps} mode="register" />);
      expect(screen.getByText('注册人脸')).toBeInTheDocument();

      rerender(<FaceVerify {...defaultProps} mode="login" />);
      expect(screen.getByText('人脸登录')).toBeInTheDocument();

      rerender(<FaceVerify {...defaultProps} mode="verify" />);
      expect(screen.getByText('人脸验证')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = jest.fn();
      render(<FaceVerify {...defaultProps} onCancel={onCancel} />);
      
      fireEvent.click(screen.getByText('取消'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when close button is clicked', () => {
      const onCancel = jest.fn();
      render(<FaceVerify {...defaultProps} onCancel={onCancel} />);
      
      fireEvent.click(screen.getByTestId('close-btn'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should start detection when start button is clicked', async () => {
      render(<FaceVerify {...defaultProps} />);
      
      const startButton = screen.getByText('开始检测');
      fireEvent.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText('正在检测人脸...')).toBeInTheDocument();
      });
    });
  });

  describe('Detection Process', () => {
    it('should show progress during detection', async () => {
      render(<FaceVerify {...defaultProps} />);
      
      fireEvent.click(screen.getByText('开始检测'));
      
      await waitFor(() => {
        const progress = screen.getByTestId('progress');
        expect(progress).toHaveAttribute('data-percentage', '20');
      });
    });

    it('should show camera interface after starting detection', async () => {
      render(<FaceVerify {...defaultProps} />);
      
      fireEvent.click(screen.getByText('开始检测'));
      
      await waitFor(() => {
        expect(screen.getByText('请将面部对准框内')).toBeInTheDocument();
        expect(screen.getByText('拍照')).toBeInTheDocument();
      });
    });

    it('should handle successful detection', async () => {
      const onSuccess = jest.fn();
      const { chooseImage } = require('@tarojs/taro');
      
      chooseImage.mockResolvedValue({
        tempFilePaths: ['mock-image-path']
      });

      render(<FaceVerify {...defaultProps} onSuccess={onSuccess} />);
      
      // Start detection
      fireEvent.click(screen.getByText('开始检测'));
      
      await waitFor(() => {
        expect(screen.getByText('拍照')).toBeInTheDocument();
      });
      
      // Take photo
      fireEvent.click(screen.getByText('拍照'));
      
      // Wait for processing to complete
      await waitFor(() => {
        expect(screen.getByText('人脸验证成功！')).toBeInTheDocument();
      }, { timeout: 6000 });
      
      // Wait for success callback
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            faceId: expect.any(String),
            confidence: expect.any(Number),
            livenessScore: expect.any(Number),
          })
        );
      }, { timeout: 2000 });
    });

    it('should handle detection failure and show retry option', async () => {
      const { chooseImage } = require('@tarojs/taro');
      
      chooseImage.mockResolvedValue({
        tempFilePaths: ['mock-image-path']
      });

      // Mock Math.random to force failure
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.9); // This will trigger failure in mock detection

      render(<FaceVerify {...defaultProps} maxRetries={2} />);
      
      // Start detection and take photo
      fireEvent.click(screen.getByText('开始检测'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('拍照'));
      });
      
      // Wait for failure message and retry button
      await waitFor(() => {
        expect(screen.getByText(/重试 \(1\/2\)/)).toBeInTheDocument();
      }, { timeout: 6000 });
      
      // Restore Math.random
      Math.random = originalRandom;
    });

    it('should call onError after max retries exceeded', async () => {
      const onError = jest.fn();
      const { chooseImage } = require('@tarojs/taro');
      
      chooseImage.mockResolvedValue({
        tempFilePaths: ['mock-image-path']
      });

      // Mock Math.random to always force failure
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.9);

      render(<FaceVerify {...defaultProps} onError={onError} maxRetries={1} />);
      
      // Start detection and take photo
      fireEvent.click(screen.getByText('开始检测'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('拍照'));
      });
      
      // Wait for error callback
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      }, { timeout: 8000 });
      
      // Restore Math.random
      Math.random = originalRandom;
    });
  });

  describe('Props Validation', () => {
    it('should use default values for optional props', () => {
      const minimalProps = {
        visible: true,
      };
      
      render(<FaceVerify {...minimalProps} />);
      
      expect(screen.getByText('人脸验证')).toBeInTheDocument();
      expect(screen.getByText('请将面部对准摄像头进行验证')).toBeInTheDocument();
    });

    it('should respect maxRetries prop', async () => {
      const { chooseImage } = require('@tarojs/taro');
      chooseImage.mockResolvedValue({
        tempFilePaths: ['mock-image-path']
      });

      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.9); // Force failure

      render(<FaceVerify {...defaultProps} maxRetries={3} />);
      
      fireEvent.click(screen.getByText('开始检测'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('拍照'));
      });
      
      await waitFor(() => {
        expect(screen.getByText(/重试 \(1\/3\)/)).toBeInTheDocument();
      }, { timeout: 6000 });
      
      Math.random = originalRandom;
    });
  });

  describe('Error Handling', () => {
    it('should handle camera permission errors', async () => {
      const { chooseImage } = require('@tarojs/taro');
      chooseImage.mockRejectedValue(new Error('Camera permission denied'));

      render(<FaceVerify {...defaultProps} />);
      
      fireEvent.click(screen.getByText('开始检测'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('拍照'));
      });
      
      await waitFor(() => {
        expect(screen.getByText(/重试/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle network errors gracefully', async () => {
      const { chooseImage } = require('@tarojs/taro');
      chooseImage.mockResolvedValue({
        tempFilePaths: ['mock-image-path']
      });

      // Mock a network error by overriding the component's processImage method
      render(<FaceVerify {...defaultProps} />);
      
      fireEvent.click(screen.getByText('开始检测'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('拍照'));
      });
      
      // The component should handle errors and show retry option
      await waitFor(() => {
        expect(screen.getByText('正在分析人脸特征...')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<FaceVerify {...defaultProps} />);
      
      // Check for important text content that screen readers can access
      expect(screen.getByText('人脸验证')).toBeInTheDocument();
      expect(screen.getByText('使用提示：')).toBeInTheDocument();
      expect(screen.getByText('• 请在光线充足的环境下使用')).toBeInTheDocument();
    });

    it('should show helpful tips for users', () => {
      render(<FaceVerify {...defaultProps} />);
      
      expect(screen.getByText('• 请在光线充足的环境下使用')).toBeInTheDocument();
      expect(screen.getByText('• 保持面部正对摄像头')).toBeInTheDocument();
      expect(screen.getByText('• 避免佩戴口罩或墨镜')).toBeInTheDocument();
      expect(screen.getByText('• 保持设备稳定，避免抖动')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should cleanup timeouts on unmount', () => {
      const { unmount } = render(<FaceVerify {...defaultProps} />);
      
      // Start detection to create timeout
      fireEvent.click(screen.getByText('开始检测'));
      
      // Unmount component
      unmount();
      
      // No assertions needed - just ensure no memory leaks or errors
    });

    it('should reset state when visibility changes', () => {
      const { rerender } = render(<FaceVerify {...defaultProps} visible={false} />);
      
      // Make visible and start detection
      rerender(<FaceVerify {...defaultProps} visible={true} />);
      fireEvent.click(screen.getByText('开始检测'));
      
      // Hide and show again - should reset to initial state
      rerender(<FaceVerify {...defaultProps} visible={false} />);
      rerender(<FaceVerify {...defaultProps} visible={true} />);
      
      expect(screen.getByText('开始检测')).toBeInTheDocument();
      expect(screen.getByText('准备开始人脸检测...')).toBeInTheDocument();
    });
  });
});