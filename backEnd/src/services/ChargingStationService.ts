import ChargingStation, { IChargingStation, IChargingPile } from '../models/ChargingStation';
import { RedisService } from './RedisService';
import { logger } from '../utils/logger';

export interface StationSearchFilters {
  city?: string;
  district?: string;
  operator?: string;
  connectorType?: string[];
  powerRange?: { min: number; max: number };
  priceRange?: { min: number; max: number };
  services?: string[];
  status?: string[];
  rating?: { min: number };
  availability?: 'available' | 'all';
}

export interface StationSearchOptions {
  page?: number;
  limit?: number;
  sortBy?: 'distance' | 'rating' | 'price' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface StationImportData {
  stationId: string;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  city: string;
  district: string;
  province: string;
  operator: {
    name: string;
    phone: string;
    email?: string;
  };
  piles: Array<{
    pileId: string;
    pileNumber: string;
    type: 'AC' | 'DC' | 'AC_DC';
    power: number;
    voltage: number;
    current: number;
    connectorType: string[];
    price: {
      servicePrice: number;
      electricityPrice: number;
      parkingPrice?: number;
    };
  }>;
  openTime: {
    start: string;
    end: string;
    is24Hours: boolean;
  };
  services?: string[];
  contact?: {
    phone?: string;
    emergencyPhone?: string;
  };
  images?: string[];
  description?: string;
}

export class ChargingStationService {
  private redis: RedisService;
  private readonly CACHE_TTL = 300; // 5分钟缓存
  private readonly NEARBY_CACHE_TTL = 60; // 1分钟缓存

  constructor() {
    this.redis = new RedisService();
  }

  /**
   * 创建充电站
   */
  async createStation(stationData: StationImportData): Promise<IChargingStation> {
    try {
      console.log('📝 创建充电站:', stationData.name);

      // 检查充电站是否已存在
      const existingStation = await ChargingStation.findOne({ 
        stationId: stationData.stationId 
      });

      if (existingStation) {
        throw new Error(`充电站 ${stationData.stationId} 已存在`);
      }

      // 处理充电桩数据
      const piles: IChargingPile[] = stationData.piles.map(pileData => ({
        ...pileData,
        status: 'available',
        installDate: new Date()
      } as IChargingPile));

      // 创建充电站
      const station = new ChargingStation({
        stationId: stationData.stationId,
        name: stationData.name,
        address: stationData.address,
        location: {
          type: 'Point',
          coordinates: [stationData.longitude, stationData.latitude]
        },
        city: stationData.city,
        district: stationData.district,
        province: stationData.province,
        operator: stationData.operator,
        piles,
        totalPiles: piles.length,
        availablePiles: piles.length,
        openTime: stationData.openTime,
        services: stationData.services || [],
        contact: stationData.contact || {},
        images: stationData.images || [],
        description: stationData.description,
        status: 'active',
        isVerified: false,
        rating: {
          average: 0,
          count: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        },
        stats: {
          totalSessions: 0,
          totalEnergy: 0,
          totalRevenue: 0,
          averageSessionDuration: 0,
          peakHours: []
        }
      });

      await station.save();

      // 清除相关缓存
      await this.clearLocationCache(stationData.city);

      console.log('✅ 充电站创建成功:', station.stationId);
      return station;

    } catch (error: any) {
      logger.error('Create charging station failed', { stationData: stationData.name, error: error.message }, error.stack);
      throw new Error(`创建充电站失败: ${error.message}`);
    }
  }

  /**
   * 更新充电站信息
   */
  async updateStation(stationId: string, updateData: Partial<StationImportData>): Promise<IChargingStation> {
    try {
      console.log('📝 更新充电站:', stationId);

      const station = await ChargingStation.findOne({ stationId });
      if (!station) {
        throw new Error('充电站不存在');
      }

      // 更新基本信息
      if (updateData.name) station.name = updateData.name;
      if (updateData.address) station.address = updateData.address;
      if (updateData.longitude && updateData.latitude) {
        station.location.coordinates = [updateData.longitude, updateData.latitude];
      }
      if (updateData.city) station.city = updateData.city;
      if (updateData.district) station.district = updateData.district;
      if (updateData.province) station.province = updateData.province;
      if (updateData.operator) station.operator = updateData.operator;
      if (updateData.openTime) station.openTime = updateData.openTime;
      if (updateData.services) station.services = updateData.services;
      if (updateData.contact) station.contact = updateData.contact;
      if (updateData.images) station.images = updateData.images;
      if (updateData.description) station.description = updateData.description;

      // 更新充电桩信息
      if (updateData.piles) {
        station.piles = updateData.piles.map(pileData => ({
          ...pileData,
          status: 'available',
          installDate: new Date()
        } as IChargingPile));
      }

      await station.save();

      // 清除缓存
      await this.clearStationCache(stationId);
      await this.clearLocationCache(station.city);

      console.log('✅ 充电站更新成功:', stationId);
      return station;

    } catch (error: any) {
      logger.error('Update charging station failed', { stationId, error: error.message }, error.stack);
      throw new Error(`更新充电站失败: ${error.message}`);
    }
  }

