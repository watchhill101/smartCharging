import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { TaroSafe } from '../../utils/taroSafe';
import {
  Cell,
  Button as NutButton,
  Loading,
  Empty,
  Tag,
  Skeleton,
  PullToRefresh,
  InfiniteLoading,
  Toast
} from '@nutui/nutui-react-taro';
import { LocationInfo } from '../../services/AmapService';
import { SearchResult, StationSearchFilters, StationSearchOptions } from '../StationSearch';
import { LazyImage, LazyList } from '../LazyLoad';
import { usePerformanceMonitor } from '../../utils/performanceMonitor';
import { useResourcePreloader } from '../../utils/resourcePreloader';
import './index.scss';

export interface StationListProps {
  // 数据相关
  stations?: SearchResult[];
  loading?: boolean;
  refreshing?: boolean;
  hasMore?: boolean;
  total?: number;
  
  // 搜索相关
  filters?: StationSearchFilters;
  options?: StationSearchOptions;
  currentLocation?: LocationInfo | null;
  
  // 事件回调
  onStationSelect?: (station: SearchResult) => void;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onSearch?: (filters: StationSearchFilters, options: StationSearchOptions) => void;
  onNavigate?: (station: SearchResult) => void;
  onFavorite?: (station: SearchResult, isFavorite: boolean) => void;
  
  // 显示配置
  showDistance?: boolean;
  showImages?: boolean;
  showServices?: boolean;
  showNavigation?: boolean;
  showFavorite?: boolean;
  
  // 样式配置
  className?: string;
  itemClassName?: string;
}

interface ListState {
  favoriteStations: Set<string>;
  expandedStations: Set<string>;
  imageErrors: Set<string>;
}

