import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Image, Swiper, SwiperItem } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { TaroSafe } from '../../utils/taroSafe';
import {
  Button as NutButton,
  Loading,
  Tag,
  Cell,
  CellGroup,
  Rate,
  Progress,
  Divider,
  Popup,
  Toast,
  ActionSheet,
  Dialog
} from '@nutui/nutui-react-taro';
import { LocationInfo } from '../../services/AmapService';
import './index.scss';

export interface ChargingPile {
  pileId: string;
  pileNumber: string;
  type: 'AC' | 'DC' | 'AC_DC';
  power: number;
  voltage: number;
  current: number;
  connectorType: string[];
  status: 'available' | 'occupied' | 'offline' | 'maintenance' | 'reserved';
  price: {
    servicePrice: number;
    electricityPrice: number;
    parkingPrice?: number;
  };
  lastMaintenance?: string;
  manufacturer?: string;
  model?: string;
}

export interface StationDetailData {
  stationId: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
  city: string;
  district: string;
  province: string;
  
  operator: {
    name: string;
    phone: string;
    email?: string;
    website?: string;
  };
  
  piles: ChargingPile[];
  totalPiles: number;
  availablePiles: number;
  
  openTime: {
    start: string;
    end: string;
    is24Hours: boolean;
  };
  
  services: string[];
  
  priceRange: {
    minServicePrice: number;
    maxServicePrice: number;
    minElectricityPrice: number;
    maxElectricityPrice: number;
  };
  
  rating: {
    average: number;
    count: number;
    distribution: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };
  
  images: string[];
  description?: string;
  
  contact: {
    phone?: string;
    emergencyPhone?: string;
  };
  
  status: 'active' | 'inactive' | 'maintenance' | 'construction';
  isVerified: boolean;
  
  stats: {
    totalSessions: number;
    totalEnergy: number;
    averageSessionDuration: number;
    peakHours: string[];
  };
  
  occupancyRate?: number;
  isOpen?: boolean;
}

export interface StationDetailProps {
  stationId?: string;
  stationData?: StationDetailData;
  loading?: boolean;
  currentLocation?: LocationInfo | null;
  
  onNavigate?: (station: StationDetailData) => void;
  onStartCharging?: (station: StationDetailData, pile: ChargingPile) => void;
  onFavorite?: (station: StationDetailData, isFavorite: boolean) => void;
  onRate?: (station: StationDetailData, rating: number) => void;
  onReport?: (station: StationDetailData, issue: string) => void;
  onCall?: (phoneNumber: string) => void;
  
  className?: string;
}

interface DetailState {
  isFavorite: boolean;
  showRating: boolean;
  showReport: boolean;
  showPileDetail: boolean;
  selectedPile: ChargingPile | null;
  currentImageIndex: number;
  userRating: number;
  reportIssue: string;
}

