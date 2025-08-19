import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Map, CoverView, CoverImage } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button as NutButton, Loading, Toast } from '@nutui/nutui-react-taro';
import AmapService, { LocationInfo, MapMarker, SearchResult } from '../../services/AmapService';
import './index.scss';

export interface MapViewProps {
  // 地图基础配置
  latitude?: number;
  longitude?: number;
  scale?: number;
  markers?: MapMarker[];
  showLocation?: boolean;
  showCompass?: boolean;
  showScale?: boolean;
  
  // 交互配置
  enableZoom?: boolean;
  enableScroll?: boolean;
  enableRotate?: boolean;
  enableOverlooking?: boolean;
  
  // 事件回调
  onMapClick?: (event: { latitude: number; longitude: number }) => void;
  onMarkerClick?: (markerId: string, marker: MapMarker) => void;
  onLocationChange?: (location: LocationInfo) => void;
  onRegionChange?: (region: { 
    latitude: number; 
    longitude: number; 
    latitudeDelta: number; 
    longitudeDelta: number; 
  }) => void;
  
  // 功能配置
  showLocationButton?: boolean;
  showSearchButton?: boolean;
  showNavigationButton?: boolean;
  
  // 样式配置
  height?: string;
  className?: string;
  
  // 充电站相关
  chargingStations?: SearchResult[];
  selectedStationId?: string;
  onStationSelect?: (station: SearchResult) => void;
}

interface MapState {
  currentLocation: LocationInfo | null;
  isLocating: boolean;
  locationError: string | null;
  mapReady: boolean;
  userMarkers: MapMarker[];
}

