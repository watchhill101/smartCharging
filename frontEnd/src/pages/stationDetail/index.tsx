import React, { useState, useEffect } from 'react';
import { View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Toast } from '@nutui/nutui-react-taro';
import StationDetail, { StationDetailData, ChargingPile } from '../../components/StationDetail';
import { LocationInfo } from '../../services/AmapService';
import './index.scss';
import { TIME_CONSTANTS } from '../../utils/constants';

const StationDetailPage: React.FC = () => {
  const router = useRouter();
  const { stationId } = router.params;

  const [loading, setLoading] = useState(true);
  const [stationData, setStationData] = useState<StationDetailData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationInfo | null>(null);

  // 模拟充电站数据
  const mockStationData: StationDetailData = {
    stationId: stationId || 'station_001',
    name: '万达广场充电站',
    address: '北京市朝阳区建国路93号万达广场B1层',
    location: {
      latitude: 39.9042,
      longitude: 116.4074
    },
    distance: 1200,
    city: '北京市',
    district: '朝阳区',
    province: '北京市',
    
    operator: {
      name: '国家电网',
      phone: '95598',
      email: 'service@sgcc.com.cn',
      website: 'https://www.sgcc.com.cn'
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
          electricityPrice: 0.6,
          parkingPrice: 5
        },
        manufacturer: '特来电',
        model: 'TLD-60kW-001'
      },
      {
        pileId: 'pile_002',
        pileNumber: 'A02',
        type: 'DC',
        power: 60,
        voltage: 380,
        current: 125,
        connectorType: ['GB/T', 'CCS'],
        status: 'occupied',
        price: {
          servicePrice: 0.8,
          electricityPrice: 0.6,
          parkingPrice: 5
        },
        manufacturer: '特来电',
        model: 'TLD-60kW-001'
      },
      {
        pileId: 'pile_003',
        pileNumber: 'B01',
        type: 'AC',
        power: 7,
        voltage: 220,
        current: 32,
        connectorType: ['GB/T'],
        status: 'available',
        price: {
          servicePrice: 0.5,
          electricityPrice: 0.6
        },
        manufacturer: '星星充电',
        model: 'XC-7kW-002'
      },
      {
        pileId: 'pile_004',
        pileNumber: 'B02',
        type: 'AC',
        power: 7,
        voltage: 220,
        current: 32,
        connectorType: ['GB/T'],
        status: 'maintenance',
        price: {
          servicePrice: 0.5,
          electricityPrice: 0.6
        },
        manufacturer: '星星充电',
        model: 'XC-7kW-002'
      }
    ],
    totalPiles: 4,
    availablePiles: 2,
    
    openTime: {
      start: '06:00',
      end: '22:00',
      is24Hours: false
    },
    
    services: ['parking', 'restaurant', 'restroom', 'wifi', 'shop'],
    
    priceRange: {
      minServicePrice: 0.5,
      maxServicePrice: 0.8,
      minElectricityPrice: 0.6,
      maxElectricityPrice: 0.6
    },
    
    rating: {
      average: 4.3,
      count: 128,
      distribution: {
        5: 45,
        4: 52,
        3: 20,
        2: 8,
        1: 3
      }
    },
    
    images: [
      'https://img.alicdn.com/imgextra/i1/O1CN01Z5paLz1O0zuCC7osS_!!6000000001644-2-tps-856-540.png',
      'https://img.alicdn.com/imgextra/i2/O1CN01E4qVhb1dX8FVKm2eI_!!6000000003747-2-tps-856-540.png',
      'https://img.alicdn.com/imgextra/i3/O1CN01kUc5Y71UEHdIDkkVy_!!6000000002484-2-tps-856-540.png'
    ],
    
    description: '位于万达广场地下一层的充电站，环境整洁，配套设施完善。提供快充和慢充服务，支持多种车型充电。周边有餐厅、购物中心等便民设施，充电等待时间可以进行购物休闲。',
    
    contact: {
      phone: '010-12345678',
      emergencyPhone: '400-123-4567'
    },
    
    status: 'active',
    isVerified: true,
    
    stats: {
      totalSessions: 2456,
      totalEnergy: 18750.5,
      averageSessionDuration: 45,
      peakHours: ['08:00-10:00', '18:00-20:00']
    },
    
    occupancyRate: 65,
    isOpen: true
  };

  // 加载充电站数据
  useEffect(() => {
    const loadStationData = async () => {
      setLoading(true);
      
      try {
        // 模拟API调用延迟
        await new Promise(resolve => setTimeout(resolve, TIME_CONSTANTS.ONE_SECOND));
        
        // 这里应该调用实际的API
        // const response = await stationService.getStationDetail(stationId);
        // setStationData(response.data);
        
        setStationData(mockStationData);
      } catch (error) {
        console.error('❌ 加载充电站数据失败:', error);
        Toast.show({
          content: '加载充电站信息失败',
          type: 'error',
          duration: TIME_CONSTANTS.TWO_SECONDS
        });
      } finally {
        setLoading(false);
      }
    };

    if (stationId) {
      loadStationData();
    }
  }, [stationId]);

  // 获取当前位置
  useEffect(() => {
    const getCurrentLocation = async () => {
      try {
        const location = await Taro.getLocation({
          type: 'gcj02'
        });
        
        setCurrentLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          address: '',
          city: '',
          district: '',
          province: ''
        });
      } catch (error) {
        console.warn('⚠️ 获取位置失败:', error);
      }
    };

    getCurrentLocation();
  }, []);

  // 处理导航
  const handleNavigate = (station: StationDetailData) => {
    const { latitude, longitude } = station.location;
    
    Taro.openLocation({
      latitude,
      longitude,
      name: station.name,
      address: station.address,
      scale: 18
    }).catch(error => {
      console.error('❌ 打开地图导航失败:', error);
      Toast.show({
        content: '打开导航失败',
        type: 'error',
        duration: TIME_CONSTANTS.TWO_SECONDS
      });
    });
  };

  // 处理开始充电
  const handleStartCharging = (station: StationDetailData, pile: ChargingPile) => {
    console.log('🔋 开始充电:', { station: station.name, pile: pile.pileNumber });
    
    // 跳转到充电页面
    Taro.navigateTo({
      url: `/pages/charging/index?stationId=${station.stationId}&pileId=${pile.pileId}`
    }).catch(error => {
      console.error('❌ 跳转充电页面失败:', error);
      Toast.show({
        content: '跳转失败，请重试',
        type: 'error',
        duration: 2000
      });
    });
  };

  // 处理收藏
  const handleFavorite = (station: StationDetailData, isFavorite: boolean) => {
    console.log('❤️ 收藏状态变更:', { station: station.name, isFavorite });
    
    // 这里可以调用收藏API
    // favoriteService.toggleFavorite(station.stationId, isFavorite);
  };

  // 处理评分
  const handleRate = (station: StationDetailData, rating: number) => {
    console.log('⭐ 用户评分:', { station: station.name, rating });
    
    // 这里可以调用评分API
    // ratingService.submitRating(station.stationId, rating);
  };

  // 处理问题反馈
  const handleReport = (station: StationDetailData, issue: string) => {
    console.log('🚨 问题反馈:', { station: station.name, issue });
    
    // 这里可以调用反馈API
    // reportService.submitReport(station.stationId, issue);
  };

  // 处理拨打电话
  const handleCall = (phoneNumber: string) => {
    console.log('📞 拨打电话:', phoneNumber);
  };

  return (
    <View className="station-detail-page">
      <StationDetail
        stationId={stationId}
        stationData={stationData}
        loading={loading}
        currentLocation={currentLocation}
        onNavigate={handleNavigate}
        onStartCharging={handleStartCharging}
        onFavorite={handleFavorite}
        onRate={handleRate}
        onReport={handleReport}
        onCall={handleCall}
      />
    </View>
  );
};

export default StationDetailPage;