const StationDetail: React.FC<StationDetailProps> = ({
  stationId,
  stationData,
  loading = false,
  currentLocation,
  onNavigate,
  onStartCharging,
  onFavorite,
  onRate,
  onReport,
  onCall,
  className = ''
}) => {
  const [detailState, setDetailState] = useState<DetailState>({
    isFavorite: false,
    showRating: false,
    showReport: false,
    showPileDetail: false,
    selectedPile: null,
    currentImageIndex: 0,
    userRating: 5,
    reportIssue: ''
  });

  const scrollViewRef = useRef<any>(null);

  // 服务标签映射
  const serviceLabels: { [key: string]: { label: string; icon: string } } = {
    parking: { label: '停车场', icon: '🅿️' },
    restaurant: { label: '餐厅', icon: '🍽️' },
    restroom: { label: '洗手间', icon: '🚻' },
    wifi: { label: 'WiFi', icon: '📶' },
    shop: { label: '商店', icon: '🏪' },
    repair: { label: '维修', icon: '🔧' },
    car_wash: { label: '洗车', icon: '🚿' },
    convenience_store: { label: '便利店', icon: '🏬' }
  };

  // 充电桩状态映射
  const pileStatusMap: { [key: string]: { label: string; color: string; icon: string } } = {
    available: { label: '可用', color: '#52c41a', icon: '✅' },
    occupied: { label: '使用中', color: '#faad14', icon: '🔋' },
    offline: { label: '离线', color: '#d9d9d9', icon: '❌' },
    maintenance: { label: '维护中', color: '#ff4d4f', icon: '🔧' },
    reserved: { label: '已预约', color: '#1890ff', icon: '📅' }
  };

  // 问题报告选项
  const reportOptions = [
    '充电桩故障',
    '价格错误',
    '位置错误',
    '服务设施问题',
    '环境卫生问题',
    '其他问题'
  ];

  // 加载收藏状态
  useEffect(() => {
    const loadFavoriteStatus = async () => {
      if (!stationData) return;
      
      try {
        const favorites = await TaroSafe.getStorageSync('favorite_stations');
        if (favorites && Array.isArray(favorites)) {
          setDetailState(prev => ({
            ...prev,
            isFavorite: favorites.includes(stationData.stationId)
          }));
        }
      } catch (error) {
        console.warn('⚠️ 加载收藏状态失败:', error);
      }
    };

    loadFavoriteStatus();
  }, [stationData]);

  // 格式化距离
  const formatDistance = useCallback((distance?: number) => {
    if (!distance) return '';
    if (distance < 1000) {
      return `${distance}m`;
    } else {
      return `${(distance / 1000).toFixed(1)}km`;
    }
  }, []);

  // 格式化营业时间
  const formatOpenTime = useCallback((openTime: StationDetailData['openTime']) => {
    if (openTime.is24Hours) {
      return '24小时营业';
    } else {
      return `${openTime.start} - ${openTime.end}`;
    }
  }, []);

  // 获取充电桩类型标签颜色
  const getPileTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'DC': return '#fa2c19';
      case 'AC': return '#52c41a';
      case 'AC_DC': return '#1890ff';
      default: return '#666';
    }
  }, []);

  // 处理导航
  const handleNavigate = useCallback(() => {
    if (stationData) {
      onNavigate?.(stationData);
    }
  }, [stationData, onNavigate]);

  // 处理收藏
  const handleFavorite = useCallback(async () => {
    if (!stationData) return;

    try {
      const favorites = await TaroSafe.getStorageSync('favorite_stations') || [];
      const newFavorites = detailState.isFavorite
        ? favorites.filter((id: string) => id !== stationData.stationId)
        : [...favorites, stationData.stationId];

      await TaroSafe.setStorageSync('favorite_stations', newFavorites);
      
      setDetailState(prev => ({
        ...prev,
        isFavorite: !prev.isFavorite
      }));

      onFavorite?.(stationData, !detailState.isFavorite);

      Toast.show({
        content: detailState.isFavorite ? '已取消收藏' : '已添加收藏',
        type: 'success',
        duration: 1500
      });

    } catch (error) {
      console.error('❌ 收藏操作失败:', error);
      Toast.show({
        content: '操作失败，请重试',
        type: 'error',
        duration: 2000
      });
    }
  }, [stationData, detailState.isFavorite, onFavorite]);

  // 处理开始充电
  const handleStartCharging = useCallback((pile: ChargingPile) => {
    if (!stationData) return;

    if (pile.status !== 'available') {
      Toast.show({
        content: '该充电桩当前不可用',
        type: 'warning',
        duration: 2000
      });
      return;
    }

    onStartCharging?.(stationData, pile);
  }, [stationData, onStartCharging]);

  // 处理评分
  const handleRating = useCallback(() => {
    if (!stationData) return;

    onRate?.(stationData, detailState.userRating);
    setDetailState(prev => ({ ...prev, showRating: false }));

    Toast.show({
      content: '评分提交成功',
      type: 'success',
      duration: 1500
    });
  }, [stationData, detailState.userRating, onRate]);

  // 处理问题报告
  const handleReport = useCallback(() => {
    if (!stationData || !detailState.reportIssue) return;

    onReport?.(stationData, detailState.reportIssue);
    setDetailState(prev => ({ 
      ...prev, 
      showReport: false,
      reportIssue: ''
    }));

    Toast.show({
      content: '问题反馈已提交',
      type: 'success',
      duration: 1500
    });
  }, [stationData, detailState.reportIssue, onReport]);

  // 处理拨打电话
  const handleCall = useCallback((phoneNumber: string) => {
    Dialog.confirm({
      title: '拨打电话',
      content: `确定要拨打 ${phoneNumber} 吗？`,
      onConfirm: () => {
        onCall?.(phoneNumber);
        Taro.makePhoneCall({
          phoneNumber
        }).catch(error => {
          console.error('❌ 拨打电话失败:', error);
          Toast.show({
            content: '拨打电话失败',
            type: 'error',
            duration: 2000
          });
        });
      }
    });
  }, [onCall]);

  // 处理充电桩详情
  const handlePileDetail = useCallback((pile: ChargingPile) => {
    setDetailState(prev => ({
      ...prev,
      selectedPile: pile,
      showPileDetail: true
    }));
  }, []);

  // 处理图片切换
  const handleImageChange = useCallback((event: any) => {
    setDetailState(prev => ({
      ...prev,
      currentImageIndex: event.detail.current
    }));
  }, []);

  if (loading) {
    return (
      <View className={`station-detail loading ${className}`}>
        <Loading type="spinner" />
        <Text className="loading-text">加载中...</Text>
      </View>
    );
  }

  if (!stationData) {
    return (
      <View className={`station-detail error ${className}`}>
        <Text className="error-text">充电站信息不存在</Text>
      </View>
    );
  }

  return (
    <View className={`station-detail ${className}`}>
      <ScrollView className="detail-scroll" scrollY enhanced>
        {/* 充电站图片轮播 */}
        {stationData.images && stationData.images.length > 0 && (
          <View className="station-images">
            <Swiper
              className="images-swiper"
              indicatorDots
              autoplay
              interval={5000}
              onChange={handleImageChange}
            >
              {stationData.images.map((image, index) => (
                <SwiperItem key={index}>
                  <Image
                    src={image}
                    mode="aspectFill"
                    className="station-image"
                  />
                </SwiperItem>
              ))}
            </Swiper>
            
            <View className="image-indicator">
              {detailState.currentImageIndex + 1} / {stationData.images.length}
            </View>
          </View>
        )}

        {/* 充电站基本信息 */}
        <View className="station-info">
          <View className="info-header">
            <View className="station-title">
              <Text className="station-name">{stationData.name}</Text>
              {stationData.isVerified && (
                <Tag size="small" type="success" className="verified-tag">
                  ✓ 已认证
                </Tag>
              )}
            </View>
            
            <View className="station-rating">
              <Rate
                value={stationData.rating.average}
                readonly
                size={16}
                className="rating-stars"
              />
              <Text className="rating-text">
                {stationData.rating.average.toFixed(1)} ({stationData.rating.count})
              </Text>
            </View>
          </View>

          <View className="info-content">
            <Text className="station-address">📍 {stationData.address}</Text>
            <Text className="operator-name">🏢 {stationData.operator.name}</Text>
            
            <View className="station-status">
              <View className="pile-status">
                <Text className="status-text">
                  ⚡ {stationData.availablePiles}/{stationData.totalPiles} 可用
                </Text>
                <Progress
                  percentage={(stationData.availablePiles / stationData.totalPiles) * 100}
                  strokeColor="#52c41a"
                  showText={false}
                  className="availability-progress"
                />
              </View>
              
              <View className="open-status">
                <Text className={`open-text ${stationData.isOpen ? 'open' : 'closed'}`}>
                  {stationData.isOpen ? '🟢 营业中' : '🔴 已关闭'}
                </Text>
                <Text className="open-time">{formatOpenTime(stationData.openTime)}</Text>
              </View>
            </View>

            {currentLocation && stationData.distance && (
              <Text className="distance-info">
                📏 距离您 {formatDistance(stationData.distance)}
              </Text>
            )}
          </View>
        </View>

        {/* 操作按钮 */}
        <View className="action-buttons">
          <NutButton
            type="primary"
            size="large"
            onClick={handleNavigate}
            className="nav-btn"
          >
            🧭 导航
          </NutButton>
          
          <NutButton
            type={detailState.isFavorite ? 'success' : 'default'}
            size="large"
            onClick={handleFavorite}
            className="favorite-btn"
          >
            {detailState.isFavorite ? '❤️ 已收藏' : '🤍 收藏'}
          </NutButton>
        </View>

        {/* 充电桩列表 */}
        <View className="charging-piles">
          <View className="section-header">
            <Text className="section-title">充电桩信息</Text>
            <Text className="pile-count">{stationData.piles.length} 个充电桩</Text>
          </View>

          <View className="piles-grid">
            {stationData.piles.map(pile => {
              const statusInfo = pileStatusMap[pile.status];
              return (
                <View
                  key={pile.pileId}
                  className={`pile-card ${pile.status}`}
                  onClick={() => handlePileDetail(pile)}
                >
                  <View className="pile-header">
                    <Text className="pile-number">#{pile.pileNumber}</Text>
                    <View 
                      className="pile-status"
                      style={{ color: statusInfo.color }}
                    >
                      <Text className="status-icon">{statusInfo.icon}</Text>
                      <Text className="status-text">{statusInfo.label}</Text>
                    </View>
                  </View>
                  
                  <View className="pile-info">
                    <Tag
                      size="mini"
                      className="pile-type"
                      style={{ 
                        backgroundColor: getPileTypeColor(pile.type),
                        color: '#fff',
                        border: 'none'
                      }}
                    >
                      {pile.type}
                    </Tag>
                    <Text className="pile-power">{pile.power}kW</Text>
                  </View>
                  
                  <View className="pile-price">
                    <Text className="price-text">
                      {pile.price.servicePrice + pile.price.electricityPrice}元/kWh
                    </Text>
                  </View>
                  
                  <View className="pile-connectors">
                    {pile.connectorType.map(connector => (
                      <Tag key={connector} size="mini" className="connector-tag">
                        {connector}
                      </Tag>
                    ))}
                  </View>

                  {pile.status === 'available' && (
                    <NutButton
                      type="primary"
                      size="mini"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCharging(pile);
                      }}
                      className="start-charging-btn"
                    >
                      开始充电
                    </NutButton>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* 服务设施 */}
        {stationData.services.length > 0 && (
          <View className="station-services">
            <View className="section-header">
              <Text className="section-title">服务设施</Text>
            </View>
            
            <View className="services-grid">
              {stationData.services.map(service => {
                const serviceInfo = serviceLabels[service];
                return (
                  <View key={service} className="service-item">
                    <Text className="service-icon">{serviceInfo?.icon || '🔧'}</Text>
                    <Text className="service-label">{serviceInfo?.label || service}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 价格信息 */}
        <View className="price-info">
          <View className="section-header">
            <Text className="section-title">价格信息</Text>
          </View>
          
          <CellGroup>
            <Cell
              title="服务费"
              extra={`${stationData.priceRange.minServicePrice}-${stationData.priceRange.maxServicePrice}元/kWh`}
            />
            <Cell
              title="电费"
              extra={`${stationData.priceRange.minElectricityPrice}-${stationData.priceRange.maxElectricityPrice}元/kWh`}
            />
          </CellGroup>
        </View>

        {/* 联系信息 */}
        <View className="contact-info">
          <View className="section-header">
            <Text className="section-title">联系方式</Text>
          </View>
          
          <CellGroup>
            <Cell
              title="运营商电话"
              extra={stationData.operator.phone}
              onClick={() => handleCall(stationData.operator.phone)}
              className="contact-cell"
            />
            {stationData.contact.phone && (
              <Cell
                title="充电站电话"
                extra={stationData.contact.phone}
                onClick={() => handleCall(stationData.contact.phone!)}
                className="contact-cell"
              />
            )}
            {stationData.contact.emergencyPhone && (
              <Cell
                title="紧急联系电话"
                extra={stationData.contact.emergencyPhone}
                onClick={() => handleCall(stationData.contact.emergencyPhone!)}
                className="contact-cell emergency"
              />
            )}
          </CellGroup>
        </View>

        {/* 用户评价 */}
        <View className="user-reviews">
          <View className="section-header">
            <Text className="section-title">用户评价</Text>
            <NutButton
              type="primary"
              size="mini"
              onClick={() => setDetailState(prev => ({ ...prev, showRating: true }))}
              className="rate-btn"
            >
              评分
            </NutButton>
          </View>
          
          <View className="rating-distribution">
            {Object.entries(stationData.rating.distribution).reverse().map(([rating, count]) => (
              <View key={rating} className="rating-row">
                <Text className="rating-label">{rating}星</Text>
                <Progress
                  percentage={stationData.rating.count > 0 ? (count / stationData.rating.count) * 100 : 0}
                  strokeColor="#faad14"
                  showText={false}
                  className="rating-progress"
                />
                <Text className="rating-count">{count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 充电站描述 */}
        {stationData.description && (
          <View className="station-description">
            <View className="section-header">
              <Text className="section-title">充电站介绍</Text>
            </View>
            <Text className="description-text">{stationData.description}</Text>
          </View>
        )}

        {/* 统计信息 */}
        <View className="station-stats">
          <View className="section-header">
            <Text className="section-title">使用统计</Text>
          </View>
          
          <View className="stats-grid">
            <View className="stat-item">
              <Text className="stat-value">{stationData.stats.totalSessions}</Text>
              <Text className="stat-label">总充电次数</Text>
            </View>
            <View className="stat-item">
              <Text className="stat-value">{stationData.stats.totalEnergy.toFixed(1)}</Text>
              <Text className="stat-label">总充电量(kWh)</Text>
            </View>
            <View className="stat-item">
              <Text className="stat-value">{stationData.stats.averageSessionDuration}</Text>
              <Text className="stat-label">平均时长(分钟)</Text>
            </View>
            <View className="stat-item">
              <Text className="stat-value">{stationData.occupancyRate || 0}%</Text>
              <Text className="stat-label">使用率</Text>
            </View>
          </View>
        </View>

        {/* 问题反馈 */}
        <View className="report-section">
          <NutButton
            type="default"
            size="large"
            onClick={() => setDetailState(prev => ({ ...prev, showReport: true }))}
            className="report-btn"
          >
            🚨 反馈问题
          </NutButton>
        </View>
      </ScrollView>

      {/* 评分弹窗 */}
      <Popup
        visible={detailState.showRating}
        position="center"
        closeable
        onClose={() => setDetailState(prev => ({ ...prev, showRating: false }))}
        className="rating-popup"
      >
        <View className="rating-content">
          <Text className="rating-title">为充电站评分</Text>
          <Rate
            value={detailState.userRating}
            onChange={(value) => setDetailState(prev => ({ ...prev, userRating: value }))}
            size={32}
            className="rating-input"
          />
          <View className="rating-actions">
            <NutButton
              type="default"
              onClick={() => setDetailState(prev => ({ ...prev, showRating: false }))}
            >
              取消
            </NutButton>
            <NutButton
              type="primary"
              onClick={handleRating}
            >
              提交评分
            </NutButton>
          </View>
        </View>
      </Popup>

      {/* 问题反馈弹窗 */}
      <ActionSheet
        visible={detailState.showReport}
        options={reportOptions.map(option => ({ name: option, value: option }))}
        onSelect={(option) => {
          setDetailState(prev => ({ 
            ...prev, 
            reportIssue: option.value,
            showReport: false 
          }));
          handleReport();
        }}
        onCancel={() => setDetailState(prev => ({ ...prev, showReport: false }))}
        title="请选择问题类型"
      />

      {/* 充电桩详情弹窗 */}
      <Popup
        visible={detailState.showPileDetail}
        position="bottom"
        closeable
        onClose={() => setDetailState(prev => ({ ...prev, showPileDetail: false }))}
        className="pile-detail-popup"
      >
        {detailState.selectedPile && (
          <View className="pile-detail">
            <View className="pile-detail-header">
              <Text className="pile-title">
                充电桩 #{detailState.selectedPile.pileNumber}
              </Text>
              <Tag
                size="small"
                style={{ 
                  backgroundColor: getPileTypeColor(detailState.selectedPile.type),
                  color: '#fff',
                  border: 'none'
                }}
              >
                {detailState.selectedPile.type}
              </Tag>
            </View>

            <CellGroup>
              <Cell title="功率" extra={`${detailState.selectedPile.power}kW`} />
              <Cell title="电压" extra={`${detailState.selectedPile.voltage}V`} />
              <Cell title="电流" extra={`${detailState.selectedPile.current}A`} />
              <Cell 
                title="接口类型" 
                extra={detailState.selectedPile.connectorType.join(', ')} 
              />
              <Cell 
                title="服务费" 
                extra={`${detailState.selectedPile.price.servicePrice}元/kWh`} 
              />
              <Cell 
                title="电费" 
                extra={`${detailState.selectedPile.price.electricityPrice}元/kWh`} 
              />
              {detailState.selectedPile.price.parkingPrice && (
                <Cell 
                  title="停车费" 
                  extra={`${detailState.selectedPile.price.parkingPrice}元/小时`} 
                />
              )}
              {detailState.selectedPile.manufacturer && (
                <Cell title="制造商" extra={detailState.selectedPile.manufacturer} />
              )}
              {detailState.selectedPile.model && (
                <Cell title="型号" extra={detailState.selectedPile.model} />
              )}
            </CellGroup>

            {detailState.selectedPile.status === 'available' && (
              <View className="pile-actions">
                <NutButton
                  type="primary"
                  size="large"
                  onClick={() => handleStartCharging(detailState.selectedPile!)}
                  block
                >
                  开始充电
                </NutButton>
              </View>
            )}
          </View>
        )}
      </Popup>
    </View>
  );
};

export default StationDetail;