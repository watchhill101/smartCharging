import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StationDetail, { StationDetailData, ChargingPile } from '../index';

// Mock Taro
jest.mock('@tarojs/taro', () => ({
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  makePhoneCall: jest.fn(),
  openLocation: jest.fn()
}));

// Mock NutUI Toast
jest.mock('@nutui/nutui-react-taro', () => ({
  ...jest.requireActual('@nutui/nutui-react-taro'),
  Toast: {
    show: jest.fn()
  }
}));

describe('StationDetail Component', () => {
  const mockStationData: StationDetailData = {
    stationId: 'test_station_001',
    name: '测试充电站',
    address: '测试地址123号',
    location: {
      latitude: 39.9042,
      longitude: 116.4074
    },
    distance: 500,
    city: '北京市',
    district: '朝阳区',
    province: '北京市',
    
    operator: {
      name: '测试运营商',
      phone: '400-123-4567'
    },
    
    piles: [
      {
        pileId: 'pile_001',
        pileNumber: 'A01',
        type: 'DC',
        power: 60,
        voltage: 380,
        current: 125,
        connectorType: ['GB/T', 'CCS'],
        status: 'available',
        price: {
          servicePrice: 0.8,
          electricityPrice: 0.6
        }
      },
      {
        pileId: 'pile_002',
        pileNumber: 'A02',
        type: 'AC',
        power: 7,
        voltage: 220,
        current: 32,
        connectorType: ['GB/T'],
        status: 'occupied',
        price: {
          servicePrice: 0.5,
          electricityPrice: 0.6
        }
      }
    ],
    totalPiles: 2,
    availablePiles: 1,
    
    openTime: {
      start: '06:00',
      end: '22:00',
      is24Hours: false
    },
    
    services: ['parking', 'wifi'],
    
    priceRange: {
      minServicePrice: 0.5,
      maxServicePrice: 0.8,
      minElectricityPrice: 0.6,
      maxElectricityPrice: 0.6
    },
    
    rating: {
      average: 4.5,
      count: 50,
      distribution: {
        5: 25,
        4: 15,
        3: 8,
        2: 2,
        1: 0
      }
    },
    
    images: ['test-image-1.jpg', 'test-image-2.jpg'],
    description: '这是一个测试充电站',
    
    contact: {
      phone: '010-12345678'
    },
    
    status: 'active',
    isVerified: true,
    
    stats: {
      totalSessions: 100,
      totalEnergy: 500.5,
      averageSessionDuration: 30,
      peakHours: ['08:00-10:00']
    },
    
    occupancyRate: 50,
    isOpen: true
  };

  const mockProps = {
    stationData: mockStationData,
    loading: false,
    onNavigate: jest.fn(),
    onStartCharging: jest.fn(),
    onFavorite: jest.fn(),
    onRate: jest.fn(),
    onReport: jest.fn(),
    onCall: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该正确渲染充电站基本信息', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    expect(getByText('测试充电站')).toBeInTheDocument();
    expect(getByText('📍 测试地址123号')).toBeInTheDocument();
    expect(getByText('🏢 测试运营商')).toBeInTheDocument();
    expect(getByText('⚡ 1/2 可用')).toBeInTheDocument();
  });

  it('应该正确显示充电桩信息', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    expect(getByText('#A01')).toBeInTheDocument();
    expect(getByText('#A02')).toBeInTheDocument();
    expect(getByText('DC')).toBeInTheDocument();
    expect(getByText('AC')).toBeInTheDocument();
    expect(getByText('60kW')).toBeInTheDocument();
    expect(getByText('7kW')).toBeInTheDocument();
  });

  it('应该正确显示充电桩状态', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    expect(getByText('✅')).toBeInTheDocument(); // available状态图标
    expect(getByText('🔋')).toBeInTheDocument(); // occupied状态图标
    expect(getByText('可用')).toBeInTheDocument();
    expect(getByText('使用中')).toBeInTheDocument();
  });

  it('应该正确处理导航点击', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    const navButton = getByText('🧭 导航');
    fireEvent.click(navButton);
    
    expect(mockProps.onNavigate).toHaveBeenCalledWith(mockStationData);
  });

  it('应该正确处理开始充电点击', () => {
    const { getAllByText } = render(<StationDetail {...mockProps} />);
    
    const chargingButtons = getAllByText('开始充电');
    fireEvent.click(chargingButtons[0]);
    
    expect(mockProps.onStartCharging).toHaveBeenCalledWith(
      mockStationData,
      mockStationData.piles[0]
    );
  });

  it('应该正确处理收藏功能', async () => {
    const Taro = require('@tarojs/taro');
    Taro.getStorageSync.mockReturnValue([]);
    Taro.setStorageSync.mockResolvedValue(undefined);

    const { getByText } = render(<StationDetail {...mockProps} />);
    
    const favoriteButton = getByText('🤍 收藏');
    fireEvent.click(favoriteButton);
    
    await waitFor(() => {
      expect(mockProps.onFavorite).toHaveBeenCalledWith(mockStationData, true);
    });
  });

  it('应该正确显示服务设施', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    expect(getByText('🅿️')).toBeInTheDocument(); // 停车场图标
    expect(getByText('📶')).toBeInTheDocument(); // WiFi图标
    expect(getByText('停车场')).toBeInTheDocument();
    expect(getByText('WiFi')).toBeInTheDocument();
  });

  it('应该正确显示价格信息', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    expect(getByText('0.5-0.8元/kWh')).toBeInTheDocument();
    expect(getByText('0.6-0.6元/kWh')).toBeInTheDocument();
  });

  it('应该正确显示评分信息', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    expect(getByText('4.5 (50)')).toBeInTheDocument();
  });

  it('应该正确处理拨打电话', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    const phoneCell = getByText('400-123-4567').closest('.contact-cell');
    if (phoneCell) {
      fireEvent.click(phoneCell);
      expect(mockProps.onCall).toHaveBeenCalledWith('400-123-4567');
    }
  });

  it('应该在加载状态下显示加载指示器', () => {
    const { getByText } = render(
      <StationDetail {...mockProps} loading={true} stationData={undefined} />
    );
    
    expect(getByText('加载中...')).toBeInTheDocument();
  });

  it('应该在没有数据时显示错误信息', () => {
    const { getByText } = render(
      <StationDetail {...mockProps} loading={false} stationData={undefined} />
    );
    
    expect(getByText('充电站信息不存在')).toBeInTheDocument();
  });

  it('应该正确显示营业状态', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    expect(getByText('🟢 营业中')).toBeInTheDocument();
    expect(getByText('06:00 - 22:00')).toBeInTheDocument();
  });

  it('应该正确显示统计信息', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    expect(getByText('100')).toBeInTheDocument(); // 总充电次数
    expect(getByText('500.5')).toBeInTheDocument(); // 总充电量
    expect(getByText('30')).toBeInTheDocument(); // 平均时长
    expect(getByText('50%')).toBeInTheDocument(); // 使用率
  });

  it('应该正确处理充电桩详情点击', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    const pileCard = getByText('#A01').closest('.pile-card');
    if (pileCard) {
      fireEvent.click(pileCard);
      // 应该显示充电桩详情弹窗
      expect(getByText('充电桩 #A01')).toBeInTheDocument();
    }
  });

  it('应该正确处理评分弹窗', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    const rateButton = getByText('评分');
    fireEvent.click(rateButton);
    
    expect(getByText('为充电站评分')).toBeInTheDocument();
  });

  it('应该正确处理问题反馈', () => {
    const { getByText } = render(<StationDetail {...mockProps} />);
    
    const reportButton = getByText('🚨 反馈问题');
    fireEvent.click(reportButton);
    
    // 应该显示问题选择菜单
    expect(getByText('请选择问题类型')).toBeInTheDocument();
  });

  it('应该正确显示距离信息', () => {
    const { getByText } = render(
      <StationDetail 
        {...mockProps} 
        currentLocation={{ 
          latitude: 39.9, 
          longitude: 116.4, 
          address: '', 
          city: '', 
          district: '', 
          province: '' 
        }} 
      />
    );
    
    expect(getByText('📏 距离您 500m')).toBeInTheDocument();
  });
});