const MapView: React.FC<MapViewProps> = ({
  latitude: initialLatitude,
  longitude: initialLongitude,
  scale = 16,
  markers = [],
  showLocation = true,
  showCompass = true,
  showScale = true,
  enableZoom = true,
  enableScroll = true,
  enableRotate = false,
  enableOverlooking = false,
  onMapClick,
  onMarkerClick,
  onLocationChange,
  onRegionChange,
  showLocationButton = true,
  showSearchButton = false,
  showNavigationButton = false,
  height = '100vh',
  className = '',
  chargingStations = [],
  selectedStationId,
  onStationSelect
}) => {
  const [mapState, setMapState] = useState<MapState>({
    currentLocation: null,
    isLocating: false,
    locationError: null,
    mapReady: false,
    userMarkers: []
  });

  const amapService = useRef(new AmapService());
  const mapContext = useRef<any>(null);

  // 获取地图中心坐标
  const getMapCenter = useCallback(() => {
    if (mapState.currentLocation) {
      return {
        latitude: mapState.currentLocation.latitude,
        longitude: mapState.currentLocation.longitude
      };
    }
    return {
      latitude: initialLatitude || 39.908823,
      longitude: initialLongitude || 116.397470
    };
  }, [mapState.currentLocation, initialLatitude, initialLongitude]);

  // 获取当前位置
  const getCurrentLocation = useCallback(async () => {
    setMapState(prev => ({ ...prev, isLocating: true, locationError: null }));

    try {
      // 检查定位权限
      const hasPermission = await amapService.current.checkLocationPermission();
      if (!hasPermission) {
        const granted = await amapService.current.requestLocationPermission();
        if (!granted) {
          throw new Error('需要定位权限才能使用此功能');
        }
      }

      const location = await amapService.current.getCurrentLocation();
      
      setMapState(prev => ({
        ...prev,
        currentLocation: location,
        isLocating: false,
        locationError: null
      }));

      onLocationChange?.(location);

      // 移动地图到当前位置
      if (mapContext.current) {
        mapContext.current.moveToLocation({
          latitude: location.latitude,
          longitude: location.longitude
        });
      }

      Toast.show({
        content: '定位成功',
        type: 'success',
        duration: 2000
      });

    } catch (error: any) {
      console.error('❌ 获取位置失败:', error);
      const errorMessage = error.message || '定位失败，请稍后重试';
      
      setMapState(prev => ({
        ...prev,
        isLocating: false,
        locationError: errorMessage
      }));

      Toast.show({
        content: errorMessage,
        type: 'error',
        duration: 3000
      });
    }
  }, [onLocationChange]);

  // 生成所有标记点
  const getAllMarkers = useCallback((): MapMarker[] => {
    const allMarkers: MapMarker[] = [...markers, ...mapState.userMarkers];

    // 添加充电站标记
    const stationMarkers: MapMarker[] = chargingStations.map(station => ({
      id: station.id,
      latitude: station.location.latitude,
      longitude: station.location.longitude,
      title: station.name,
      iconPath: selectedStationId === station.id 
        ? '/assets/icons/charging-station-selected.png'
        : '/assets/icons/charging-station.png',
      width: 32,
      height: 32,
      callout: {
        content: station.name,
        color: '#333',
        fontSize: 14,
        borderRadius: 8,
        bgColor: '#fff',
        padding: 8,
        display: 'BYCLICK'
      },
      label: station.distance ? {
        content: amapService.current.formatDistance(station.distance),
        color: '#666',
        fontSize: 12,
        x: 16,
        y: -10
      } : undefined
    }));

    return [...allMarkers, ...stationMarkers];
  }, [markers, mapState.userMarkers, chargingStations, selectedStationId]);

  // 地图点击事件
  const handleMapClick = useCallback((event: any) => {
    const { latitude, longitude } = event.detail;
    onMapClick?.({ latitude, longitude });
  }, [onMapClick]);

  // 标记点击事件
  const handleMarkerClick = useCallback((event: any) => {
    const markerId = event.detail.markerId;
    const marker = getAllMarkers().find(m => m.id === markerId);
    
    if (marker) {
      // 检查是否是充电站标记
      const station = chargingStations.find(s => s.id === markerId);
      if (station) {
        onStationSelect?.(station);
      } else {
        onMarkerClick?.(markerId, marker);
      }
    }
  }, [getAllMarkers, chargingStations, onStationSelect, onMarkerClick]);

  // 地图区域变化事件
  const handleRegionChange = useCallback((event: any) => {
    if (event.type === 'end') {
      const { latitude, longitude, latitudeDelta, longitudeDelta } = event.detail;
      onRegionChange?.({
        latitude,
        longitude,
        latitudeDelta,
        longitudeDelta
      });
    }
  }, [onRegionChange]);

  // 地图加载完成
  const handleMapReady = useCallback(() => {
    setMapState(prev => ({ ...prev, mapReady: true }));
    
    // 获取地图上下文
    mapContext.current = Taro.createMapContext('map-view');
    
    console.log('✅ 地图加载完成');
  }, []);

  // 移动到指定位置
  const moveToLocation = useCallback((location: { latitude: number; longitude: number }, scale?: number) => {
    if (mapContext.current) {
      mapContext.current.moveToLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        scale: scale || 16
      });
    }
  }, []);

  // 添加用户标记
  const addUserMarker = useCallback((marker: Omit<MapMarker, 'id'>) => {
    const newMarker: MapMarker = {
      ...marker,
      id: `user-marker-${Date.now()}-${Math.random().toString(36).substring(2)}`
    };

    setMapState(prev => ({
      ...prev,
      userMarkers: [...prev.userMarkers, newMarker]
    }));

    return newMarker.id;
  }, []);

  // 移除用户标记
  const removeUserMarker = useCallback((markerId: string) => {
    setMapState(prev => ({
      ...prev,
      userMarkers: prev.userMarkers.filter(marker => marker.id !== markerId)
    }));
  }, []);

  // 清除所有用户标记
  const clearUserMarkers = useCallback(() => {
    setMapState(prev => ({
      ...prev,
      userMarkers: []
    }));
  }, []);

  // 获取地图截图
  const takeSnapshot = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!mapContext.current) {
        reject(new Error('地图未准备就绪'));
        return;
      }

      mapContext.current.takeSnapshot({
        type: 'png',
        quality: 1.0,
        success: (res: any) => {
          resolve(res.tempImagePath);
        },
        fail: (error: any) => {
          reject(new Error('截图失败'));
        }
      });
    });
  }, []);

  // 组件挂载时自动定位
  useEffect(() => {
    if (showLocation && !mapState.currentLocation) {
      getCurrentLocation();
    }
  }, [showLocation, getCurrentLocation, mapState.currentLocation]);

  // 暴露方法给父组件
  React.useImperativeHandle(React.forwardRef(() => null), () => ({
    getCurrentLocation,
    moveToLocation,
    addUserMarker,
    removeUserMarker,
    clearUserMarkers,
    takeSnapshot,
    getMapCenter
  }));

  const mapCenter = getMapCenter();

  return (
    <View className={`map-view ${className}`} style={{ height }}>
      <Map
        id="map-view"
        className="map-view__map"
        latitude={mapCenter.latitude}
        longitude={mapCenter.longitude}
        scale={scale}
        markers={getAllMarkers()}
        showLocation={showLocation}
        showCompass={showCompass}
        showScale={showScale}
        enableZoom={enableZoom}
        enableScroll={enableScroll}
        enableRotate={enableRotate}
        enableOverlooking={enableOverlooking}
        onClick={handleMapClick}
        onMarkerTap={handleMarkerClick}
        onRegionChange={handleRegionChange}
        onReady={handleMapReady}
      />

      {/* 控制按钮 */}
      <View className="map-view__controls">
        {showLocationButton && (
          <CoverView className="map-view__control-btn">
            <NutButton
              type="primary"
              size="small"
              loading={mapState.isLocating}
              onClick={getCurrentLocation}
              className="location-btn"
            >
              {mapState.isLocating ? '定位中...' : '📍'}
            </NutButton>
          </CoverView>
        )}

        {showSearchButton && (
          <CoverView className="map-view__control-btn">
            <NutButton
              type="default"
              size="small"
              className="search-btn"
            >
              🔍
            </NutButton>
          </CoverView>
        )}

        {showNavigationButton && selectedStationId && (
          <CoverView className="map-view__control-btn">
            <NutButton
              type="success"
              size="small"
              className="navigation-btn"
              onClick={() => {
                const station = chargingStations.find(s => s.id === selectedStationId);
                if (station) {
                  amapService.current.openNavigation(
                    station.location,
                    station.name,
                    mapState.currentLocation ? {
                      latitude: mapState.currentLocation.latitude,
                      longitude: mapState.currentLocation.longitude
                    } : undefined
                  );
                }
              }}
            >
              🧭
            </NutButton>
          </CoverView>
        )}
      </View>

      {/* 位置信息显示 */}
      {mapState.currentLocation && (
        <CoverView className="map-view__location-info">
          <CoverView className="location-text">
            📍 {mapState.currentLocation.address || '当前位置'}
          </CoverView>
          {mapState.currentLocation.accuracy && (
            <CoverView className="accuracy-text">
              精度: {Math.round(mapState.currentLocation.accuracy)}m
            </CoverView>
          )}
        </CoverView>
      )}

      {/* 加载状态 */}
      {!mapState.mapReady && (
        <View className="map-view__loading">
          <Loading type="spinner" />
          <View className="loading-text">地图加载中...</View>
        </View>
      )}

      {/* 错误提示 */}
      {mapState.locationError && (
        <CoverView className="map-view__error">
          <CoverView className="error-text">
            ⚠️ {mapState.locationError}
          </CoverView>
          <CoverView className="error-actions">
            <NutButton
              type="primary"
              size="mini"
              onClick={getCurrentLocation}
            >
              重试
            </NutButton>
          </CoverView>
        </CoverView>
      )}
    </View>
  );
};

export default MapView;