import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import ChargingStationService, { StationSearchFilters, StationSearchOptions } from '../services/ChargingStationService';
import {
  authenticateToken,
  optionalAuth,
  requireVerificationLevel,
  userRateLimit,
  logApiAccess
} from '../middleware/auth';

const router = express.Router();

// 充电站服务实例
const stationService = new ChargingStationService();

// 搜索附近充电站
router.get('/nearby',
  optionalAuth,
  logApiAccess,
  userRateLimit(30, 60000), // 每分钟最多30次请求
  asyncHandler(async (req: Request, res: Response) => {
    console.log('🔍 收到搜索附近充电站请求');

    const { 
      latitude, 
      longitude, 
      radius = 5000,
      page = 1,
      limit = 20,
      sortBy = 'distance',
      sortOrder = 'asc',
      ...filters 
    } = req.query;

    // 验证必需参数
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: '缺少位置参数 latitude 和 longitude'
      });
    }

    try {
      const searchFilters: StationSearchFilters = {
        city: filters.city as string,
        district: filters.district as string,
        operator: filters.operator as string,
        connectorType: filters.connectorType ? 
          (filters.connectorType as string).split(',') : undefined,
        powerRange: filters.minPower || filters.maxPower ? {
          min: parseInt(filters.minPower as string) || 0,
          max: parseInt(filters.maxPower as string) || 1000
        } : undefined,
        priceRange: filters.minPrice || filters.maxPrice ? {
          min: parseFloat(filters.minPrice as string) || 0,
          max: parseFloat(filters.maxPrice as string) || 10
        } : undefined,
        services: filters.services ? 
          (filters.services as string).split(',') : undefined,
        rating: filters.minRating ? {
          min: parseFloat(filters.minRating as string)
        } : undefined,
        availability: filters.availability as 'available' | 'all'
      };

      const searchOptions: StationSearchOptions = {
        page: parseInt(page as string),
        limit: Math.min(parseInt(limit as string), 50), // 最大50条
        sortBy: sortBy as any,
        sortOrder: sortOrder as any
      };

      const result = await stationService.findNearbyStations(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        parseInt(radius as string),
        searchFilters,
        searchOptions
      );

      res.json({
        success: true,
        message: '搜索附近充电站成功',
        data: result
      });

    } catch (error: any) {
      console.error('❌ 搜索附近充电站失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '搜索失败'
      });
    }
  })
);

// 关键词搜索充电站
router.get('/search',
  optionalAuth,
  logApiAccess,
  userRateLimit(20, 60000), // 每分钟最多20次搜索
  asyncHandler(async (req: Request, res: Response) => {
    console.log('🔍 收到关键词搜索请求');

    const { 
      keyword,
      latitude,
      longitude,
      radius = 10000,
      page = 1,
      limit = 20,
      sortBy = 'rating',
      sortOrder = 'desc',
      ...filters 
    } = req.query;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: '缺少搜索关键词'
      });
    }

    try {
      const location = latitude && longitude ? {
        latitude: parseFloat(latitude as string),
        longitude: parseFloat(longitude as string)
      } : undefined;

      const searchFilters: StationSearchFilters = {
        city: filters.city as string,
        district: filters.district as string,
        operator: filters.operator as string,
        connectorType: filters.connectorType ? 
          (filters.connectorType as string).split(',') : undefined,
        services: filters.services ? 
          (filters.services as string).split(',') : undefined,
        rating: filters.minRating ? {
          min: parseFloat(filters.minRating as string)
        } : undefined,
        availability: filters.availability as 'available' | 'all'
      };

      const searchOptions: StationSearchOptions = {
        page: parseInt(page as string),
        limit: Math.min(parseInt(limit as string), 50),
        sortBy: sortBy as any,
        sortOrder: sortOrder as any
      };

      const result = await stationService.searchStations(
        keyword as string,
        location,
        parseInt(radius as string),
        searchFilters,
        searchOptions
      );

      res.json({
        success: true,
        message: '搜索充电站成功',
        data: result
      });

    } catch (error: any) {
      console.error('❌ 搜索充电站失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '搜索失败'
      });
    }
  })
);

