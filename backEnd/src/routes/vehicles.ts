import express from 'express';
import { authenticate } from '../middleware/auth';
import { VehicleManagementService } from '../services/VehicleManagementService';
import { asyncHandler } from '../middleware/errorHandler';
import { body, param, validationResult } from 'express-validator';

const router = express.Router();

/**
 * 获取用户车辆列表
 * GET /api/vehicles
 */
router.get('/', authenticate, asyncHandler(async (req: any, res) => {
  const userId = req.user.id;

  const result = await VehicleManagementService.getUserVehicles(userId);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * 获取车辆详情
 * GET /api/vehicles/:vehicleId
 */
router.get('/:vehicleId', authenticate, [
  param('vehicleId').isMongoId().withMessage('车辆ID格式无效')
], asyncHandler(async (req: any, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const { vehicleId } = req.params;

  const vehicle = await VehicleManagementService.getVehicleDetail(userId, vehicleId);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: '车辆不存在'
    });
  }

  res.json({
    success: true,
    data: { vehicle }
  });
}));

/**
 * 添加车辆
 * POST /api/vehicles
 */
router.post('/', authenticate, [
  body('brand').notEmpty().withMessage('车辆品牌不能为空')
    .isLength({ max: 50 }).withMessage('品牌名称长度不能超过50字符'),
  body('model').notEmpty().withMessage('车辆型号不能为空')
    .isLength({ max: 50 }).withMessage('型号名称长度不能超过50字符'),
  body('licensePlate').notEmpty().withMessage('车牌号不能为空')
    .matches(/^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-Z0-9]{4}[A-Z0-9挂学警港澳]{1}$/)
    .withMessage('车牌号格式不正确'),
  body('year').optional().isInt({ min: 2000, max: new Date().getFullYear() + 2 })
    .withMessage('车辆年份不合理'),
  body('color').optional().isLength({ max: 30 }).withMessage('颜色名称长度不能超过30字符'),
  body('batteryCapacity').optional().isFloat({ min: 10, max: 200 })
    .withMessage('电池容量必须在10-200kWh之间'),
  body('range').optional().isInt({ min: 50, max: 1000 })
    .withMessage('续航里程必须在50-1000km之间'),
  body('chargingPortType').optional().isIn(['CCS', 'CHAdeMO', 'Type2', 'GB/T'])
    .withMessage('充电接口类型无效'),
  body('isDefault').optional().isBoolean().withMessage('默认车辆标识必须为布尔值')
], asyncHandler(async (req: any, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const vehicleInfo = req.body;

  const result = await VehicleManagementService.addVehicle(userId, vehicleInfo);

  if (result.success) {
    res.status(201).json({
      success: true,
      message: result.message,
      data: { vehicle: result.vehicle }
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

/**
 * 更新车辆信息
 * PUT /api/vehicles/:vehicleId
 */
router.put('/:vehicleId', authenticate, [
  param('vehicleId').isMongoId().withMessage('车辆ID格式无效'),
  body('brand').optional().notEmpty().withMessage('车辆品牌不能为空')
    .isLength({ max: 50 }).withMessage('品牌名称长度不能超过50字符'),
  body('model').optional().notEmpty().withMessage('车辆型号不能为空')
    .isLength({ max: 50 }).withMessage('型号名称长度不能超过50字符'),
  body('licensePlate').optional()
    .matches(/^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-Z0-9]{4}[A-Z0-9挂学警港澳]{1}$/)
    .withMessage('车牌号格式不正确'),
  body('year').optional().isInt({ min: 2000, max: new Date().getFullYear() + 2 })
    .withMessage('车辆年份不合理'),
  body('color').optional().isLength({ max: 30 }).withMessage('颜色名称长度不能超过30字符'),
  body('batteryCapacity').optional().isFloat({ min: 10, max: 200 })
    .withMessage('电池容量必须在10-200kWh之间'),
  body('range').optional().isInt({ min: 50, max: 1000 })
    .withMessage('续航里程必须在50-1000km之间'),
  body('chargingPortType').optional().isIn(['CCS', 'CHAdeMO', 'Type2', 'GB/T'])
    .withMessage('充电接口类型无效'),
  body('isDefault').optional().isBoolean().withMessage('默认车辆标识必须为布尔值')
], asyncHandler(async (req: any, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const { vehicleId } = req.params;
  const updateInfo = req.body;

  const result = await VehicleManagementService.updateVehicle(userId, vehicleId, updateInfo);

  if (result.success) {
    res.json({
      success: true,
      message: result.message,
      data: { vehicle: result.vehicle }
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

/**
 * 删除车辆
 * DELETE /api/vehicles/:vehicleId
 */
router.delete('/:vehicleId', authenticate, [
  param('vehicleId').isMongoId().withMessage('车辆ID格式无效')
], asyncHandler(async (req: any, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const { vehicleId } = req.params;

  const result = await VehicleManagementService.deleteVehicle(userId, vehicleId);

  if (result.success) {
    res.json({
      success: true,
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

/**
 * 设置默认车辆
 * PUT /api/vehicles/:vehicleId/default
 */
router.put('/:vehicleId/default', authenticate, [
  param('vehicleId').isMongoId().withMessage('车辆ID格式无效')
], asyncHandler(async (req: any, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const { vehicleId } = req.params;

  const result = await VehicleManagementService.setDefaultVehicle(userId, vehicleId);

  if (result.success) {
    res.json({
      success: true,
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

/**
 * 更新充电偏好
 * PUT /api/vehicles/:vehicleId/charging-preferences
 */
router.put('/:vehicleId/charging-preferences', authenticate, [
  param('vehicleId').isMongoId().withMessage('车辆ID格式无效'),
  body('maxChargingPower').optional().isFloat({ min: 1, max: 350 })
    .withMessage('最大充电功率必须在1-350kW之间'),
  body('targetSoc').optional().isInt({ min: 10, max: 100 })
    .withMessage('目标充电电量必须在10-100%之间'),
  body('chargingSchedule.enabled').optional().isBoolean()
    .withMessage('充电计划启用状态必须为布尔值'),
  body('chargingSchedule.startTime').optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('开始时间格式不正确，应为HH:MM格式'),
  body('chargingSchedule.endTime').optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('结束时间格式不正确，应为HH:MM格式'),
  body('chargingSchedule.daysOfWeek').optional().isArray()
    .withMessage('星期几必须为数组'),
  body('chargingSchedule.daysOfWeek.*').optional().isInt({ min: 0, max: 6 })
    .withMessage('星期几必须在0-6之间'),
  body('preferredChargingType').optional().isIn(['fast', 'slow', 'auto'])
    .withMessage('偏好充电类型无效'),
  body('temperatureControl').optional().isBoolean()
    .withMessage('温度控制必须为布尔值'),
  body('notifications.chargingStart').optional().isBoolean()
    .withMessage('充电开始通知必须为布尔值'),
  body('notifications.chargingComplete').optional().isBoolean()
    .withMessage('充电完成通知必须为布尔值'),
  body('notifications.chargingError').optional().isBoolean()
    .withMessage('充电错误通知必须为布尔值')
], asyncHandler(async (req: any, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const { vehicleId } = req.params;
  const preferences = req.body;

  const result = await VehicleManagementService.updateChargingPreferences(userId, vehicleId, preferences);

  if (result.success) {
    res.json({
      success: true,
      message: result.message
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.message
    });
  }
}));

/**
 * 获取支持的车辆品牌和型号
 * GET /api/vehicles/brands
 */
router.get('/brands', asyncHandler(async (req, res) => {
  const brands = VehicleManagementService.getSupportedBrands();

  res.json({
    success: true,
    data: { brands }
  });
}));

/**
 * 根据品牌获取型号列表
 * GET /api/vehicles/brands/:brand/models
 */
router.get('/brands/:brand/models', [
  param('brand').notEmpty().withMessage('品牌名称不能为空')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }

  const { brand } = req.params;
  const models = VehicleManagementService.getModelsByBrand(brand);

  res.json({
    success: true,
    data: { models }
  });
}));

/**
 * 清除车辆缓存
 * DELETE /api/vehicles/cache
 */
router.delete('/cache', authenticate, asyncHandler(async (req: any, res) => {
  await VehicleManagementService.clearAllVehicleCache();

  res.json({
    success: true,
    message: '车辆缓存清除成功'
  });
}));

export default router;