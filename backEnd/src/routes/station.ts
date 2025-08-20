import express, { Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { ChargingStationService } from '../services/ChargingStationService';
import mongoose from 'mongoose';

const router = express.Router();
const stationService = new ChargingStationService();

// 获取附近充电站
router.get('/nearby', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, radius = 5, limit = 20 } = req.query;
  
  // 验证必需参数
  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      errorCode: 'MISSING_COORDINATES',
      message: '请提供经纬度坐标',
      data: null
    });
  }
  
  try {
    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const searchRadius = parseFloat(radius as string);
    const maxLimit = parseInt(limit as string);
    
    // 验证坐标有效性
    if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_COORDINATES',
        message: '经纬度坐标无效',
        data: null
      });
    }
    
    // 使用服务获取附近充电站
    const stations = await stationService.findNearbyStations({
      latitude,
      longitude,
      radius: searchRadius,
      limit: maxLimit
    });
    
    res.json({
      success: true,
      message: '获取附近充电站成功',
      data: {
        stations: stations || [],
        total: stations?.length || 0,
        coordinates: { latitude, longitude },
        radius: searchRadius
      }
    });
  } catch (error) {
    console.error('Error finding nearby stations:', error);
    res.status(500).json({
      success: false,
      errorCode: 'STATION_SEARCH_ERROR',
      message: '查找附近充电站失败',
      data: null
    });
  }
}));

// 搜索充电站
router.get('/search', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const { q, city, district, page = 1, limit = 20 } = req.query;
  
  try {
    const searchOptions = {
      keyword: q as string,
      city: city as string,
      district: district as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };
    
    const result = await stationService.searchStations(searchOptions);
    
    res.json({
      success: true,
      message: '搜索充电站成功',
      data: {
        stations: result.stations || [],
        total: result.total || 0,
        page: searchOptions.page,
        totalPages: Math.ceil((result.total || 0) / searchOptions.limit),
        searchOptions: {
          keyword: searchOptions.keyword,
          city: searchOptions.city,
          district: searchOptions.district
        }
      }
    });
  } catch (error) {
    console.error('Error searching stations:', error);
    res.status(500).json({
      success: false,
      errorCode: 'STATION_SEARCH_ERROR',
      message: '搜索充电站失败',
      data: null
    });
  }
}));

// 获取充电站详情
router.get('/:stationId', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const { stationId } = req.params;
  
  if (!stationId) {
    return res.status(400).json({
      success: false,
      errorCode: 'MISSING_STATION_ID',
      message: '请提供充电站ID',
      data: null
    });
  }
  
  try {
    const station = await stationService.getStationById(stationId);
    
    if (!station) {
      return res.status(404).json({
        success: false,
        errorCode: 'STATION_NOT_FOUND',
        message: '充电站不存在',
        data: null
      });
    }
    
    res.json({
      success: true,
      message: '获取充电站详情成功',
      data: {
        station
      }
    });
  } catch (error) {
    console.error('Error getting station details:', error);
    res.status(500).json({
      success: false,
      errorCode: 'STATION_DETAILS_ERROR',
      message: '获取充电站详情失败',
      data: null
    });
  }
}));

// 获取充电桩实时状态
router.get('/:stationId/chargers', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const { stationId } = req.params;
  
  if (!stationId) {
    return res.status(400).json({
      success: false,
      errorCode: 'MISSING_STATION_ID',
      message: '请提供充电站ID',
      data: null
    });
  }
  
  try {
    const chargers = await stationService.getStationChargers(stationId);
    
    res.json({
      success: true,
      message: '获取充电桩状态成功',
      data: {
        chargers: chargers || [],
        total: chargers?.length || 0,
        available: chargers?.filter(c => c.status === 'available').length || 0,
        occupied: chargers?.filter(c => c.status === 'occupied').length || 0,
        faulted: chargers?.filter(c => c.status === 'faulted').length || 0
      }
    });
  } catch (error) {
    console.error('Error getting chargers status:', error);
    res.status(500).json({
      success: false,
      errorCode: 'CHARGERS_STATUS_ERROR',
      message: '获取充电桩状态失败',
      data: null
    });
  }
}));

// 获取充电站评论
router.get('/:stationId/reviews', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  // TODO: 实现获取评论逻辑
  res.json({
    success: true,
    message: 'Get station reviews endpoint - to be implemented',
    data: {
      reviews: []
    }
  });
}));

// 添加充电站评论
router.post('/:stationId/reviews', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  // TODO: 实现添加评论逻辑
  res.json({
    success: true,
    message: 'Add station review endpoint - to be implemented',
    data: {
      review: null
    }
  });
}));

export default router;