const StationList: React.FC<StationListProps> = ({
  stations = [],
  loading = false,
  refreshing = false,
  hasMore = false,
  total = 0,
  filters = {},
  options = {},
  currentLocation,
  onStationSelect,
  onRefresh,
  onLoadMore,
  onSearch,
  onNavigate,
  onFavorite,
  showDistance = true,
  showImages = true,
  showServices = true,
  showNavigation = true,
  showFavorite = true,
  className = '',
  itemClassName = ''
}) => {
  const [listState, setListState] = useState<ListState>({
    favoriteStations: new Set(),
    expandedStations: new Set(),
    imageErrors: new Set()
  });

  const loadingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  
  // 性能监控
  const { startMeasure, endMeasure } = usePerformanceMonitor();
  
  // 资源预加载
  const { preload } = useResourcePreloader();

  // 服务选项映射
  const serviceLabels: { [key: string]: string } = {
    parking: '停车',
    restaurant: '餐厅',
    restroom: '洗手间',
    wifi: 'WiFi',
    shop: '商店',
    repair: '维修',
    car_wash: '洗车',
    convenience_store: '便利店'
  };

  // 加载收藏列表
  useEffect(() => {
    const loadFavorites = async () => {
      startMeasure('load-favorites');
      try {
        const favorites = await TaroSafe.getStorageSync('favorite_stations');
        if (favorites && Array.isArray(favorites)) {
          setListState(prev => ({
            ...prev,
            favoriteStations: new Set(favorites)
          }));
        }
      } catch (error) {
        console.warn('⚠️ 加载收藏列表失败:', error);
      } finally {
        endMeasure('load-favorites');
      }
    };

    loadFavorites();
  }, [startMeasure, endMeasure]);

  // 预加载图片资源
  useEffect(() => {
    if (stations.length > 0 && showImages) {
      const imageUrls = stations
        .slice(0, 5) // 只预加载前5个图片
        .filter(station => station.images && station.images.length > 0)
        .map(station => station.images![0]);
      
      if (imageUrls.length > 0) {
        preload(imageUrls.map(url => ({
          url,
          type: 'image' as const,
          priority: 'medium' as const
        })));
      }
    }
  }, [stations, showImages, preload]);

  // 保存收藏列表
  const saveFavorites = useCallback(async (favorites: Set<string>) => {
    try {
      await TaroSafe.setStorageSync('favorite_stations', Array.from(favorites));
    } catch (error) {
      console.warn('⚠️ 保存收藏列表失败:', error);
    }
  }, []);

  // 格式化距离
  const formatDistance = useCallback((distance?: number) => {
    if (!distance) return '';
    if (distance < 1000) {
      return `${distance}m`;
    } else {
      return `${(distance / 1000).toFixed(1)}km`;
    }
  }, []);

  // 格式化价格
  const formatPrice = useCallback((priceRange: SearchResult['priceRange']) => {
    const min = priceRange.minServicePrice;
    const max = priceRange.maxServicePrice;
    if (min === max) {
      return `${min}元/kWh`;
    } else {
      return `${min}-${max}元/kWh`;
    }
  }, []);

  // 获取充电桩状态颜色
  const getPileStatusColor = useCallback((availablePiles: number, totalPiles: number) => {
    const ratio = availablePiles / totalPiles;
    if (ratio >= 0.7) return '#52c41a'; // 绿色
    if (ratio >= 0.3) return '#faad14'; // 橙色
    return '#ff4d4f'; // 红色
  }, []);

  // 处理充电站选择
  const handleStationSelect = useCallback((station: SearchResult) => {
    onStationSelect?.(station);
  }, [onStationSelect]);

  // 处理导航
  const handleNavigate = useCallback((station: SearchResult, event: any) => {
    event.stopPropagation();
    onNavigate?.(station);
  }, [onNavigate]);

  // 处理收藏
  const handleFavorite = useCallback(async (station: SearchResult, event: any) => {
    event.stopPropagation();
    
    const isFavorite = listState.favoriteStations.has(station.stationId);
    const newFavorites = new Set(listState.favoriteStations);
    
    if (isFavorite) {
      newFavorites.delete(station.stationId);
      Toast.show({
        content: '已取消收藏',
        type: 'success',
        duration: 1500
      });
    } else {
      newFavorites.add(station.stationId);
      Toast.show({
        content: '已添加收藏',
        type: 'success',
        duration: 1500
      });
    }
    
    setListState(prev => ({
      ...prev,
      favoriteStations: newFavorites
    }));
    
    await saveFavorites(newFavorites);
    onFavorite?.(station, !isFavorite);
  }, [listState.favoriteStations, saveFavorites, onFavorite]);

  // 处理展开/收起
  const handleToggleExpand = useCallback((stationId: string, event: any) => {
    event.stopPropagation();
    
    const newExpanded = new Set(listState.expandedStations);
    if (newExpanded.has(stationId)) {
      newExpanded.delete(stationId);
    } else {
      newExpanded.add(stationId);
    }
    
    setListState(prev => ({
      ...prev,
      expandedStations: newExpanded
    }));
  }, [listState.expandedStations]);

  // 处理图片加载错误
  const handleImageError = useCallback((stationId: string) => {
    setListState(prev => ({
      ...prev,
      imageErrors: new Set([...prev.imageErrors, stationId])
    }));
  }, []);

  // 处理下拉刷新
  const handleRefresh = useCallback(async () => {
    if (refreshing || loadingRef.current) return;
    
    loadingRef.current = true;
    try {
      await onRefresh?.();
    } finally {
      loadingRef.current = false;
    }
  }, [refreshing, onRefresh]);

  // 处理加载更多
  const handleLoadMore = useCallback(async () => {
    if (loading || !hasMore || loadingRef.current) return;
    
    loadingRef.current = true;
    try {
      await onLoadMore?.();
    } finally {
      loadingRef.current = false;
    }
  }, [loading, hasMore, onLoadMore]);

  // 渲染充电站项目
  const renderStationItem = useCallback((station: SearchResult) => {
    const isFavorite = listState.favoriteStations.has(station.stationId);
    const isExpanded = listState.expandedStations.has(station.stationId);
    const hasImageError = listState.imageErrors.has(station.stationId);
    const pileStatusColor = getPileStatusColor(station.availablePiles, station.totalPiles);

    return (
      <View
        key={station.stationId}
        className={`station-item ${itemClassName}`}
        onClick={() => handleStationSelect(station)}
      >
        {/* 充电站图片 - 使用懒加载 */}
        {showImages && station.images && station.images.length > 0 && !hasImageError && (
          <View className="station-image">
            <LazyImage
              src={station.images[0]}
              alt={`${station.name}充电站`}
              className="image"
              responsive={true}
              webpSupport={true}
              width={120}
              height={80}
              onError={() => handleImageError(station.stationId)}
              placeholder={
                <View className="image-placeholder">
                  <View className="placeholder-icon">🏢</View>
                </View>
              }
            />
          </View>
        )}

        <View className="station-content">
          {/* 充电站标题 */}
          <View className="station-header">
            <View className="station-title">
              <Text className="station-name">{station.name}</Text>
              {showFavorite && (
                <View
                  className={`favorite-btn ${isFavorite ? 'favorited' : ''}`}
                  onClick={(e) => handleFavorite(station, e)}
                >
                  {isFavorite ? '❤️' : '🤍'}
                </View>
              )}
            </View>
            
            <View className="station-info">
              <Text className="operator-name">{station.operator.name}</Text>
              {showDistance && station.distance && (
                <Text className="distance">{formatDistance(station.distance)}</Text>
              )}
            </View>
          </View>

          {/* 充电站地址 */}
          <Text className="station-address">{station.address}</Text>

          {/* 充电桩状态 */}
          <View className="pile-status">
            <View className="pile-info">
              <Text 
                className="pile-count"
                style={{ color: pileStatusColor }}
              >
                {station.availablePiles}/{station.totalPiles} 可用
              </Text>
              <View className="status-indicator" style={{ backgroundColor: pileStatusColor }} />
            </View>
            
            <View className="station-rating">
              <Text className="rating-text">⭐ {station.rating.average.toFixed(1)}</Text>
              <Text className="rating-count">({station.rating.count})</Text>
            </View>
          </View>

          {/* 价格信息 */}
          <View className="price-info">
            <Tag size="small" className="price-tag">
              {formatPrice(station.priceRange)}
            </Tag>
          </View>

          {/* 服务标签 */}
          {showServices && station.services.length > 0 && (
            <View className="services">
              {station.services.slice(0, isExpanded ? station.services.length : 3).map(service => (
                <Tag
                  key={service}
                  size="mini"
                  type="default"
                  className="service-tag"
                >
                  {serviceLabels[service] || service}
                </Tag>
              ))}
              
              {station.services.length > 3 && (
                <Tag
                  size="mini"
                  type="primary"
                  className="expand-tag"
                  onClick={(e) => handleToggleExpand(station.stationId, e)}
                >
                  {isExpanded ? '收起' : `+${station.services.length - 3}`}
                </Tag>
              )}
            </View>
          )}

          {/* 操作按钮 */}
          <View className="station-actions">
            {showNavigation && (
              <NutButton
                type="primary"
                size="small"
                onClick={(e) => handleNavigate(station, e)}
                className="nav-btn"
              >
                🧭 导航
              </NutButton>
            )}
            
            <NutButton
              type="default"
              size="small"
              onClick={() => handleStationSelect(station)}
              className="detail-btn"
            >
              查看详情
            </NutButton>
          </View>
        </View>
      </View>
    );
  }, [
    listState,
    showImages,
    showFavorite,
    showDistance,
    showServices,
    showNavigation,
    itemClassName,
    getPileStatusColor,
    formatDistance,
    formatPrice,
    serviceLabels,
    handleStationSelect,
    handleNavigate,
    handleFavorite,
    handleToggleExpand,
    handleImageError
  ]);

  // 渲染骨架屏
  const renderSkeleton = useCallback(() => {
    return Array.from({ length: 3 }, (_, index) => (
      <View key={index} className="station-item skeleton-item">
        <Skeleton rows={4} animated />
      </View>
    ));
  }, []);

  return (
    <View className={`station-list ${className}`}>
      {/* 列表头部信息 */}
      {total > 0 && (
        <View className="list-header">
          <Text className="total-count">共找到 {total} 个充电站</Text>
          {currentLocation && (
            <Text className="location-info">
              📍 {currentLocation.city || '当前位置'}
            </Text>
          )}
        </View>
      )}

      {/* 充电站列表 - 使用虚拟滚动优化 */}
      <PullToRefresh
        onRefresh={handleRefresh}
        loading={refreshing}
        className="pull-refresh"
      >
        <View ref={listRef} className="station-scroll-container">
          {loading && stations.length === 0 ? (
            // 加载骨架屏
            renderSkeleton()
          ) : stations.length > 0 ? (
            // 充电站列表 - 使用虚拟滚动
            <>
              <LazyList
                items={stations}
                renderItem={(station, index) => renderStationItem(station)}
                className="station-virtual-list"
                itemHeight={200} // 预估每项高度
                bufferSize={3} // 缓冲区大小
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.8}
              />
              
              {/* 无限加载指示器 */}
              {(loading || hasMore) && (
                <View className="loading-footer">
                  {loading ? (
                    <>
                      <Loading type="spinner" size="small" />
                      <Text className="loading-text">加载中...</Text>
                    </>
                  ) : hasMore ? (
                    <Text className="load-more-text">上拉加载更多</Text>
                  ) : (
                    <Text className="no-more-text">没有更多数据了</Text>
                  )}
                </View>
              )}
            </>
          ) : (
            // 空状态
            <Empty
              description="暂无充电站数据"
              imageSize={80}
              className="empty-state"
            >
              <NutButton
                type="primary"
                size="small"
                onClick={handleRefresh}
                className="refresh-btn"
              >
                刷新重试
              </NutButton>
            </Empty>
          )}
        </View>
      </PullToRefresh>
    </View>
  );
};

export default StationList;