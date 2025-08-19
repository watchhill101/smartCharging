import mongoose from 'mongoose';
import User, { IUser } from '../models/User';
import { RedisService } from './RedisService';

// 充电偏好接口
export interface ChargingPreferences {
  maxChargingPower?: number;
  targetSoc?: number;
  chargingSchedule?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
  };
  preferredChargingType?: 'fast' | 'slow' | 'auto';
  temperatureControl?: boolean;
  notifications?: {
    chargingStart: boolean;
    chargingComplete: boolean;
    chargingError: boolean;
  };
}

// 车辆信息接口
export interface VehicleInfo {
  id?: string;
  brand: string;
  model: string;
  year?: number;
  color?: string;
  licensePlate: string;
  batteryCapacity?: number;
  range?: number;
  chargingPortType?: 'CCS' | 'CHAdeMO' | 'Type2' | 'GB/T';
  isDefault?: boolean;
  chargingPreferences?: ChargingPreferences;
  createdAt?: Date;
  updatedAt?: Date;
}

// 车辆列表响应
export interface VehicleListResponse {
  vehicles: VehicleInfo[];
  defaultVehicle?: VehicleInfo;
  totalCount: number;
}

// 车辆品牌和型号数据
export interface VehicleBrandModel {
  brand: string;
  models: string[];
}

// 车辆验证结果
export interface VehicleValidationResult {
  isValid: boolean;
  errors: string[];
}

export class VehicleManagementService {
  private static redisService = new RedisService();

  // 支持的车辆品牌和型号
  private static readonly VEHICLE_BRANDS: VehicleBrandModel[] = [
    {
      brand: '特斯拉',
      models: ['Model 3', 'Model Y', 'Model S', 'Model X']
    },
    {
      brand: '比亚迪',
      models: ['汉EV', '唐EV', '宋PLUS EV', '秦PLUS EV', '海豚', '海豹', 'e2', 'e3']
    },
    {
      brand: '蔚来',
      models: ['ES8', 'ES6', 'EC6', 'ET7', 'ET5', 'ES7']
    },
    {
      brand: '理想',
      models: ['理想ONE', 'L9', 'L8', 'L7']
    },
    {
      brand: '小鹏',
      models: ['P7', 'P5', 'G3', 'G9']
    },
    {
      brand: '广汽埃安',
      models: ['AION Y', 'AION V', 'AION S', 'AION LX']
    },
    {
      brand: '吉利',
      models: ['几何A', '几何C', '帝豪EV', '星越L']
    },
    {
      brand: '长城',
      models: ['欧拉好猫', '欧拉黑猫', '欧拉白猫', '魏牌摩卡']
    },
    {
      brand: '奔驰',
      models: ['EQC', 'EQS', 'EQE', 'EQA', 'EQB']
    },
    {
      brand: '宝马',
      models: ['iX3', 'i3', 'i4', 'iX', 'i7']
    },
    {
      brand: '奥迪',
      models: ['e-tron', 'e-tron GT', 'Q4 e-tron']
    },
    {
      brand: '大众',
      models: ['ID.3', 'ID.4', 'ID.6']
    }
  ];

  /**
   * 获取用户车辆列表
   */
  static async getUserVehicles(userId: string): Promise<VehicleListResponse> {
    try {
      // 先从缓存获取
      const cacheKey = `user_vehicles:${userId}`;
      const cachedVehicles = await this.redisService.get(cacheKey);
      
      if (cachedVehicles) {
        return JSON.parse(cachedVehicles);
      }

      // 从数据库获取
      const user = await User.findById(userId).select('vehicles');
      if (!user) {
        throw new Error('用户不存在');
      }

      const vehicles: VehicleInfo[] = user.vehicles.map(vehicle => ({
        id: (vehicle as any)._id?.toString(),
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        licensePlate: vehicle.licensePlate,
        batteryCapacity: vehicle.batteryCapacity,
        range: vehicle.range,
        chargingPortType: vehicle.chargingPortType,
        isDefault: vehicle.isDefault,
        chargingPreferences: vehicle.chargingPreferences,
        createdAt: vehicle.createdAt,
        updatedAt: vehicle.updatedAt
      }));

      const defaultVehicle = vehicles.find(v => v.isDefault);

      const response: VehicleListResponse = {
        vehicles,
        defaultVehicle,
        totalCount: vehicles.length
      };

      // 缓存结果（1小时）
      await this.redisService.set(cacheKey, JSON.stringify(response));

      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取车辆列表失败');
    }
  }

