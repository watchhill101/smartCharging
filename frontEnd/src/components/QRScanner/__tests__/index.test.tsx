import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QRScanner, { ScanResult } from '../index';

// Mock Taro
const mockGetSetting = jest.fn();
const mockAuthorize = jest.fn();
const mockChooseImage = jest.fn();
const mockOpenSetting = jest.fn();

jest.mock('@tarojs/taro', () => ({
  getSetting: mockGetSetting,
  authorize: mockAuthorize,
  chooseImage: mockChooseImage,
  openSetting: mockOpenSetting
}));

// Mock NutUI Toast and Dialog
const mockToastShow = jest.fn();
const mockDialogConfirm = jest.fn();

jest.mock('@nutui/nutui-react-taro', () => ({
  ...jest.requireActual('@nutui/nutui-react-taro'),
  Toast: {
    show: mockToastShow
  },
  Dialog: {
    confirm: mockDialogConfirm
  }
}));

describe('QRScanner Component', () => {
  const mockProps = {
    visible: true,
    onScanSuccess: jest.fn(),
    onScanError: jest.fn(),
    onClose: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockResolvedValue({
      authSetting: {
        'scope.camera': true
      }
    });
  });

  it('应该正确渲染扫描器界面', async () => {
    const { getByText } = render(<QRScanner {...mockProps} />);
    
    await waitFor(() => {
      expect(getByText('扫描二维码')).toBeInTheDocument();
      expect(getByText('将二维码放入框内，即可自动扫描')).toBeInTheDocument();
    });
  });

  it('应该在不可见时不渲染', () => {
    const { container } = render(<QRScanner {...mockProps} visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('应该正确处理相机权限检查', async () => {
    mockGetSetting.mockResolvedValue({
      authSetting: {
        'scope.camera': undefined
      }
    });
    mockAuthorize.mockResolvedValue({});

    render(<QRScanner {...mockProps} />);

    await waitFor(() => {
      expect(mockGetSetting).toHaveBeenCalled();
      expect(mockAuthorize).toHaveBeenCalledWith({ scope: 'scope.camera' });
    });
  });

  it('应该在权限被拒绝时显示设置引导', async () => {
    mockGetSetting.mockResolvedValue({
      authSetting: {
        'scope.camera': false
      }
    });

    render(<QRScanner {...mockProps} />);

    await waitFor(() => {
      expect(mockDialogConfirm).toHaveBeenCalledWith({
        title: '需要相机权限',
        content: '扫描二维码需要使用相机，请在设置中开启相机权限',
        confirmText: '去设置',
        cancelText: '取消',
        onConfirm: expect.any(Function)
      });
    });
  });

  it('应该正确处理扫描成功', async () => {
    const { container } = render(<QRScanner {...mockProps} />);
    
    await waitFor(() => {
      expect(container.querySelector('.camera-view')).toBeInTheDocument();
    });

    // 模拟扫描成功事件
    const mockScanResult = {
      detail: {
        result: 'A001',
        scanType: 'qr'
      }
    };

    const cameraElement = container.querySelector('.camera-view');
    if (cameraElement) {
      fireEvent(cameraElement, new CustomEvent('scancode', mockScanResult));
    }

    await waitFor(() => {
      expect(mockProps.onScanSuccess).toHaveBeenCalledWith({
        result: 'A001',
        scanType: 'qr',
        charSet: undefined,
        path: undefined
      });
    });
  });

  it('应该正确处理扫描失败', async () => {
    const { container } = render(<QRScanner {...mockProps} />);
    
    await waitFor(() => {
      expect(container.querySelector('.camera-view')).toBeInTheDocument();
    });

    // 模拟扫描失败事件
    const mockErrorEvent = {
      detail: {
        errMsg: '扫描失败'
      }
    };

    const cameraElement = container.querySelector('.camera-view');
    if (cameraElement) {
      fireEvent(cameraElement, new CustomEvent('error', mockErrorEvent));
    }

    await waitFor(() => {
      expect(mockProps.onScanError).toHaveBeenCalledWith('扫描失败');
    });
  });

  it('应该正确切换闪光灯', async () => {
    const { getByText } = render(<QRScanner {...mockProps} showFlashlight={true} />);
    
    await waitFor(() => {
      const flashlightBtn = getByText('💡');
      expect(flashlightBtn).toBeInTheDocument();
      
      fireEvent.click(flashlightBtn);
      // 验证闪光灯状态切换
    });
  });

  it('应该正确处理相册选择', async () => {
    mockChooseImage.mockResolvedValue({
      tempFilePaths: ['temp://image.jpg']
    });

    const { getByText } = render(<QRScanner {...mockProps} showGallery={true} />);
    
    await waitFor(() => {
      const galleryBtn = getByText('📷 相册');
      expect(galleryBtn).toBeInTheDocument();
      
      fireEvent.click(galleryBtn);
    });

    await waitFor(() => {
      expect(mockChooseImage).toHaveBeenCalledWith({
        count: 1,
        sizeType: ['original'],
        sourceType: ['album']
      });
    });
  });

  it('应该正确处理手动输入', async () => {
    const { getByText, getByPlaceholderText } = render(
      <QRScanner {...mockProps} showManualInput={true} />
    );
    
    await waitFor(() => {
      const manualBtn = getByText('⌨️ 手动输入');
      expect(manualBtn).toBeInTheDocument();
      
      fireEvent.click(manualBtn);
    });

    await waitFor(() => {
      const input = getByPlaceholderText('请输入充电桩编号');
      expect(input).toBeInTheDocument();
      
      fireEvent.input(input, { detail: { value: 'A001' } });
      
      const confirmBtn = getByText('确认');
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(mockProps.onScanSuccess).toHaveBeenCalledWith({
        result: 'A001',
        scanType: 'manual'
      });
    });
  });

  it('应该正确验证扫描结果格式', async () => {
    const { container } = render(<QRScanner {...mockProps} />);
    
    await waitFor(() => {
      expect(container.querySelector('.camera-view')).toBeInTheDocument();
    });

    // 测试无效格式
    const invalidScanResult = {
      detail: {
        result: 'xx',
        scanType: 'qr'
      }
    };

    const cameraElement = container.querySelector('.camera-view');
    if (cameraElement) {
      fireEvent(cameraElement, new CustomEvent('scancode', invalidScanResult));
    }

    await waitFor(() => {
      expect(mockProps.onScanError).toHaveBeenCalledWith('无效的二维码格式');
      expect(mockToastShow).toHaveBeenCalledWith({
        content: '无效的二维码格式',
        type: 'error',
        duration: 2000
      });
    });
  });

  it('应该正确处理关闭操作', async () => {
    const { getByText } = render(<QRScanner {...mockProps} />);
    
    await waitFor(() => {
      const closeBtn = getByText('✕');
      expect(closeBtn).toBeInTheDocument();
      
      fireEvent.click(closeBtn);
    });

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('应该在连续扫描模式下保持开启', async () => {
    const { container } = render(<QRScanner {...mockProps} continuous={true} />);
    
    await waitFor(() => {
      expect(container.querySelector('.camera-view')).toBeInTheDocument();
    });

    // 模拟扫描成功
    const mockScanResult = {
      detail: {
        result: 'A001',
        scanType: 'qr'
      }
    };

    const cameraElement = container.querySelector('.camera-view');
    if (cameraElement) {
      fireEvent(cameraElement, new CustomEvent('scancode', mockScanResult));
    }

    await waitFor(() => {
      expect(mockProps.onScanSuccess).toHaveBeenCalled();
      // 在连续模式下，扫描器应该保持开启，不调用 onClose
      expect(mockProps.onClose).not.toHaveBeenCalled();
    });
  });

  it('应该正确处理自定义文案', () => {
    const customText = {
      title: '自定义标题',
      tip: '自定义提示',
      gallery: '自定义相册',
      manual: '自定义手动输入',
      flashlight: '自定义闪光灯',
      inputPlaceholder: '自定义占位符',
      inputConfirm: '自定义确认',
      inputCancel: '自定义取消'
    };

    const { getByText } = render(
      <QRScanner {...mockProps} text={customText} />
    );

    expect(getByText('自定义标题')).toBeInTheDocument();
    expect(getByText('自定义提示')).toBeInTheDocument();
  });

  it('应该正确处理自定义扫描区域配置', async () => {
    const { container } = render(
      <QRScanner 
        {...mockProps} 
        scanAreaSize={150}
        scanAreaColor="#ff0000"
      />
    );
    
    await waitFor(() => {
      const scanArea = container.querySelector('.scan-area');
      expect(scanArea).toHaveStyle({
        width: '150px',
        height: '150px',
        borderColor: '#ff0000'
      });
    });
  });

  it('应该在权限授权失败时正确处理', async () => {
    mockGetSetting.mockResolvedValue({
      authSetting: {
        'scope.camera': undefined
      }
    });
    mockAuthorize.mockRejectedValue(new Error('授权失败'));

    render(<QRScanner {...mockProps} />);

    await waitFor(() => {
      expect(mockProps.onScanError).toHaveBeenCalledWith('相机权限授权失败');
    });
  });

  it('应该正确处理相册选择失败', async () => {
    mockChooseImage.mockRejectedValue(new Error('选择失败'));

    const { getByText } = render(<QRScanner {...mockProps} showGallery={true} />);
    
    await waitFor(() => {
      const galleryBtn = getByText('📷 相册');
      fireEvent.click(galleryBtn);
    });

    await waitFor(() => {
      expect(mockToastShow).toHaveBeenCalledWith({
        content: '选择图片失败',
        type: 'error',
        duration: 2000
      });
    });
  });

  it('应该正确处理手动输入验证', async () => {
    const { getByText, getByPlaceholderText } = render(
      <QRScanner {...mockProps} showManualInput={true} />
    );
    
    // 打开手动输入
    await waitFor(() => {
      const manualBtn = getByText('⌨️ 手动输入');
      fireEvent.click(manualBtn);
    });

    // 测试空输入
    await waitFor(() => {
      const confirmBtn = getByText('确认');
      fireEvent.click(confirmBtn);
    });

    expect(mockToastShow).toHaveBeenCalledWith({
      content: '请输入充电桩编号',
      type: 'warning',
      duration: 2000
    });

    // 测试无效输入
    await waitFor(() => {
      const input = getByPlaceholderText('请输入充电桩编号');
      fireEvent.input(input, { detail: { value: 'xx' } });
      
      const confirmBtn = getByText('确认');
      fireEvent.click(confirmBtn);
    });

    expect(mockToastShow).toHaveBeenCalledWith({
      content: '请输入有效的充电桩编号',
      type: 'error',
      duration: 2000
    });
  });
});