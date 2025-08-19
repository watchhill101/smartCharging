import ChargingStationService, { StationSearchFilters, StationImportData } from '../services/ChargingStationService';
import ChargingStation from '../models/ChargingStation';
import { RedisService } from '../services/RedisService';

// Mock dependencies
jest.mock('../models/ChargingStation');
jest.mock('../services/RedisService');

const MockedChargingStation = ChargingStation as jest.Mocked<typeof ChargingStation>;
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;

describe('ChargingStationService', () => {
  let stationService: ChargingStationService;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockStation: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      getClient: jest.fn().mockReturnValue({
        keys: jest.fn().mockResolvedValue([]),
        del: jest.fn()
      })
    } as any;

    MockedRedisService.mockImplementation(() => mockRedisService);

    mockStation = {
      _id: 'station123',
      stationId: 'STATION_001',
      name: '测试充电站',
      address: '北京市朝阳区测试路1号',
      location: {
        type: 'Point',
        coordinates: [116.397470, 39.908823]
      },
      city: '北京市',
      district: '朝阳区',
      province: '北京市',
      operator: {
        name: '测试运营商',
        phone: '400-1234-567'
      },
      piles: [{
        pileId: 'PILE_001',
        pileNumber: '1',
        type: 'DC',
        power: 120,
        voltage: 500,
        current: 240,
        connectorType: ['GB/T'],
        status: 'available',
        price: {
          servicePrice: 0.5,
          electricityPrice: 0.6
        },
        installDate: new Date()
      }],
      totalPiles: 1,
      availablePiles: 1,
      status: 'active',
      rating: {
        average: 4.5,
        count: 10,
        distribution: { 5: 5, 4: 3, 3: 2, 2: 0, 1: 0 }
      },
      save: jest.fn().mockResolvedValue(true),
      updatePileStatus: jest.fn(),
      calculateDistance: jest.fn().mockReturnValue(1000),
      toObject: jest.fn().mockReturnValue({})
    };

    stationService = new ChargingStationService();
    (stationService as any).redis = mockRedisService;
  });

  describe('createStation', () => {
    const sampleStationData: StationImportData = {
      stationId: 'STATION_001',
      name: '测试充电站',
      address: '北京市朝阳区测试路1号',
      longitude: 116.397470,
      latitude: 39.908823,
      city: '北京市',
      district: '朝阳区',
      province: '北京市',
      operator: {
        name: '测试运营商',
        phone: '400-1234-567'
      },
      piles: [{
        pileId: 'PILE_001',
        pileNumber: '1',
        type: 'DC',
        power: 120,
        voltage: 500,
        current: 240,
        connectorType: ['GB/T'],
        price: {
          servicePrice: 0.5,
          electricityPrice: 0.6
        }
      }],
      openTime: {
        start: '00:00',
        end: '24:00',
        is24Hours: true
      }
    };

    it('should create a new charging station successfully', async () => {
      MockedChargingStation.findOne.mockResolvedValue(null);
      MockedChargingStation.mockImplementation(() => mockStation as any);

      const result = await stationService.createStation(sampleStationData);

      expect(MockedChargingStation.findOne).toHaveBeenCalledWith({
        stationId: 'STATION_001'
      });
      expect(mockStation.save).toHaveBeenCalled();
      expect(result).toBe(mockStation);
    });

    it('should throw error if station already exists', async () => {
      MockedChargingStation.findOne.mockResolvedValue(mockStation);

      await expect(stationService.createStation(sampleStationData))
        .rejects.toThrow('充电站 STATION_001 已存在');
    });

    it('should handle creation errors', async () => {
      MockedChargingStation.findOne.mockResolvedValue(null);
      MockedChargingStation.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(stationService.createStation(sampleStationData))
        .rejects.toThrow('创建充电站失败: Database error');
    });
  });

  describe('updateStation', () => {
    const updateData: Partial<StationImportData> = {
      name: '更新后的充电站',
      address: '北京市朝阳区新地址'
    };

    it('should update station successfully', async () => {
      MockedChargingStation.findOne.mockResolvedValue(mockStation);

      const result = await stationService.updateStation('STATION_001', updateData);

      expect(MockedChargingStation.findOne).toHaveBeenCalledWith({
        stationId: 'STATION_001'
      });
      expect(mockStation.name).toBe('更新后的充电站');
      expect(mockStation.address).toBe('北京市朝阳区新地址');
      expect(mockStation.save).toHaveBeenCalled();
      expect(result).toBe(mockStation);
    });

    it('should throw error if station not found', async () => {
      MockedChargingStation.findOne.mockResolvedValue(null);

      await expect(stationService.updateStation('STATION_001', updateData))
        .rejects.toThrow('充电站不存在');
    });
  });

  describe('deleteStation', () => {
    it('should soft delete station successfully', async () => {
      MockedChargingStation.findOne.mockResolvedValue(mockStation);

      await stationService.deleteStation('STATION_001');

      expect(mockStation.status).toBe('inactive');
      expect(mockStation.save).toHaveBeenCalled();
    });

    it('should throw error if station not found', async () => {
      MockedChargingStation.findOne.mockResolvedValue(null);

      await expect(stationService.deleteStation('STATION_001'))
        .rejects.toThrow('充电站不存在');
    });
  });

  describe('getStationById', () => {
    it('should return station from cache if available', async () => {
      const cachedStation = JSON.stringify(mockStation);
      mockRedisService.get.mockResolvedValue(cachedStation);

      const result = await stationService.getStationById('STATION_001');

      expect(mockRedisService.get).toHaveBeenCalledWith('station:STATION_001');
      expect(result).toEqual(mockStation);
      expect(MockedChargingStation.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      mockRedisService.get.mockResolvedValue(null);
      MockedChargingStation.findOne.mockResolvedValue(mockStation);

      const result = await stationService.getStationById('STATION_001');

      expect(MockedChargingStation.findOne).toHaveBeenCalledWith({
        stationId: 'STATION_001',
        status: { $ne: 'inactive' }
      });
      expect(mockRedisService.setex).toHaveBeenCalled();
      expect(result).toBe(mockStation);
    });

    it('should return null if station not found', async () => {
      mockRedisService.get.mockResolvedValue(null);
      MockedChargingStation.findOne.mockResolvedValue(null);

      const result = await stationService.getStationById('STATION_001');

      expect(result).toBeNull();
    });
  });

  describe('findNearbyStations', () => {
    it('should find nearby stations successfully', async () => {
      const mockStations = [mockStation];
      MockedChargingStation.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockStations)
      } as any);
      MockedChargingStation.countDocuments.mockResolvedValue(1);

      const result = await stationService.findNearbyStations(39.908823, 116.397470);

      expect(result.stations).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should apply filters correctly', async () => {
      const filters: StationSearchFilters = {
        city: '北京市',
        operator: '测试运营商',
        availability: 'available'
      };

      MockedChargingStation.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([])
      } as any);
      MockedChargingStation.countDocuments.mockResolvedValue(0);

      await stationService.findNearbyStations(39.908823, 116.397470, 5000, filters);

      expect(MockedChargingStation.find).toHaveBeenCalledWith(
        expect.objectContaining({
          city: expect.any(RegExp),
          'operator.name': expect.any(RegExp),
          availablePiles: { $gt: 0 }
        })
      );
    });

    it('should handle pagination correctly', async () => {
      MockedChargingStation.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([])
      } as any);
      MockedChargingStation.countDocuments.mockResolvedValue(100);

      const result = await stationService.findNearbyStations(
        39.908823, 
        116.397470, 
        5000, 
        {}, 
        { page: 2, limit: 10 }
      );

      expect(result.totalPages).toBe(10);
      expect(result.page).toBe(2);
    });
  });

  describe('searchStations', () => {
    it('should search stations by keyword successfully', async () => {
      const mockStations = [mockStation];
      MockedChargingStation.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockStations)
      } as any);
      MockedChargingStation.countDocuments.mockResolvedValue(1);

      const result = await stationService.searchStations('测试');

      expect(result.stations).toHaveLength(1);
      expect(MockedChargingStation.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { name: expect.any(RegExp) },
            { address: expect.any(RegExp) }
          ])
        })
      );
    });

    it('should include location filter when provided', async () => {
      MockedChargingStation.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([])
      } as any);
      MockedChargingStation.countDocuments.mockResolvedValue(0);

      await stationService.searchStations(
        '测试',
        { latitude: 39.908823, longitude: 116.397470 }
      );

      expect(MockedChargingStation.find).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining({
            $near: expect.any(Object)
          })
        })
      );
    });
  });

  describe('updatePileStatus', () => {
    it('should update pile status successfully', async () => {
      MockedChargingStation.findOne.mockResolvedValue(mockStation);

      await stationService.updatePileStatus('STATION_001', 'PILE_001', 'occupied');

      expect(mockStation.updatePileStatus).toHaveBeenCalledWith('PILE_001', 'occupied');
    });

    it('should throw error if station not found', async () => {
      MockedChargingStation.findOne.mockResolvedValue(null);

      await expect(stationService.updatePileStatus('STATION_001', 'PILE_001', 'occupied'))
        .rejects.toThrow('充电站不存在');
    });
  });

  describe('batchUpdatePileStatuses', () => {
    it('should batch update pile statuses successfully', async () => {
      const updates = [
        { stationId: 'STATION_001', pileId: 'PILE_001', status: 'occupied' },
        { stationId: 'STATION_001', pileId: 'PILE_002', status: 'maintenance' }
      ];

      MockedChargingStation.updatePileStatuses.mockResolvedValue();

      await stationService.batchUpdatePileStatuses(updates);

      expect(MockedChargingStation.updatePileStatuses).toHaveBeenCalledWith(updates);
    });
  });

  describe('syncFromExternalAPI', () => {
    it('should sync data from external API successfully', async () => {
      const apiData = [{
        stationId: 'STATION_001',
        name: '外部充电站',
        // ... other required fields
      }];

      MockedChargingStation.syncFromExternalAPI.mockResolvedValue({
        created: 1,
        updated: 0
      });

      const result = await stationService.syncFromExternalAPI(apiData as any);

      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(MockedChargingStation.syncFromExternalAPI).toHaveBeenCalledWith(apiData);
    });
  });

  describe('getStatistics', () => {
    it('should return cached statistics if available', async () => {
      const cachedStats = JSON.stringify({ totalStations: 100 });
      mockRedisService.get.mockResolvedValue(cachedStats);

      const result = await stationService.getStatistics();

      expect(result.totalStations).toBe(100);
      expect(MockedChargingStation.getStatistics).not.toHaveBeenCalled();
    });

    it('should fetch and cache statistics if not cached', async () => {
      mockRedisService.get.mockResolvedValue(null);
      MockedChargingStation.getStatistics.mockResolvedValue({
        totalStations: 50,
        totalPiles: 200
      });
      MockedChargingStation.aggregate.mockResolvedValue([]);

      const result = await stationService.getStatistics();

      expect(result.totalStations).toBe(50);
      expect(mockRedisService.setex).toHaveBeenCalled();
    });
  });

  describe('getStationsByOperator', () => {
    it('should get stations by operator successfully', async () => {
      const mockStations = [mockStation];
      MockedChargingStation.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockStations)
      } as any);
      MockedChargingStation.countDocuments.mockResolvedValue(1);

      const result = await stationService.getStationsByOperator('测试运营商');

      expect(result.stations).toHaveLength(1);
      expect(MockedChargingStation.find).toHaveBeenCalledWith({
        'operator.name': expect.any(RegExp),
        status: 'active'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      MockedChargingStation.findOne.mockRejectedValue(new Error('Database connection failed'));

      await expect(stationService.getStationById('STATION_001'))
        .rejects.toThrow('获取充电站详情失败: Database connection failed');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Redis connection failed'));
      MockedChargingStation.findOne.mockResolvedValue(mockStation);

      // Should still work even if Redis fails
      const result = await stationService.getStationById('STATION_001');
      expect(result).toBe(mockStation);
    });
  });

  describe('Cache Management', () => {
    it('should clear station cache after update', async () => {
      MockedChargingStation.findOne.mockResolvedValue(mockStation);

      await stationService.updateStation('STATION_001', { name: '新名称' });

      expect(mockRedisService.del).toHaveBeenCalledWith('station:STATION_001');
    });

    it('should clear location cache after creation', async () => {
      const sampleData: StationImportData = {
        stationId: 'STATION_001',
        name: '测试充电站',
        city: '北京市',
        // ... other required fields
      } as any;

      MockedChargingStation.findOne.mockResolvedValue(null);
      MockedChargingStation.mockImplementation(() => mockStation as any);

      await stationService.createStation(sampleData);

      expect(mockRedisService.getClient().keys).toHaveBeenCalledWith('nearby:北京市:*');
    });
  });

  describe('Configuration', () => {
    it('should return service configuration', () => {
      const config = stationService.getConfig();

      expect(config).toHaveProperty('cacheSettings');
      expect(config).toHaveProperty('searchLimits');
      expect(config).toHaveProperty('supportedConnectorTypes');
      expect(config).toHaveProperty('supportedServices');
      expect(config.supportedConnectorTypes).toContain('GB/T');
      expect(config.supportedServices).toContain('parking');
    });
  });
});