  /**
   * 添加车辆
   */
  static async addVehicle(userId: string, vehicleInfo: VehicleInfo): Promise<{
    success: boolean;
    message?: string;
    vehicle?: VehicleInfo;
  }> {
    try {
      // 验证车辆信息
      const validation = this.validateVehicleInfo(vehicleInfo);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.errors.join(', ')
        };
      }

      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: '用户不存在' };
      }

      // 检查车牌号是否已存在
      const existingVehicle = user.vehicles.find(v => v.licensePlate === vehicleInfo.licensePlate);
      if (existingVehicle) {
        return { success: false, message: '该车牌号已存在' };
      }

      // 检查车辆数量限制
      if (user.vehicles.length >= 5) {
        return { success: false, message: '最多只能添加5辆车辆' };
      }

      // 如果是第一辆车或者设置为默认车辆，需要处理默认车辆逻辑
      if (vehicleInfo.isDefault || user.vehicles.length === 0) {
        // 取消其他车辆的默认状态
        user.vehicles.forEach(vehicle => {
          vehicle.isDefault = false;
        });
        vehicleInfo.isDefault = true;
      }

      // 设置默认充电偏好
      if (!vehicleInfo.chargingPreferences) {
        vehicleInfo.chargingPreferences = {
          targetSoc: 80,
          preferredChargingType: 'auto',
          temperatureControl: true,
          notifications: {
            chargingStart: true,
            chargingComplete: true,
            chargingError: true
          }
        };
      }

      // 添加车辆
      user.vehicles.push(vehicleInfo as any);
      await user.save();

      // 清除缓存
      await this.clearVehicleCache(userId);

      // 获取添加的车辆信息
      const addedVehicle = user.vehicles[user.vehicles.length - 1];
      const vehicleResponse: VehicleInfo = {
        id: (addedVehicle as any)._id?.toString(),
        brand: addedVehicle.brand,
        model: addedVehicle.model,
        year: addedVehicle.year,
        color: addedVehicle.color,
        licensePlate: addedVehicle.licensePlate,
        batteryCapacity: addedVehicle.batteryCapacity,
        range: addedVehicle.range,
        chargingPortType: addedVehicle.chargingPortType,
        isDefault: addedVehicle.isDefault,
        chargingPreferences: addedVehicle.chargingPreferences,
        createdAt: addedVehicle.createdAt,
        updatedAt: addedVehicle.updatedAt
      };

      return {
        success: true,
        message: '车辆添加成功',
        vehicle: vehicleResponse
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '添加车辆失败'
      };
    }
  }

  /**
   * 更新车辆信息
   */
  static async updateVehicle(
    userId: string, 
    vehicleId: string, 
    updateInfo: Partial<VehicleInfo>
  ): Promise<{
    success: boolean;
    message?: string;
    vehicle?: VehicleInfo;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: '用户不存在' };
      }

      const vehicleIndex = user.vehicles.findIndex(v => (v as any)._id?.toString() === vehicleId);
      if (vehicleIndex === -1) {
        return { success: false, message: '车辆不存在' };
      }

      // 如果更新车牌号，检查是否与其他车辆重复
      if (updateInfo.licensePlate && updateInfo.licensePlate !== user.vehicles[vehicleIndex].licensePlate) {
        const existingVehicle = user.vehicles.find(
          (v, index) => index !== vehicleIndex && v.licensePlate === updateInfo.licensePlate
        );
        if (existingVehicle) {
          return { success: false, message: '该车牌号已存在' };
        }
      }

      // 验证更新的车辆信息
      const updatedVehicleInfo = { ...(user.vehicles[vehicleIndex] as any).toObject(), ...updateInfo };
      const validation = this.validateVehicleInfo(updatedVehicleInfo);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.errors.join(', ')
        };
      }

      // 处理默认车辆逻辑
      if (updateInfo.isDefault === true) {
        // 取消其他车辆的默认状态
        user.vehicles.forEach((vehicle, index) => {
          if (index !== vehicleIndex) {
            vehicle.isDefault = false;
          }
        });
      }

      // 更新车辆信息
      Object.assign(user.vehicles[vehicleIndex], updateInfo);
      user.vehicles[vehicleIndex].updatedAt = new Date();

      await user.save();

      // 清除缓存
      await this.clearVehicleCache(userId);

      const updatedVehicle = user.vehicles[vehicleIndex];
      const vehicleResponse: VehicleInfo = {
        id: (updatedVehicle as any)._id?.toString(),
        brand: updatedVehicle.brand,
        model: updatedVehicle.model,
        year: updatedVehicle.year,
        color: updatedVehicle.color,
        licensePlate: updatedVehicle.licensePlate,
        batteryCapacity: updatedVehicle.batteryCapacity,
        range: updatedVehicle.range,
        chargingPortType: updatedVehicle.chargingPortType,
        isDefault: updatedVehicle.isDefault,
        chargingPreferences: updatedVehicle.chargingPreferences,
        createdAt: updatedVehicle.createdAt,
        updatedAt: updatedVehicle.updatedAt
      };

      return {
        success: true,
        message: '车辆信息更新成功',
        vehicle: vehicleResponse
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '更新车辆信息失败'
      };
    }
  }

  /**
   * 删除车辆
   */
  static async deleteVehicle(userId: string, vehicleId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: '用户不存在' };
      }

      const vehicleIndex = user.vehicles.findIndex(v => (v as any)._id?.toString() === vehicleId);
      if (vehicleIndex === -1) {
        return { success: false, message: '车辆不存在' };
      }

      const isDefaultVehicle = user.vehicles[vehicleIndex].isDefault;

      // 删除车辆
      user.vehicles.splice(vehicleIndex, 1);

      // 如果删除的是默认车辆，设置第一辆车为默认车辆
      if (isDefaultVehicle && user.vehicles.length > 0) {
        user.vehicles[0].isDefault = true;
      }

      await user.save();

      // 清除缓存
      await this.clearVehicleCache(userId);

      return {
        success: true,
        message: '车辆删除成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '删除车辆失败'
      };
    }
  }

  /**
   * 设置默认车辆
   */
  static async setDefaultVehicle(userId: string, vehicleId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: '用户不存在' };
      }

      const vehicleIndex = user.vehicles.findIndex(v => (v as any)._id?.toString() === vehicleId);
      if (vehicleIndex === -1) {
        return { success: false, message: '车辆不存在' };
      }

      // 取消所有车辆的默认状态
      user.vehicles.forEach(vehicle => {
        vehicle.isDefault = false;
      });

      // 设置指定车辆为默认
      user.vehicles[vehicleIndex].isDefault = true;

      await user.save();

      // 清除缓存
      await this.clearVehicleCache(userId);

      return {
        success: true,
        message: '默认车辆设置成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '设置默认车辆失败'
      };
    }
  }

  /**
   * 获取车辆详情
   */
  static async getVehicleDetail(userId: string, vehicleId: string): Promise<VehicleInfo | null> {
    try {
      const user = await User.findById(userId).select('vehicles');
      if (!user) {
        return null;
      }

      const vehicle = user.vehicles.find(v => (v as any)._id?.toString() === vehicleId);
      if (!vehicle) {
        return null;
      }

      return {
        id: (vehicle as any)._id?.toString(),
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        licensePlate: vehicle.licensePlate,
        batteryCapacity: vehicle.batteryCapacity,
        range: vehicle.range,
        chargingPortType: vehicle.chargingPortType,
        isDefault: vehicle.isDefault,
        chargingPreferences: vehicle.chargingPreferences,
        createdAt: vehicle.createdAt,
        updatedAt: vehicle.updatedAt
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取车辆详情失败');
    }
  }

  /**
   * 更新充电偏好
   */
  static async updateChargingPreferences(
    userId: string, 
    vehicleId: string, 
    preferences: ChargingPreferences
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: '用户不存在' };
      }

      const vehicleIndex = user.vehicles.findIndex(v => (v as any)._id?.toString() === vehicleId);
      if (vehicleIndex === -1) {
        return { success: false, message: '车辆不存在' };
      }

      // 验证充电偏好
      const validation = this.validateChargingPreferences(preferences);
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.errors.join(', ')
        };
      }

      // 更新充电偏好
      user.vehicles[vehicleIndex].chargingPreferences = {
        ...user.vehicles[vehicleIndex].chargingPreferences,
        ...preferences
      };
      user.vehicles[vehicleIndex].updatedAt = new Date();

      await user.save();

      // 清除缓存
      await this.clearVehicleCache(userId);

      return {
        success: true,
        message: '充电偏好更新成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '更新充电偏好失败'
      };
    }
  }

  /**
   * 获取支持的车辆品牌和型号
   */
  static getSupportedBrands(): VehicleBrandModel[] {
    return this.VEHICLE_BRANDS;
  }

  /**
   * 根据品牌获取型号列表
   */
  static getModelsByBrand(brand: string): string[] {
    const brandData = this.VEHICLE_BRANDS.find(b => b.brand === brand);
    return brandData ? brandData.models : [];
  }

  /**
   * 验证车辆信息
   */
  private static validateVehicleInfo(vehicleInfo: VehicleInfo): VehicleValidationResult {
    const errors: string[] = [];

    // 验证必填字段
    if (!vehicleInfo.brand || vehicleInfo.brand.trim().length === 0) {
      errors.push('车辆品牌不能为空');
    }

    if (!vehicleInfo.model || vehicleInfo.model.trim().length === 0) {
      errors.push('车辆型号不能为空');
    }

    if (!vehicleInfo.licensePlate || vehicleInfo.licensePlate.trim().length === 0) {
      errors.push('车牌号不能为空');
    }

    // 验证车牌号格式
    if (vehicleInfo.licensePlate) {
      const licensePlateRegex = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-Z0-9]{4}[A-Z0-9挂学警港澳]{1}$/;
      if (!licensePlateRegex.test(vehicleInfo.licensePlate)) {
        errors.push('车牌号格式不正确');
      }
    }

    // 验证年份
    if (vehicleInfo.year) {
      const currentYear = new Date().getFullYear();
      if (vehicleInfo.year < 2000 || vehicleInfo.year > currentYear + 2) {
        errors.push('车辆年份不合理');
      }
    }

    // 验证电池容量
    if (vehicleInfo.batteryCapacity && (vehicleInfo.batteryCapacity < 10 || vehicleInfo.batteryCapacity > 200)) {
      errors.push('电池容量必须在10-200kWh之间');
    }

    // 验证续航里程
    if (vehicleInfo.range && (vehicleInfo.range < 50 || vehicleInfo.range > 1000)) {
      errors.push('续航里程必须在50-1000km之间');
    }

    // 验证品牌和型号是否在支持列表中
    const supportedBrand = this.VEHICLE_BRANDS.find(b => b.brand === vehicleInfo.brand);
    if (supportedBrand && !supportedBrand.models.includes(vehicleInfo.model)) {
      errors.push(`${vehicleInfo.brand}品牌不支持${vehicleInfo.model}型号`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证充电偏好
   */
  private static validateChargingPreferences(preferences: ChargingPreferences): VehicleValidationResult {
    const errors: string[] = [];

    // 验证最大充电功率
    if (preferences.maxChargingPower && (preferences.maxChargingPower < 1 || preferences.maxChargingPower > 350)) {
      errors.push('最大充电功率必须在1-350kW之间');
    }

    // 验证目标SOC
    if (preferences.targetSoc && (preferences.targetSoc < 10 || preferences.targetSoc > 100)) {
      errors.push('目标充电电量必须在10-100%之间');
    }

    // 验证充电计划时间格式
    if (preferences.chargingSchedule) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      
      if (preferences.chargingSchedule.startTime && !timeRegex.test(preferences.chargingSchedule.startTime)) {
        errors.push('开始时间格式不正确，应为HH:MM格式');
      }

      if (preferences.chargingSchedule.endTime && !timeRegex.test(preferences.chargingSchedule.endTime)) {
        errors.push('结束时间格式不正确，应为HH:MM格式');
      }

      // 验证星期几
      if (preferences.chargingSchedule.daysOfWeek) {
        const invalidDays = preferences.chargingSchedule.daysOfWeek.filter(day => day < 0 || day > 6);
        if (invalidDays.length > 0) {
          errors.push('星期几必须在0-6之间（0为周日，6为周六）');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 清除车辆缓存
   */
  private static async clearVehicleCache(userId: string): Promise<void> {
    try {
      const cacheKey = `user_vehicles:${userId}`;
      await this.redisService.del(cacheKey);
    } catch (error) {
      console.error('清除车辆缓存失败:', error);
    }
  }

  /**
   * 批量清除车辆缓存
   */
  static async clearAllVehicleCache(): Promise<void> {
    try {
      const pattern = 'user_vehicles:*';
      const keys = await this.redisService.keys(pattern);
      if (keys.length > 0) {
        for (const key of keys) {
          await this.redisService.del(key);
        }
      }
    } catch (error) {
      console.error('批量清除车辆缓存失败:', error);
    }
  }
}