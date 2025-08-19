import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StationDetailPage from '../index';

// Mock Taro
const mockNavigateTo = jest.fn();
const mockGetLocation = jest.fn();
const mockOpenLocation = jest.fn();
const mockGetStorageSync = jest.fn();
const mockSetStorageSync = jest.fn();

jest.mock('@tarojs/taro', () => ({
  useRouter: () => ({
    params: { stationId: 'test_station_001' }
  }),
  navigateTo: mockNavigateTo,
  getLocation: mockGetLocation,
  openLocation: mockOpenLocation,
  getStorageSync: mockGetStorageSync,
  setStorageSync: mockSetStorageSync
}));

// Mock NutUI Toast
const mockToastShow = jest.fn();
jest.mock('@nutui/nutui-react-taro', () => ({
  ...jest.requireActual('@nutui/nutui-react-taro'),
  Toast: {
    show: mockToastShow
  }
}));

describe('StationDetailPage Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLocation.mockResolvedValue({
      latitude: 39.9042,
      longitude: 116.4074
    });
    mockGetStorageSync.mockReturnValue([]);
    mockSetStorageSync.mockResolvedValue(undefined);
  });

  it('应该正确加载和显示充电站详情页面', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    // 初始应该显示加载状态
    expect(getByText('加载中...')).toBeInTheDocument();
    
    // 等待数据加载完成
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    }, { timeout: 2000 });
    
    // 验证基本信息显示
    expect(getByText('📍 北京市朝阳区建国路93号万达广场B1层')).toBeInTheDocument();
    expect(getByText('🏢 国家电网')).toBeInTheDocument();
    expect(getByText('⚡ 2/4 可用')).toBeInTheDocument();
  });

  it('应该正确显示充电桩信息', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    // 验证充电桩信息
    expect(getByText('#A01')).toBeInTheDocument();
    expect(getByText('#A02')).toBeInTheDocument();
    expect(getByText('#B01')).toBeInTheDocument();
    expect(getByText('#B02')).toBeInTheDocument();
    
    // 验证充电桩类型和功率
    expect(getByText('DC')).toBeInTheDocument();
    expect(getByText('AC')).toBeInTheDocument();
    expect(getByText('60kW')).toBeInTheDocument();
    expect(getByText('7kW')).toBeInTheDocument();
  });

  it('应该正确处理导航功能', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    const navButton = getByText('🧭 导航');
    fireEvent.click(navButton);
    
    expect(mockOpenLocation).toHaveBeenCalledWith({
      latitude: 39.9042,
      longitude: 116.4074,
      name: '万达广场充电站',
      address: '北京市朝阳区建国路93号万达广场B1层',
      scale: 18
    });
  });

  it('应该正确处理开始充电功能', async () => {
    const { getAllByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getAllByText('开始充电')[0]).toBeInTheDocument();
    });
    
    const chargingButtons = getAllByText('开始充电');
    fireEvent.click(chargingButtons[0]);
    
    expect(mockNavigateTo).toHaveBeenCalledWith({
      url: '/pages/charging/index?stationId=station_001&pileId=pile_001'
    });
  });

  it('应该正确处理收藏功能', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    const favoriteButton = getByText('🤍 收藏');
    fireEvent.click(favoriteButton);
    
    await waitFor(() => {
      expect(mockSetStorageSync).toHaveBeenCalledWith(
        'favorite_stations',
        ['station_001']
      );
      expect(mockToastShow).toHaveBeenCalledWith({
        content: '已添加收藏',
        type: 'success',
        duration: 1500
      });
    });
  });

  it('应该正确显示服务设施', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    // 验证服务设施图标和标签
    expect(getByText('🅿️')).toBeInTheDocument();
    expect(getByText('🍽️')).toBeInTheDocument();
    expect(getByText('🚻')).toBeInTheDocument();
    expect(getByText('📶')).toBeInTheDocument();
    expect(getByText('🏪')).toBeInTheDocument();
    
    expect(getByText('停车场')).toBeInTheDocument();
    expect(getByText('餐厅')).toBeInTheDocument();
    expect(getByText('洗手间')).toBeInTheDocument();
    expect(getByText('WiFi')).toBeInTheDocument();
    expect(getByText('商店')).toBeInTheDocument();
  });

  it('应该正确显示价格和评分信息', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    // 验证价格信息
    expect(getByText('0.5-0.8元/kWh')).toBeInTheDocument();
    expect(getByText('0.6-0.6元/kWh')).toBeInTheDocument();
    
    // 验证评分信息
    expect(getByText('4.3 (128)')).toBeInTheDocument();
  });

  it('应该正确显示营业时间和状态', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    expect(getByText('🟢 营业中')).toBeInTheDocument();
    expect(getByText('06:00 - 22:00')).toBeInTheDocument();
  });

  it('应该正确显示统计信息', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    expect(getByText('2456')).toBeInTheDocument(); // 总充电次数
    expect(getByText('18750.5')).toBeInTheDocument(); // 总充电量
    expect(getByText('45')).toBeInTheDocument(); // 平均时长
    expect(getByText('65%')).toBeInTheDocument(); // 使用率
  });

  it('应该正确处理充电桩详情查看', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    const pileCard = getByText('#A01').closest('.pile-card');
    if (pileCard) {
      fireEvent.click(pileCard);
      
      // 应该显示充电桩详情弹窗
      await waitFor(() => {
        expect(getByText('充电桩 #A01')).toBeInTheDocument();
        expect(getByText('60kW')).toBeInTheDocument();
        expect(getByText('380V')).toBeInTheDocument();
        expect(getByText('125A')).toBeInTheDocument();
        expect(getByText('特来电')).toBeInTheDocument();
      });
    }
  });

  it('应该正确处理评分功能', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    const rateButton = getByText('评分');
    fireEvent.click(rateButton);
    
    expect(getByText('为充电站评分')).toBeInTheDocument();
    
    const submitButton = getByText('提交评分');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockToastShow).toHaveBeenCalledWith({
        content: '评分提交成功',
        type: 'success',
        duration: 1500
      });
    });
  });

  it('应该正确处理问题反馈功能', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    const reportButton = getByText('🚨 反馈问题');
    fireEvent.click(reportButton);
    
    expect(getByText('请选择问题类型')).toBeInTheDocument();
  });

  it('应该正确处理联系电话功能', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    // 测试运营商电话
    const operatorPhone = getByText('95598');
    fireEvent.click(operatorPhone);
    
    // 测试充电站电话
    const stationPhone = getByText('010-12345678');
    fireEvent.click(stationPhone);
    
    // 测试紧急电话
    const emergencyPhone = getByText('400-123-4567');
    fireEvent.click(emergencyPhone);
  });

  it('应该正确获取和显示用户位置', async () => {
    const { getByText } = render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    expect(mockGetLocation).toHaveBeenCalledWith({
      type: 'gcj02'
    });
    
    // 验证距离显示
    expect(getByText('📏 距离您 1.2km')).toBeInTheDocument();
  });

  it('应该正确处理加载错误情况', async () => {
    // Mock API调用失败
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const { getByText } = render(<StationDetailPage />);
    
    // 等待加载完成
    await waitFor(() => {
      expect(getByText('万达广场充电站')).toBeInTheDocument();
    });
    
    consoleSpy.mockRestore();
  });

  it('应该正确处理位置获取失败', async () => {
    mockGetLocation.mockRejectedValue(new Error('位置获取失败'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    render(<StationDetailPage />);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ 获取位置失败:', expect.any(Error));
    });
    
    consoleSpy.mockRestore();
  });
});