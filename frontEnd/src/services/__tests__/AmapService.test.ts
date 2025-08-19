import AmapService, { LocationInfo, SearchResult } from '../AmapService';

// Mock Taro APIs
jest.mock('@tarojs/taro', () => ({
  getLocation: jest.fn(),
  request: jest.fn(),
  getSetting: jest.fn(),
  authorize: jest.fn(),
  navigateToMiniProgram: jest.fn(),
  openLocation: jest.fn()
}));

import Taro from '@tarojs/taro';

describe('AmapService', () => {
  let amapService: AmapService;

  beforeEach(() => {
    jest.clearAllMocks();
    amapService = new AmapService();
  });

  describe('getCurrentLocation', () => {
    it('should get current location successfully', async () => {
      const mockLocationResult = {
        latitude: 39.908823,
        longitude: 116.397470,
        accuracy: 10,
        altitude: 50,
        speed: 0
      };

      const mockGeocodeResponse = {
        data: {
          status: '1',
          regeocode: {
            formatted_address: '北京市朝阳区',
            addressComponent: {
              province: '北京市',
              city: '北京市',
              district: '朝阳区',
              streetNumber: {
                street: '建国路',
                number: '1号'
              },
              adcode: '110105'
            }
          }
        }
      };

      (Taro.getLocation as jest.Mock).mockResolvedValue(mockLocationResult);
      (Taro.request as jest.Mock).mockResolvedValue(mockGeocodeResponse);

      const result = await amapService.getCurrentLocation();

      expect(result).toEqual({
        latitude: 39.908823,
        longitude: 116.397470,
        accuracy: 10,
        altitude: 50,
        speed: 0,
        address: '北京市朝阳区',
        city: '北京市',
        district: '朝阳区',
        province: '北京市',
        street: '建国路',
        streetNumber: '1号'
      });

      expect(Taro.getLocation).toHaveBeenCalledWith({
        type: 'gcj02',
        altitude: true,
        isHighAccuracy: true,
        highAccuracyExpireTime: 10000
      });
    });

    it('should handle location permission denied', async () => {
      const mockError = {
        errMsg: 'getLocation:fail auth deny'
      };

      (Taro.getLocation as jest.Mock).mockRejectedValue(mockError);

      await expect(amapService.getCurrentLocation()).rejects.toThrow(
        '定位权限被拒绝，请在设置中开启定位权限'
      );
    });

    it('should handle location timeout', async () => {
      const mockError = {
        errMsg: 'getLocation:fail timeout'
      };

      (Taro.getLocation as jest.Mock).mockRejectedValue(mockError);

      await expect(amapService.getCurrentLocation()).rejects.toThrow(
        '定位超时，请检查网络连接或稍后重试'
      );
    });

    it('should handle system location service disabled', async () => {
      const mockError = {
        errMsg: 'getLocation:fail system deny'
      };

      (Taro.getLocation as jest.Mock).mockRejectedValue(mockError);

      await expect(amapService.getCurrentLocation()).rejects.toThrow(
        '系统定位服务未开启，请在系统设置中开启定位服务'
      );
    });

    it('should handle generic location errors', async () => {
      const mockError = new Error('Unknown error');

      (Taro.getLocation as jest.Mock).mockRejectedValue(mockError);

      await expect(amapService.getCurrentLocation()).rejects.toThrow(
        '获取位置失败，请稍后重试'
      );
    });

    it('should continue without address if geocoding fails', async () => {
      const mockLocationResult = {
        latitude: 39.908823,
        longitude: 116.397470,
        accuracy: 10
      };

      (Taro.getLocation as jest.Mock).mockResolvedValue(mockLocationResult);
      (Taro.request as jest.Mock).mockRejectedValue(new Error('Geocoding failed'));

      const result = await amapService.getCurrentLocation();

      expect(result).toEqual({
        latitude: 39.908823,
        longitude: 116.397470,
        accuracy: 10
      });
    });
  });

  describe('reverseGeocode', () => {
    it('should perform reverse geocoding successfully', async () => {
      const mockResponse = {
        data: {
          status: '1',
          regeocode: {
            formatted_address: '北京市朝阳区建国路1号',
            addressComponent: {
              province: '北京市',
              city: '北京市',
              district: '朝阳区',
              streetNumber: {
                street: '建国路',
                number: '1号'
              },
              adcode: '110105'
            }
          }
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await amapService.reverseGeocode(39.908823, 116.397470);

      expect(result).toEqual({
        latitude: 39.908823,
        longitude: 116.397470,
        address: '北京市朝阳区建国路1号',
        addressComponent: {
          province: '北京市',
          city: '北京市',
          district: '朝阳区',
          street: '建国路',
          streetNumber: '1号',
          adcode: '110105'
        }
      });

      expect(Taro.request).toHaveBeenCalledWith({
        url: 'https://restapi.amap.com/v3/geocode/regeo',
        data: {
          key: 'your-amap-web-api-key',
          location: '116.397470,39.908823',
          poitype: '',
          radius: 1000,
          extensions: 'base',
          batch: false,
          roadlevel: 0
        },
        method: 'GET'
      });
    });

    it('should handle reverse geocoding API errors', async () => {
      const mockResponse = {
        data: {
          status: '0',
          info: 'Invalid parameters'
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      await expect(amapService.reverseGeocode(39.908823, 116.397470))
        .rejects.toThrow('Invalid parameters');
    });

    it('should handle network errors', async () => {
      (Taro.request as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(amapService.reverseGeocode(39.908823, 116.397470))
        .rejects.toThrow('获取地址信息失败');
    });
  });

  describe('geocode', () => {
    it('should perform geocoding successfully', async () => {
      const mockResponse = {
        data: {
          status: '1',
          geocodes: [{
            formatted_address: '北京市朝阳区建国路1号',
            location: '116.397470,39.908823',
            province: '北京市',
            city: '北京市',
            district: '朝阳区',
            adcode: '110105'
          }]
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await amapService.geocode('北京市朝阳区建国路1号', '北京市');

      expect(result).toEqual({
        latitude: 39.908823,
        longitude: 116.397470,
        address: '北京市朝阳区建国路1号',
        addressComponent: {
          province: '北京市',
          city: '北京市',
          district: '朝阳区',
          street: '',
          streetNumber: '',
          adcode: '110105'
        }
      });
    });

    it('should handle geocoding without city parameter', async () => {
      const mockResponse = {
        data: {
          status: '1',
          geocodes: [{
            formatted_address: '北京市朝阳区建国路1号',
            location: '116.397470,39.908823',
            province: '北京市',
            city: '北京市',
            district: '朝阳区',
            adcode: '110105'
          }]
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      await amapService.geocode('北京市朝阳区建国路1号');

      expect(Taro.request).toHaveBeenCalledWith({
        url: 'https://restapi.amap.com/v3/geocode/geo',
        data: {
          key: 'your-amap-web-api-key',
          address: '北京市朝阳区建国路1号',
          batch: false
        },
        method: 'GET'
      });
    });

    it('should handle geocoding API errors', async () => {
      const mockResponse = {
        data: {
          status: '0',
          info: 'Address not found'
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      await expect(amapService.geocode('Invalid address'))
        .rejects.toThrow('Address not found');
    });
  });

  describe('searchPOI', () => {
    it('should search POI successfully', async () => {
      const mockResponse = {
        data: {
          status: '1',
          pois: [{
            id: 'poi1',
            name: '充电站1',
            address: '北京市朝阳区建国路1号',
            location: '116.397470,39.908823',
            distance: '100',
            type: '充电站',
            tel: '010-12345678',
            business_area: '国贸'
          }]
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await amapService.searchPOI(
        '充电站',
        { latitude: 39.908823, longitude: 116.397470 },
        { radius: 3000, pageSize: 10 }
      );

      expect(result).toEqual([{
        id: 'poi1',
        name: '充电站1',
        address: '北京市朝阳区建国路1号',
        location: {
          latitude: 39.908823,
          longitude: 116.397470
        },
        distance: 100,
        type: '充电站',
        tel: '010-12345678',
        businessArea: '国贸'
      }]);
    });

    it('should search POI without location', async () => {
      const mockResponse = {
        data: {
          status: '1',
          pois: [{
            id: 'poi1',
            name: '充电站1',
            address: '北京市朝阳区建国路1号',
            location: '116.397470,39.908823',
            type: '充电站'
          }]
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await amapService.searchPOI('充电站');

      expect(result).toHaveLength(1);
      expect(result[0].distance).toBeUndefined();
    });

    it('should return empty array when no results found', async () => {
      const mockResponse = {
        data: {
          status: '1',
          pois: []
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await amapService.searchPOI('nonexistent');

      expect(result).toEqual([]);
    });

    it('should handle search API errors', async () => {
      (Taro.request as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(amapService.searchPOI('充电站'))
        .rejects.toThrow('搜索失败，请稍后重试');
    });
  });

  describe('searchNearby', () => {
    it('should search nearby POI successfully', async () => {
      const mockResponse = {
        data: {
          status: '1',
          pois: [{
            id: 'poi1',
            name: '附近充电站',
            address: '北京市朝阳区建国路2号',
            location: '116.398470,39.909823',
            distance: '200',
            type: '充电站'
          }]
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await amapService.searchNearby(
        { latitude: 39.908823, longitude: 116.397470 },
        '充电站',
        { radius: 2000 }
      );

      expect(result).toEqual([{
        id: 'poi1',
        name: '附近充电站',
        address: '北京市朝阳区建国路2号',
        location: {
          latitude: 39.909823,
          longitude: 116.398470
        },
        distance: 200,
        type: '充电站',
        tel: undefined,
        businessArea: undefined
      }]);

      expect(Taro.request).toHaveBeenCalledWith({
        url: 'https://restapi.amap.com/v3/place/around',
        data: {
          key: 'your-amap-web-api-key',
          location: '116.397470,39.908823',
          radius: 2000,
          page: 1,
          offset: 20,
          extensions: 'base',
          sortrule: 'distance',
          keywords: '充电站'
        },
        method: 'GET'
      });
    });
  });

  describe('getRoute', () => {
    it('should get route successfully', async () => {
      const mockResponse = {
        data: {
          status: '1',
          route: {
            paths: [{
              distance: '5000',
              duration: '600',
              polyline: 'polyline_data',
              steps: [{
                instruction: '向北行驶100米',
                distance: '100',
                duration: '60',
                polyline: 'step_polyline'
              }]
            }]
          }
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await amapService.getRoute(
        { latitude: 39.908823, longitude: 116.397470 },
        { latitude: 39.918823, longitude: 116.407470 },
        'fastest'
      );

      expect(result).toEqual({
        distance: 5000,
        duration: 600,
        polyline: 'polyline_data',
        steps: [{
          instruction: '向北行驶100米',
          distance: 100,
          duration: 60,
          polyline: 'step_polyline'
        }]
      });
    });

    it('should handle different route strategies', async () => {
      const mockResponse = {
        data: {
          status: '1',
          route: {
            paths: [{
              distance: '5000',
              duration: '600',
              steps: []
            }]
          }
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      await amapService.getRoute(
        { latitude: 39.908823, longitude: 116.397470 },
        { latitude: 39.918823, longitude: 116.407470 },
        'avoid_highway'
      );

      expect(Taro.request).toHaveBeenCalledWith({
        url: 'https://restapi.amap.com/v3/direction/driving',
        data: {
          key: 'your-amap-web-api-key',
          origin: '116.397470,39.908823',
          destination: '116.407470,39.918823',
          strategy: 3, // avoid_highway strategy
          extensions: 'base',
          waypoints: ''
        },
        method: 'GET'
      });
    });

    it('should handle route API errors', async () => {
      const mockResponse = {
        data: {
          status: '0',
          info: 'Route not found'
        }
      };

      (Taro.request as jest.Mock).mockResolvedValue(mockResponse);

      await expect(amapService.getRoute(
        { latitude: 39.908823, longitude: 116.397470 },
        { latitude: 39.918823, longitude: 116.407470 }
      )).rejects.toThrow('Route not found');
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      const point1 = { latitude: 39.908823, longitude: 116.397470 };
      const point2 = { latitude: 39.918823, longitude: 116.407470 };

      const distance = amapService.calculateDistance(point1, point2);

      // The distance should be approximately 1400 meters
      expect(distance).toBeGreaterThan(1300);
      expect(distance).toBeLessThan(1500);
    });

    it('should return 0 for identical points', () => {
      const point = { latitude: 39.908823, longitude: 116.397470 };

      const distance = amapService.calculateDistance(point, point);

      expect(distance).toBe(0);
    });
  });

  describe('formatDistance', () => {
    it('should format distance in meters for short distances', () => {
      expect(amapService.formatDistance(500)).toBe('500m');
      expect(amapService.formatDistance(999)).toBe('999m');
    });

    it('should format distance in kilometers with decimal for medium distances', () => {
      expect(amapService.formatDistance(1500)).toBe('1.5km');
      expect(amapService.formatDistance(2300)).toBe('2.3km');
    });

    it('should format distance in kilometers without decimal for long distances', () => {
      expect(amapService.formatDistance(15000)).toBe('15km');
      expect(amapService.formatDistance(23000)).toBe('23km');
    });
  });

  describe('formatDuration', () => {
    it('should format duration in minutes for short durations', () => {
      expect(amapService.formatDuration(300)).toBe('5分钟');
      expect(amapService.formatDuration(1800)).toBe('30分钟');
    });

    it('should format duration in hours and minutes for long durations', () => {
      expect(amapService.formatDuration(3900)).toBe('1小时5分钟');
      expect(amapService.formatDuration(7200)).toBe('2小时0分钟');
    });

    it('should format very short durations', () => {
      expect(amapService.formatDuration(30)).toBe('1分钟内');
      expect(amapService.formatDuration(0)).toBe('1分钟内');
    });
  });

  describe('openNavigation', () => {
    it('should open Amap navigation successfully', async () => {
      (Taro.navigateToMiniProgram as jest.Mock).mockResolvedValue({});

      await amapService.openNavigation(
        { latitude: 39.918823, longitude: 116.407470 },
        '目的地',
        { latitude: 39.908823, longitude: 116.397470 }
      );

      expect(Taro.navigateToMiniProgram).toHaveBeenCalled();
    });

    it('should fallback to system map when Amap fails', async () => {
      (Taro.navigateToMiniProgram as jest.Mock).mockRejectedValue(new Error('Failed'));
      (Taro.openLocation as jest.Mock).mockResolvedValue({});

      await amapService.openNavigation(
        { latitude: 39.918823, longitude: 116.407470 },
        '目的地'
      );

      expect(Taro.openLocation).toHaveBeenCalledWith({
        latitude: 39.918823,
        longitude: 116.407470,
        name: '目的地',
        address: '',
        scale: 18
      });
    });

    it('should throw error when both navigation methods fail', async () => {
      (Taro.navigateToMiniProgram as jest.Mock).mockRejectedValue(new Error('Failed'));
      (Taro.openLocation as jest.Mock).mockRejectedValue(new Error('Failed'));

      await expect(amapService.openNavigation(
        { latitude: 39.918823, longitude: 116.407470 }
      )).rejects.toThrow('无法打开地图导航');
    });
  });

  describe('Permission Management', () => {
    it('should check location permission successfully', async () => {
      (Taro.getSetting as jest.Mock).mockResolvedValue({
        authSetting: {
          'scope.userLocation': true
        }
      });

      const hasPermission = await amapService.checkLocationPermission();

      expect(hasPermission).toBe(true);
    });

    it('should return false when location permission not granted', async () => {
      (Taro.getSetting as jest.Mock).mockResolvedValue({
        authSetting: {
          'scope.userLocation': false
        }
      });

      const hasPermission = await amapService.checkLocationPermission();

      expect(hasPermission).toBe(false);
    });

    it('should request location permission successfully', async () => {
      (Taro.authorize as jest.Mock).mockResolvedValue({});

      const granted = await amapService.requestLocationPermission();

      expect(granted).toBe(true);
      expect(Taro.authorize).toHaveBeenCalledWith({
        scope: 'scope.userLocation'
      });
    });

    it('should handle permission request denial', async () => {
      (Taro.authorize as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      const granted = await amapService.requestLocationPermission();

      expect(granted).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return service configuration', () => {
      const config = amapService.getConfig();

      expect(config).toEqual({
        apiKey: '未配置',
        webApiKey: '未配置',
        baseUrl: 'https://restapi.amap.com/v3',
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
      });
    });
  });
});