import Taro from '@tarojs/taro';
import { TaroSafe } from '../utils/taroSafe'
import { DISTANCE_CONSTANTS, TIME_CONSTANTS } from '../utils/constants'

export interface LocationInfo {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  address?: string;
  city?: string;
  district?: string;
  province?: string;
  street?: string;
  streetNumber?: string;
  poiName?: string;
}

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  iconPath?: string;
  width?: number;
  height?: number;
  callout?: {
    content: string;
    color?: string;
    fontSize?: number;
    borderRadius?: number;
    bgColor?: string;
    padding?: number;
    display?: 'BYCLICK' | 'ALWAYS';
  };
  label?: {
    content: string;
    color?: string;
    fontSize?: number;
    x?: number;
    y?: number;
  };
}

export interface RouteInfo {
  distance: number; // 距离（米）
  duration: number; // 时间（秒）
  steps: RouteStep[];
  polyline?: string;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  polyline?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
  type?: string;
  tel?: string;
  businessArea?: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  address: string;
  addressComponent: {
    province: string;
    city: string;
    district: string;
    street: string;
    streetNumber: string;
    adcode: string;
  };
}

export class AmapService {
  private apiKey: string;
  private webApiKey: string;
  private baseUrl: string;
  
  constructor() {
    // 从环境变量获取API密钥，未配置时抛出错误
    this.apiKey = process.env.TARO_APP_AMAP_API_KEY || (() => {
      throw new Error('高德地图API密钥未配置，请设置环境变量 TARO_APP_AMAP_API_KEY');
    })();
    this.webApiKey = process.env.TARO_APP_AMAP_WEB_API_KEY || (() => {
      throw new Error('高德地图Web API密钥未配置，请设置环境变量 TARO_APP_AMAP_WEB_API_KEY');
    })();
    this.baseUrl = process.env.TARO_APP_AMAP_BASE_URL || 'https://restapi.amap.com/v3';
  }

  /**
   * 获取当前位置
   */
  async getCurrentLocation(): Promise<LocationInfo> {
    try {
      console.log('📍 开始获取当前位置');

      const result = await Taro.getLocation({
        type: 'gcj02', // 高德地图坐标系
        altitude: true,
        isHighAccuracy: true,
        highAccuracyExpireTime: TIME_CONSTANTS.TEN_SECONDS
      });

      const location: LocationInfo = {
        latitude: result.latitude,
        longitude: result.longitude,
        accuracy: result.accuracy,
        altitude: result.altitude,
        speed: result.speed
      };

      // 逆地理编码获取地址信息
      try {
        const addressInfo = await this.reverseGeocode(result.latitude, result.longitude);
        Object.assign(location, {
          address: addressInfo.address,
          city: addressInfo.addressComponent.city,
          district: addressInfo.addressComponent.district,
          province: addressInfo.addressComponent.province,
          street: addressInfo.addressComponent.street,
          streetNumber: addressInfo.addressComponent.streetNumber
        });
      } catch (error) {
        console.warn('⚠️ 获取地址信息失败:', error);
      }

      console.log('✅ 获取位置成功:', location);
      return location;

    } catch (error: any) {
      console.error('❌ 获取位置失败:', error);
      
      // 处理不同的错误类型
      if (error.errMsg?.includes('auth deny')) {
        throw new Error('定位权限被拒绝，请在设置中开启定位权限');
      } else if (error.errMsg?.includes('timeout')) {
        throw new Error('定位超时，请检查网络连接或稍后重试');
      } else if (error.errMsg?.includes('system deny')) {
        throw new Error('系统定位服务未开启，请在系统设置中开启定位服务');
      } else {
        throw new Error('获取位置失败，请稍后重试');
      }
    }
  }