// 获取充电站详情
router.get('/:stationId',
  optionalAuth,
  logApiAccess,
  userRateLimit(60, 60000), // 每分钟最多60次详情请求
  asyncHandler(async (req: Request, res: Response) => {
    console.log('📋 收到获取充电站详情请求');

    const { stationId } = req.params;

    try {
      const station = await stationService.getStationById(stationId);

      if (!station) {
        return res.status(404).json({
          success: false,
          message: '充电站不存在'
        });
      }

      res.json({
        success: true,
        message: '获取充电站详情成功',
        data: station
      });

    } catch (error: any) {
      console.error('❌ 获取充电站详情失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取详情失败'
      });
    }
  })
);

// 获取运营商充电站列表
router.get('/operator/:operatorName',
  optionalAuth,
  logApiAccess,
  userRateLimit(20, 60000),
  asyncHandler(async (req: Request, res: Response) => {
    console.log('🏢 收到获取运营商充电站请求');

    const { operatorName } = req.params;
    const { 
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    try {
      const searchOptions: StationSearchOptions = {
        page: parseInt(page as string),
        limit: Math.min(parseInt(limit as string), 50),
        sortBy: sortBy as any,
        sortOrder: sortOrder as any
      };

      const result = await stationService.getStationsByOperator(
        operatorName,
        searchOptions
      );

      res.json({
        success: true,
        message: '获取运营商充电站成功',
        data: result
      });

    } catch (error: any) {
      console.error('❌ 获取运营商充电站失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取失败'
      });
    }
  })
);

// 获取充电站统计信息
router.get('/stats/overview',
  optionalAuth,
  logApiAccess,
  userRateLimit(10, 60000), // 每分钟最多10次统计请求
  asyncHandler(async (req: Request, res: Response) => {
    console.log('📊 收到获取统计信息请求');

    const { city, district, operator } = req.query;

    try {
      const filters: StationSearchFilters = {
        city: city as string,
        district: district as string,
        operator: operator as string
      };

      const stats = await stationService.getStatistics(filters);

      res.json({
        success: true,
        message: '获取统计信息成功',
        data: stats
      });

    } catch (error: any) {
      console.error('❌ 获取统计信息失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '获取统计信息失败'
      });
    }
  })
);

// 创建充电站（需要管理员权限）
router.post('/',
  authenticateToken,
  requireVerificationLevel('premium'),
  logApiAccess,
  userRateLimit(5, 60000), // 每分钟最多5次创建
  asyncHandler(async (req: Request, res: Response) => {
    console.log('📝 收到创建充电站请求');

    const stationData = req.body;

    // 验证必需字段
    const requiredFields = ['stationId', 'name', 'address', 'longitude', 'latitude', 'city', 'operator', 'piles'];
    const missingFields = requiredFields.filter(field => !stationData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `缺少必需字段: ${missingFields.join(', ')}`
      });
    }

    try {
      const station = await stationService.createStation(stationData);

      res.status(201).json({
        success: true,
        message: '创建充电站成功',
        data: station
      });

    } catch (error: any) {
      console.error('❌ 创建充电站失败:', error);
      res.status(400).json({
        success: false,
        message: error.message || '创建失败'
      });
    }
  })
);

// 更新充电站信息（需要管理员权限）
router.put('/:stationId',
  authenticateToken,
  requireVerificationLevel('premium'),
  logApiAccess,
  userRateLimit(10, 60000),
  asyncHandler(async (req: Request, res: Response) => {
    console.log('📝 收到更新充电站请求');

    const { stationId } = req.params;
    const updateData = req.body;

    try {
      const station = await stationService.updateStation(stationId, updateData);

      res.json({
        success: true,
        message: '更新充电站成功',
        data: station
      });

    } catch (error: any) {
      console.error('❌ 更新充电站失败:', error);
      res.status(400).json({
        success: false,
        message: error.message || '更新失败'
      });
    }
  })
);