  /**
   * 删除充电站
   */
  async deleteStation(stationId: string): Promise<void> {
    try {
      console.log('🗑️ 删除充电站:', stationId);

      const station = await ChargingStation.findOne({ stationId });
      if (!station) {
        throw new Error('充电站不存在');
      }

      // 软删除：设置状态为inactive
      station.status = 'inactive';
      await station.save();

      // 清除缓存
      await this.clearStationCache(stationId);
      await this.clearLocationCache(station.city);

      console.log('✅ 充电站删除成功:', stationId);

    } catch (error: any) {
      logger.error('Delete charging station failed', { stationId, error: error.message }, error.stack);
      throw new Error(`删除充电站失败: ${error.message}`);
    }
  }

  /**
   * 获取充电站详情
   */
  async getStationById(stationId: string): Promise<IChargingStation | null> {
    try {
      // 尝试从缓存获取
      const cacheKey = `station:${stationId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // 从数据库获取
      const station = await ChargingStation.findOne({ 
        stationId, 
        status: { $ne: 'inactive' } 
      });

      if (station) {
        // 缓存结果
        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(station));
      }

      return station;

    } catch (error: any) {
      logger.error('Get charging station details failed', { stationId, error: error.message }, error.stack);
      throw new Error(`获取充电站详情失败: ${error.message}`);
    }
  }

  /**
   * 搜索附近充电站
   */
  async findNearbyStations(
    latitude: number,
    longitude: number,
    radius = 5000,
    filters: StationSearchFilters = {},
    options: StationSearchOptions = {}
  ): Promise<{ stations: IChargingStation[]; total: number; page: number; totalPages: number }> {
    try {
      console.log('🔍 搜索附近充电站:', { latitude, longitude, radius });

      const { page = 1, limit = 20, sortBy = 'distance', sortOrder = 'asc' } = options;
      const skip = (page - 1) * limit;

      // 构建查询条件
      const query = this.buildSearchQuery(filters);

      // 地理位置查询
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: radius
        }
      };

      // 执行查询
      const stations = await ChargingStation.find(query)
        .skip(skip)
        .limit(limit)
        .sort(this.buildSortOptions(sortBy, sortOrder));

      // 计算距离并添加到结果中
      const stationsWithDistance = stations.map(station => {
        const distance = station.calculateDistance(latitude, longitude);
        return {
          ...station.toObject(),
          distance
        };
      });

      // 获取总数
      const total = await ChargingStation.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      console.log(`✅ 找到 ${stations.length} 个附近充电站`);

      return {
        stations: stationsWithDistance as IChargingStation[],
        total,
        page,
        totalPages
      };

    } catch (error: any) {
      logger.error('Find nearby charging stations failed', { latitude, longitude, radius, error: error.message }, error.stack);
      throw new Error(`搜索附近充电站失败: ${error.message}`);
    }
  }

  /**
   * 关键词搜索充电站
   */
  async searchStations(
    keyword: string,
    location?: { latitude: number; longitude: number },
    radius = 10000,
    filters: StationSearchFilters = {},
    options: StationSearchOptions = {}
  ): Promise<{ stations: IChargingStation[]; total: number; page: number; totalPages: number }> {
    try {
      console.log('🔍 关键词搜索充电站:', keyword);

      const { page = 1, limit = 20, sortBy = 'rating', sortOrder = 'desc' } = options;
      const skip = (page - 1) * limit;

      // 构建搜索查询
      const query = this.buildSearchQuery(filters);

      // 添加关键词搜索
      query.$or = [
        { name: new RegExp(keyword, 'i') },
        { address: new RegExp(keyword, 'i') },
        { 'operator.name': new RegExp(keyword, 'i') },
        { city: new RegExp(keyword, 'i') },
        { district: new RegExp(keyword, 'i') }
      ];

      // 如果提供了位置，添加地理位置限制
      if (location) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [location.longitude, location.latitude]
            },
            $maxDistance: radius
          }
        };
      }

      // 执行查询
      const stations = await ChargingStation.find(query)
        .skip(skip)
        .limit(limit)
        .sort(this.buildSortOptions(sortBy, sortOrder));

      // 如果有位置信息，计算距离
      const stationsWithDistance = location ? stations.map(station => {
        const distance = station.calculateDistance(location.latitude, location.longitude);
        return {
          ...station.toObject(),
          distance
        };
      }) : stations.map(station => station.toObject());

      // 获取总数
      const total = await ChargingStation.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      console.log(`✅ 搜索到 ${stations.length} 个充电站`);

      return {
        stations: stationsWithDistance as IChargingStation[],
        total,
        page,
        totalPages
      };

    } catch (error: any) {
      logger.error('Search charging stations failed', { keyword, error: error.message }, error.stack);
      throw new Error(`搜索充电站失败: ${error.message}`);
    }
  }

  /**
   * 获取运营商充电站列表
   */
  async getStationsByOperator(
    operatorName: string,
    options: StationSearchOptions = {}
  ): Promise<{ stations: IChargingStation[]; total: number; page: number; totalPages: number }> {
    try {
      console.log('🏢 获取运营商充电站:', operatorName);

      const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = options;
      const skip = (page - 1) * limit;

      const query = {
        'operator.name': new RegExp(operatorName, 'i'),
        status: 'active'
      };

      const stations = await ChargingStation.find(query)
        .skip(skip)
        .limit(limit)
        .sort(this.buildSortOptions(sortBy, sortOrder));

      const total = await ChargingStation.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      return {
        stations,
        total,
        page,
        totalPages
      };

    } catch (error: any) {
      logger.error('Get stations by operator failed', { operatorName, error: error.message }, error.stack);
      throw new Error(`获取运营商充电站失败: ${error.message}`);
    }
  }

  /**
   * 更新充电桩状态
   */
  async updatePileStatus(stationId: string, pileId: string, status: string): Promise<void> {
    try {
      console.log('🔄 更新充电桩状态:', { stationId, pileId, status });

      const station = await ChargingStation.findOne({ stationId });
      if (!station) {
        throw new Error('充电站不存在');
      }

      await station.updatePileStatus(pileId, status);

      // 清除缓存
      await this.clearStationCache(stationId);

      console.log('✅ 充电桩状态更新成功');

    } catch (error: any) {
      logger.error('Update pile status failed', { stationId, pileId, status, error: error.message }, error.stack);
      throw new Error(`更新充电桩状态失败: ${error.message}`);
    }
  }

  /**
   * 批量更新充电桩状态
   */
  async batchUpdatePileStatuses(
    updates: Array<{ stationId: string; pileId: string; status: string }>
  ): Promise<void> {
    try {
      console.log('🔄 批量更新充电桩状态:', updates.length);

      await ChargingStation.updatePileStatuses(updates);

      // 清除相关缓存
      const stationIds = [...new Set(updates.map(u => u.stationId))];
      for (const stationId of stationIds) {
        await this.clearStationCache(stationId);
      }

      console.log('✅ 批量更新充电桩状态成功');

    } catch (error: any) {
      logger.error('Batch update pile statuses failed', { updatesCount: updates.length, error: error.message }, error.stack);
      throw new Error(`批量更新充电桩状态失败: ${error.message}`);
    }
  }

  /**
   * 从外部API同步数据
   */
  async syncFromExternalAPI(apiData: StationImportData[]): Promise<{ created: number; updated: number }> {
    try {
      console.log('🔄 从外部API同步数据:', apiData.length);

      const result = await ChargingStation.syncFromExternalAPI(apiData);

      // 清除所有位置相关缓存
      await this.clearAllLocationCache();

      console.log('✅ 数据同步完成:', result);
      return result;

    } catch (error: any) {
      logger.error('Sync from external API failed', { dataCount: apiData.length, error: error.message }, error.stack);
      throw new Error(`数据同步失败: ${error.message}`);
    }
  }

  /**
   * 获取充电站统计信息
   */
  async getStatistics(filters: StationSearchFilters = {}): Promise<any> {
    try {
      console.log('📊 获取充电站统计信息');

      const cacheKey = `stats:${JSON.stringify(filters)}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const query = this.buildSearchQuery(filters);
      const stats = await ChargingStation.getStatistics(query);

      // 添加额外统计信息
      const operatorStats = await ChargingStation.aggregate([
        { $match: query },
        { $group: { _id: '$operator.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      const cityStats = await ChargingStation.aggregate([
        { $match: query },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      const result = {
        ...stats,
        topOperators: operatorStats,
        topCities: cityStats
      };

      // 缓存结果
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

      return result;

    } catch (error: any) {
      logger.error('Get statistics failed', { filters, error: error.message }, error.stack);
      throw new Error(`获取统计信息失败: ${error.message}`);
    }
  }

  /**
   * 构建搜索查询条件
   */
  private buildSearchQuery(filters: StationSearchFilters): any {
    const query: any = { status: 'active' };

    if (filters.city) {
      query.city = new RegExp(filters.city, 'i');
    }

    if (filters.district) {
      query.district = new RegExp(filters.district, 'i');
    }

    if (filters.operator) {
      query['operator.name'] = new RegExp(filters.operator, 'i');
    }

    if (filters.connectorType && filters.connectorType.length > 0) {
      query['piles.connectorType'] = { $in: filters.connectorType };
    }

    if (filters.powerRange) {
      query['piles.power'] = {
        $gte: filters.powerRange.min,
        $lte: filters.powerRange.max
      };
    }

    if (filters.priceRange) {
      query.$or = [
        {
          'priceRange.minServicePrice': {
            $gte: filters.priceRange.min,
            $lte: filters.priceRange.max
          }
        },
        {
          'priceRange.minElectricityPrice': {
            $gte: filters.priceRange.min,
            $lte: filters.priceRange.max
          }
        }
      ];
    }

    if (filters.services && filters.services.length > 0) {
      query.services = { $in: filters.services };
    }

    if (filters.rating && filters.rating.min) {
      query['rating.average'] = { $gte: filters.rating.min };
    }

    if (filters.availability === 'available') {
      query.availablePiles = { $gt: 0 };
    }

    return query;
  }

  /**
   * 构建排序选项
   */
  private buildSortOptions(sortBy: string, sortOrder: string): any {
    const order = sortOrder === 'desc' ? -1 : 1;

    switch (sortBy) {
      case 'rating':
        return { 'rating.average': order, 'rating.count': -1 };
      case 'price':
        return { 'priceRange.minServicePrice': order };
      case 'name':
        return { name: order };
      case 'distance':
      default:
        return {}; // 距离排序由$near自动处理
    }
  }

  /**
   * 清除充电站缓存
   */
  private async clearStationCache(stationId: string): Promise<void> {
    try {
      await this.redis.del(`station:${stationId}`);
    } catch (error) {
      console.warn('⚠️ 清除充电站缓存失败:', error);
    }
  }

  /**
   * 清除位置相关缓存
   */
  private async clearLocationCache(city: string): Promise<void> {
    try {
      const pattern = `nearby:${city}:*`;
      const keys = await this.redis.getClient().keys(pattern);
      if (keys.length > 0) {
        await this.redis.getClient().del(...keys);
      }
    } catch (error) {
      console.warn('⚠️ 清除位置缓存失败:', error);
    }
  }

  /**
   * 清除所有位置相关缓存
   */
  private async clearAllLocationCache(): Promise<void> {
    try {
      const patterns = ['nearby:*', 'stats:*', 'search:*'];
      for (const pattern of patterns) {
        const keys = await this.redis.getClient().keys(pattern);
        if (keys.length > 0) {
          await this.redis.getClient().del(...keys);
        }
      }
    } catch (error) {
      console.warn('⚠️ 清除所有缓存失败:', error);
    }
  }

  /**
   * 获取服务配置
   */
  getConfig(): any {
    return {
      cacheSettings: {
        stationCacheTTL: this.CACHE_TTL,
        nearbyCacheTTL: this.NEARBY_CACHE_TTL
      },
      searchLimits: {
        maxRadius: 50000, // 50km
        maxResults: 100,
        defaultRadius: 5000 // 5km
      },
      supportedConnectorTypes: [
        'GB/T', 'CCS', 'CHAdeMO', 'Tesla', 'Type2', 'CCS2'
      ],
      supportedServices: [
        'parking', 'restaurant', 'restroom', 'wifi', 'shop', 
        'repair', 'car_wash', 'convenience_store'
      ],
      pileTypes: ['AC', 'DC', 'AC_DC'],
      statusTypes: ['available', 'occupied', 'offline', 'maintenance', 'reserved']
    };
  }
}

export default ChargingStationService;