  /**
   * 逆地理编码 - 根据坐标获取地址
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult> {
    try {
      const url = `${this.baseUrl}/geocode/regeo`;
      const params = {
        key: this.webApiKey,
        location: `${longitude},${latitude}`,
        poitype: '',
        radius: DISTANCE_CONSTANTS.ONE_KM,
        extensions: 'base',
        batch: false,
        roadlevel: 0
      };

      const response = await Taro.request({
        url,
        data: params,
        method: 'GET'
      });

      if (response.data.status === '1' && response.data.regeocode) {
        const regeocode = response.data.regeocode;
        const addressComponent = regeocode.addressComponent;
        
        return {
          latitude,
          longitude,
          address: regeocode.formatted_address,
          addressComponent: {
            province: addressComponent.province,
            city: addressComponent.city,
            district: addressComponent.district,
            street: addressComponent.streetNumber?.street || '',
            streetNumber: addressComponent.streetNumber?.number || '',
            adcode: addressComponent.adcode
          }
        };
      } else {
        throw new Error(response.data.info || '逆地理编码失败');
      }

    } catch (error: any) {
      console.error('❌ 逆地理编码失败:', error);
      throw new Error('获取地址信息失败');
    }
  }

  /**
   * 地理编码 - 根据地址获取坐标
   */
  async geocode(address: string, city?: string): Promise<GeocodingResult> {
    try {
      const url = `${this.baseUrl}/geocode/geo`;
      const params: any = {
        key: this.webApiKey,
        address,
        batch: false
      };

      if (city) {
        params.city = city;
      }

      const response = await Taro.request({
        url,
        data: params,
        method: 'GET'
      });

      if (response.data.status === '1' && response.data.geocodes?.length > 0) {
        const geocode = response.data.geocodes[0];
        const location = geocode.location.split(',');
        
        return {
          latitude: parseFloat(location[1]),
          longitude: parseFloat(location[0]),
          address: geocode.formatted_address,
          addressComponent: {
            province: geocode.province,
            city: geocode.city,
            district: geocode.district,
            street: '',
            streetNumber: '',
            adcode: geocode.adcode
          }
        };
      } else {
        throw new Error(response.data.info || '地理编码失败');
      }

    } catch (error: any) {
      console.error('❌ 地理编码失败:', error);
      throw new Error('地址解析失败');
    }
  }

  /**
   * 搜索POI
   */
  async searchPOI(
    keyword: string, 
    location?: { latitude: number; longitude: number },
    options?: {
      city?: string;
      radius?: number;
      page?: number;
      pageSize?: number;
      types?: string;
    }
  ): Promise<SearchResult[]> {
    try {
      const url = `${this.baseUrl}/place/text`;
      const params: any = {
        key: this.webApiKey,
        keywords: keyword,
        page: options?.page || 1,
        offset: options?.pageSize || 20,
        extensions: 'base'
      };

      if (location) {
        params.location = `${location.longitude},${location.latitude}`;
        params.radius = options?.radius || DISTANCE_CONSTANTS.FIVE_KM;
        params.sortrule = 'distance';
      }

      if (options?.city) {
        params.city = options.city;
      }

      if (options?.types) {
        params.types = options.types;
      }

      const response = await Taro.request({
        url,
        data: params,
        method: 'GET'
      });

      if (response.data.status === '1' && response.data.pois) {
        return response.data.pois.map((poi: any) => {
          const locationArr = poi.location.split(',');
          return {
            id: poi.id,
            name: poi.name,
            address: poi.address,
            location: {
              latitude: parseFloat(locationArr[1]),
              longitude: parseFloat(locationArr[0])
            },
            distance: poi.distance ? parseInt(poi.distance) : undefined,
            type: poi.type,
            tel: poi.tel,
            businessArea: poi.business_area
          };
        });
      } else {
        return [];
      }

    } catch (error: any) {
      console.error('❌ POI搜索失败:', error);
      throw new Error('搜索失败，请稍后重试');
    }
  }

  /**
   * 周边搜索
   */
  async searchNearby(
    location: { latitude: number; longitude: number },
    keyword?: string,
    options?: {
      radius?: number;
      page?: number;
      pageSize?: number;
      types?: string;
    }
  ): Promise<SearchResult[]> {
    try {
      const url = `${this.baseUrl}/place/around`;
      const params: any = {
        key: this.webApiKey,
        location: `${location.longitude},${location.latitude}`,
        radius: options?.radius || DISTANCE_CONSTANTS.THREE_KM,
        page: options?.page || 1,
        offset: options?.pageSize || 20,
        extensions: 'base',
        sortrule: 'distance'
      };

      if (keyword) {
        params.keywords = keyword;
      }

      if (options?.types) {
        params.types = options.types;
      }

      const response = await Taro.request({
        url,
        data: params,
        method: 'GET'
      });

      if (response.data.status === '1' && response.data.pois) {
        return response.data.pois.map((poi: any) => {
          const locationArr = poi.location.split(',');
          return {
            id: poi.id,
            name: poi.name,
            address: poi.address,
            location: {
              latitude: parseFloat(locationArr[1]),
              longitude: parseFloat(locationArr[0])
            },
            distance: poi.distance ? parseInt(poi.distance) : undefined,
            type: poi.type,
            tel: poi.tel,
            businessArea: poi.business_area
          };
        });
      } else {
        return [];
      }

    } catch (error: any) {
      console.error('❌ 周边搜索失败:', error);
      throw new Error('周边搜索失败，请稍后重试');
    }
  }