// 删除充电站（需要管理员权限）
router.delete('/:stationId',
  authenticateToken,
  requireVerificationLevel('premium'),
  logApiAccess,
  userRateLimit(5, 60000),
  asyncHandler(async (req: Request, res: Response) => {
    console.log('🗑️ 收到删除充电站请求');

    const { stationId } = req.params;

    try {
      await stationService.deleteStation(stationId);

      res.json({
        success: true,
        message: '删除充电站成功'
      });

    } catch (error: any) {
      console.error('❌ 删除充电站失败:', error);
      res.status(400).json({
        success: false,
        message: error.message || '删除失败'
      });
    }
  })
);

// 更新充电桩状态
router.patch('/:stationId/piles/:pileId/status',
  authenticateToken,
  logApiAccess,
  userRateLimit(30, 60000), // 每分钟最多30次状态更新
  asyncHandler(async (req: Request, res: Response) => {
    console.log('🔄 收到更新充电桩状态请求');

    const { stationId, pileId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: '缺少状态参数'
      });
    }

    const validStatuses = ['available', 'occupied', 'offline', 'maintenance', 'reserved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `无效的状态值，支持的状态: ${validStatuses.join(', ')}`
      });
    }

    try {
      await stationService.updatePileStatus(stationId, pileId, status);

      res.json({
        success: true,
        message: '更新充电桩状态成功'
      });

    } catch (error: any) {
      console.error('❌ 更新充电桩状态失败:', error);
      res.status(400).json({
        success: false,
        message: error.message || '更新状态失败'
      });
    }
  })
);

// 批量更新充电桩状态
router.patch('/piles/batch-status',
  authenticateToken,
  requireVerificationLevel('premium'),
  logApiAccess,
  userRateLimit(5, 60000),
  asyncHandler(async (req: Request, res: Response) => {
    console.log('🔄 收到批量更新充电桩状态请求');

    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少更新数据或数据格式错误'
      });
    }

    // 验证更新数据格式
    const validStatuses = ['available', 'occupied', 'offline', 'maintenance', 'reserved'];
    const invalidUpdates = updates.filter(update => 
      !update.stationId || !update.pileId || !validStatuses.includes(update.status)
    );

    if (invalidUpdates.length > 0) {
      return res.status(400).json({
        success: false,
        message: '存在无效的更新数据'
      });
    }

    try {
      await stationService.batchUpdatePileStatuses(updates);

      res.json({
        success: true,
        message: `批量更新 ${updates.length} 个充电桩状态成功`
      });

    } catch (error: any) {
      console.error('❌ 批量更新充电桩状态失败:', error);
      res.status(400).json({
        success: false,
        message: error.message || '批量更新失败'
      });
    }
  })
);

// 从外部API同步数据
router.post('/sync/external',
  authenticateToken,
  requireVerificationLevel('premium'),
  logApiAccess,
  userRateLimit(2, 60000), // 每分钟最多2次同步
  asyncHandler(async (req: Request, res: Response) => {
    console.log('🔄 收到外部数据同步请求');

    const { apiData } = req.body;

    if (!Array.isArray(apiData) || apiData.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少同步数据或数据格式错误'
      });
    }

    try {
      const result = await stationService.syncFromExternalAPI(apiData);

      res.json({
        success: true,
        message: '数据同步成功',
        data: result
      });

    } catch (error: any) {
      console.error('❌ 数据同步失败:', error);
      res.status(400).json({
        success: false,
        message: error.message || '数据同步失败'
      });
    }
  })
);

// 获取服务配置
router.get('/config/service',
  logApiAccess,
  asyncHandler(async (req: Request, res: Response) => {
    console.log('⚙️ 收到获取服务配置请求');

    try {
      const config = stationService.getConfig();

      res.json({
        success: true,
        message: '获取服务配置成功',
        data: config
      });

    } catch (error: any) {
      console.error('❌ 获取服务配置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取服务配置失败'
      });
    }
  })
);

export default router;