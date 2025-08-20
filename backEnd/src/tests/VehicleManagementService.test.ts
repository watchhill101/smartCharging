// Mock mongoose and models before importing
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: jest.fn().mockImplementation((id) => ({ toString: () => id || 'mockId' }))
  }
}));

jest.mock('../models/User', () => ({
  findById: jest.fn()
}));

jest.mock('../services/RedisService', () => ({
  RedisService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([])
  }))
}));

import { VehicleManagementService } from '../services/VehicleManagementService';

import MockedUser from '../models/User';

describe('VehicleManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserVehicles', () => {
    it('should get user vehicles successfully', async () => {
      const mockUser = {
        vehicles: [
          {
            _id: 'vehicle1',
            brand: '特斯拉',
            model: 'Model 3',
            year: 2023,
            color: '白色',
            licensePlate: '京A12345',
            batteryCapacity: 75,
            range: 500,
            chargingPortType: 'CCS',
            isDefault: true,
            chargingPreferences: {
              targetSoc: 80,
              preferredChargingType: 'auto',
              temperatureControl: true,
              notifications: {
                chargingStart: true,
                chargingComplete: true,
                chargingError: true
              }
            },
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      };

      MockedUser.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await VehicleManagementService.getUserVehicles('user123');

      expect(result.vehicles).toHaveLength(1);
      expect(result.vehicles[0].brand).toBe('特斯拉');
      expect(result.vehicles[0].model).toBe('Model 3');
      expect(result.vehicles[0].licensePlate).toBe('京A12345');
      expect(result.vehicles[0].isDefault).toBe(true);
      expect(result.defaultVehicle).toBeDefined();
      expect(result.defaultVehicle?.licensePlate).toBe('京A12345');
      expect(result.totalCount).toBe(1);
    });

    it('should return empty list for user with no vehicles', async () => {
      const mockUser = {
        vehicles: []
      };

      MockedUser.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await VehicleManagementService.getUserVehicles('user123');

      expect(result.vehicles).toHaveLength(0);
      expect(result.defaultVehicle).toBeUndefined();
      expect(result.totalCount).toBe(0);
    });

    it('should throw error for non-existent user', async () => {
      MockedUser.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await expect(VehicleManagementService.getUserVehicles('nonexistent'))
        .rejects.toThrow('用户不存在');
    });
  });

  describe('addVehicle', () => {
    it('should add vehicle successfully', async () => {
      const mockUser = {
        vehicles: [],
        save: jest.fn().mockResolvedValue(true)
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      const vehicleInfo = {
        brand: '比亚迪',
        model: '汉EV',
        year: 2023,
        color: '黑色',
        licensePlate: '沪B67890',
        batteryCapacity: 85,
        range: 600,
        chargingPortType: 'GB/T' as const,
        isDefault: true
      };

      const result = await VehicleManagementService.addVehicle('user123', vehicleInfo);

      expect(result.success).toBe(true);
      expect(result.message).toBe('车辆添加成功');
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockUser.vehicles).toHaveLength(1);
    });

    it('should reject invalid license plate', async () => {
      const mockUser = {
        vehicles: [],
        save: jest.fn()
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      const vehicleInfo = {
        brand: '特斯拉',
        model: 'Model 3',
        licensePlate: 'INVALID123', // 无效车牌号格式
        batteryCapacity: 75
      };

      const result = await VehicleManagementService.addVehicle('user123', vehicleInfo);

      expect(result.success).toBe(false);
      expect(result.message).toContain('车牌号格式不正确');
      expect(mockUser.save).not.toHaveBeenCalled();
    });

    it('should reject duplicate license plate', async () => {
      const mockUser = {
        vehicles: [
          {
            licensePlate: '京A12345',
            brand: '特斯拉',
            model: 'Model 3'
          }
        ],
        save: jest.fn()
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      const vehicleInfo = {
        brand: '比亚迪',
        model: '汉EV',
        licensePlate: '京A12345' // 重复车牌号
      };

      const result = await VehicleManagementService.addVehicle('user123', vehicleInfo);

      expect(result.success).toBe(false);
      expect(result.message).toBe('该车牌号已存在');
      expect(mockUser.save).not.toHaveBeenCalled();
    });

    it('should reject when vehicle limit exceeded', async () => {
      const mockUser = {
        vehicles: new Array(5).fill({
          licensePlate: '京A00000',
          brand: '测试',
          model: '测试'
        }),
        save: jest.fn()
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      const vehicleInfo = {
        brand: '特斯拉',
        model: 'Model 3',
        licensePlate: '京A12345'
      };

      const result = await VehicleManagementService.addVehicle('user123', vehicleInfo);

      expect(result.success).toBe(false);
      expect(result.message).toBe('最多只能添加5辆车辆');
      expect(mockUser.save).not.toHaveBeenCalled();
    });

    it('should set first vehicle as default', async () => {
      const mockUser = {
        vehicles: [],
        save: jest.fn().mockResolvedValue(true)
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      const vehicleInfo = {
        brand: '特斯拉',
        model: 'Model 3',
        licensePlate: '京A12345',
        isDefault: false // 即使设置为false，第一辆车也应该是默认的
      };

      await VehicleManagementService.addVehicle('user123', vehicleInfo);

      expect((mockUser.vehicles[0] as any).isDefault).toBe(true);
    });
  });

  describe('updateVehicle', () => {
    it('should update vehicle successfully', async () => {
      const mockVehicle = {
        _id: 'vehicle1',
        brand: '特斯拉',
        model: 'Model 3',
        licensePlate: '京A12345',
        toObject: jest.fn().mockReturnValue({
          brand: '特斯拉',
          model: 'Model 3',
          licensePlate: '京A12345'
        })
      };

      const mockUser = {
        vehicles: [mockVehicle],
        save: jest.fn().mockResolvedValue(true)
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      const updateInfo = {
        color: '红色',
        batteryCapacity: 80
      };

      const result = await VehicleManagementService.updateVehicle('user123', 'vehicle1', updateInfo);

      expect(result.success).toBe(true);
      expect(result.message).toBe('车辆信息更新成功');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should reject update for non-existent vehicle', async () => {
      const mockUser = {
        vehicles: [],
        save: jest.fn()
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      const result = await VehicleManagementService.updateVehicle('user123', 'nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.message).toBe('车辆不存在');
      expect(mockUser.save).not.toHaveBeenCalled();
    });

    it('should handle default vehicle update', async () => {
      const mockVehicles = [
        {
          _id: 'vehicle1',
          isDefault: true,
          brand: 'Tesla',
          model: 'Model 3',
          licensePlate: '京A12345',
          toObject: jest.fn().mockReturnValue({ 
            brand: 'Tesla', 
            model: 'Model 3', 
            licensePlate: '京A12345',
            isDefault: true 
          })
        },
        {
          _id: 'vehicle2',
          isDefault: false,
          brand: 'BYD',
          model: '汉EV',
          licensePlate: '沪B67890',
          toObject: jest.fn().mockReturnValue({ 
            brand: 'BYD', 
            model: '汉EV', 
            licensePlate: '沪B67890',
            isDefault: false 
          })
        }
      ];

      const mockUser = {
        vehicles: mockVehicles,
        save: jest.fn().mockResolvedValue(true)
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      // 设置第二辆车为默认
      await VehicleManagementService.updateVehicle('user123', 'vehicle2', { isDefault: true });

      expect(mockVehicles[0].isDefault).toBe(false);
      expect(mockVehicles[1].isDefault).toBe(true);
    });
  });

  describe('deleteVehicle', () => {
    it('should delete vehicle successfully', async () => {
      const mockUser = {
        vehicles: [
          { _id: 'vehicle1', isDefault: false },
          { _id: 'vehicle2', isDefault: true }
        ],
        save: jest.fn().mockResolvedValue(true)
      };

      // Mock splice method
      mockUser.vehicles.splice = jest.fn();

      MockedUser.findById.mockResolvedValue(mockUser);

      const result = await VehicleManagementService.deleteVehicle('user123', 'vehicle1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('车辆删除成功');
      expect(mockUser.vehicles.splice).toHaveBeenCalledWith(0, 1);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should set new default when deleting default vehicle', async () => {
      const mockUser = {
        vehicles: [
          { _id: 'vehicle1', isDefault: true },
          { _id: 'vehicle2', isDefault: false }
        ],
        save: jest.fn().mockResolvedValue(true)
      };

      // Mock splice method
      mockUser.vehicles.splice = jest.fn().mockImplementation(() => {
        // Simulate removing the first vehicle
        mockUser.vehicles.length = 1;
      });

      MockedUser.findById.mockResolvedValue(mockUser);

      await VehicleManagementService.deleteVehicle('user123', 'vehicle1');

      // After deletion, the remaining vehicle should become default
      expect(mockUser.vehicles[0].isDefault).toBe(true);
    });

    it('should reject delete for non-existent vehicle', async () => {
      const mockUser = {
        vehicles: [],
        save: jest.fn()
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      const result = await VehicleManagementService.deleteVehicle('user123', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('车辆不存在');
      expect(mockUser.save).not.toHaveBeenCalled();
    });
  });

  describe('setDefaultVehicle', () => {
    it('should set default vehicle successfully', async () => {
      const mockUser = {
        vehicles: [
          { _id: 'vehicle1', isDefault: true },
          { _id: 'vehicle2', isDefault: false }
        ],
        save: jest.fn().mockResolvedValue(true)
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      const result = await VehicleManagementService.setDefaultVehicle('user123', 'vehicle2');

      expect(result.success).toBe(true);
      expect(result.message).toBe('默认车辆设置成功');
      expect(mockUser.vehicles[0].isDefault).toBe(false);
      expect(mockUser.vehicles[1].isDefault).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe('updateChargingPreferences', () => {
    it('should update charging preferences successfully', async () => {
      const mockUser = {
        vehicles: [
          {
            _id: 'vehicle1',
            chargingPreferences: {
              targetSoc: 80,
              preferredChargingType: 'auto'
            }
          }
        ],
        save: jest.fn().mockResolvedValue(true)
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      const preferences = {
        targetSoc: 90,
        maxChargingPower: 150,
        temperatureControl: false
      };

      const result = await VehicleManagementService.updateChargingPreferences('user123', 'vehicle1', preferences);

      expect(result.success).toBe(true);
      expect(result.message).toBe('充电偏好更新成功');
      expect((mockUser.vehicles[0] as any).chargingPreferences.targetSoc).toBe(90);
      expect((mockUser.vehicles[0] as any).chargingPreferences.maxChargingPower).toBe(150);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should reject invalid charging preferences', async () => {
      const mockUser = {
        vehicles: [{ _id: 'vehicle1' }],
        save: jest.fn()
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      const preferences = {
        targetSoc: 150, // 无效值
        maxChargingPower: -10 // 无效值
      };

      const result = await VehicleManagementService.updateChargingPreferences('user123', 'vehicle1', preferences);

      expect(result.success).toBe(false);
      expect(result.message).toContain('目标充电电量必须在10-100%之间');
      expect(mockUser.save).not.toHaveBeenCalled();
    });
  });

  describe('getSupportedBrands', () => {
    it('should return supported brands', () => {
      const brands = VehicleManagementService.getSupportedBrands();

      expect(brands).toBeDefined();
      expect(Array.isArray(brands)).toBe(true);
      expect(brands.length).toBeGreaterThan(0);
      expect(brands[0]).toHaveProperty('brand');
      expect(brands[0]).toHaveProperty('models');
    });
  });

  describe('getModelsByBrand', () => {
    it('should return models for valid brand', () => {
      const models = VehicleManagementService.getModelsByBrand('特斯拉');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('Model 3');
    });

    it('should return empty array for invalid brand', () => {
      const models = VehicleManagementService.getModelsByBrand('不存在的品牌');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(0);
    });
  });
});