  /**
   * 路径规划
   */
  async getRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    strategy: 'fastest' | 'shortest' | 'avoid_congestion' | 'avoid_highway' = 'fastest'
  ): Promise<RouteInfo> {
    try {
      const url = `${this.baseUrl}/direction/driving`;
      const strategyMap = {
        fastest: 0,
        shortest: 1,
        avoid_congestion: 2,
        avoid_highway: 3
      };

      const params = {
        key: this.webApiKey,
        origin: `${origin.longitude},${origin.latitude}`,
        destination: `${destination.longitude},${destination.latitude}`,
        strategy: strategyMap[strategy],
        extensions: 'base',
        waypoints: ''
      };

      const response = await Taro.request({
        url,
        data: params,
        method: 'GET'
      });

      if (response.data.status === '1' && response.data.route?.paths?.length > 0) {
        const path = response.data.route.paths[0];
        
        return {
          distance: parseInt(path.distance),
          duration: parseInt(path.duration),
          steps: path.steps.map((step: any) => ({
            instruction: step.instruction,
            distance: parseInt(step.distance),
            duration: parseInt(step.duration),
            polyline: step.polyline
          })),
          polyline: path.polyline
        };
      } else {
        throw new Error(response.data.info || '路径规划失败');
      }

    } catch (error: any) {
      console.error('❌ 路径规划失败:', error);
      throw new Error('路径规划失败，请稍后重试');
    }
  }

  /**
   * 计算两点间距离
   */
  calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371000; // 地球半径（米）
    const lat1Rad = (point1.latitude * Math.PI) / 180;
    const lat2Rad = (point2.latitude * Math.PI) / 180;
    const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLngRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return Math.round(R * c);
  }

  /**
   * 格式化距离显示
   */
  formatDistance(distance: number): string {
    if (distance < DISTANCE_CONSTANTS.ONE_KM) {
      return `${distance}m`;
    } else if (distance < DISTANCE_CONSTANTS.TEN_KM) {
      return `${(distance / DISTANCE_CONSTANTS.ONE_KM).toFixed(1)}km`;
    } else {
      return `${Math.round(distance / DISTANCE_CONSTANTS.ONE_KM)}km`;
    }
  }

  /**
   * 格式化时间显示
   */
  formatDuration(duration: number): string {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return '1分钟内';
    }
  }

  /**
   * 打开高德地图导航
   */
  async openNavigation(
    destination: { latitude: number; longitude: number },
    destinationName?: string,
    origin?: { latitude: number; longitude: number }
  ): Promise<void> {
    try {
      // 构建导航URL
      let url = `amapuri://route/plan/?dlat=${destination.latitude}&dlon=${destination.longitude}`;
      
      if (destinationName) {
        url += `&dname=${encodeURIComponent(destinationName)}`;
      }
      
      if (origin) {
        url += `&slat=${origin.latitude}&slon=${origin.longitude}`;
      }
      
      url += '&dev=0&t=0'; // dev=0表示高德坐标系，t=0表示驾车

      // 尝试打开高德地图
      await Taro.navigateToMiniProgram({
        appId: 'wx6d0b8b6b8b6b8b6b', // 高德地图小程序AppId（示例）
        path: `pages/index/index?url=${encodeURIComponent(url)}`,
        extraData: {},
        envVersion: 'release'
      });

    } catch (error) {
      console.warn('⚠️ 打开高德地图失败，尝试其他方式:', error);
      
      // 如果无法打开高德地图，尝试使用系统地图
      try {
        await Taro.openLocation({
          latitude: destination.latitude,
          longitude: destination.longitude,
          name: destinationName || '目的地',
          address: '',
          scale: 18
        });
      } catch (systemError) {
        console.error('❌ 打开系统地图也失败:', systemError);
        throw new Error('无法打开地图导航');
      }
    }
  }

  /**
   * 检查定位权限
   */
  async checkLocationPermission(): Promise<boolean> {
    try {
      const result = await Taro.getSetting();
      return result.authSetting['scope.userLocation'] === true;
    } catch (error) {
      console.error('❌ 检查定位权限失败:', error);
      return false;
    }
  }

  /**
   * 请求定位权限
   */
  async requestLocationPermission(): Promise<boolean> {
    try {
      await Taro.authorize({
        scope: 'scope.userLocation'
      });
      return true;
    } catch (error) {
      console.warn('⚠️ 用户拒绝定位权限:', error);
      return false;
    }
  }

  /**
   * 获取配置信息
   */
  getConfig() {
    return {
      apiKey: this.apiKey ? '已配置' : '未配置',
      webApiKey: this.webApiKey ? '已配置' : '未配置',
      baseUrl: this.baseUrl,
      coordinateSystem: 'GCJ-02',
      supportedFeatures: [
        '定位服务',
        '地理编码',
        '逆地理编码',
        'POI搜索',
        '周边搜索',
        '路径规划',
        '地图导航'
      ]
    };
  }
}

export default AmapService;