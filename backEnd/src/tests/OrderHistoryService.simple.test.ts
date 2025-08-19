// Mock mongoose and models before importing
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: jest.fn().mockImplementation((id) => ({ toString: () => id || 'mockId' }))
  }
}));

jest.mock('../models/Order', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn()
}));

jest.mock('../models/ChargingSession', () => ({}));

jest.mock('../services/RedisService', () => ({
  RedisService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([])
  }))
}));

import { OrderHistoryService } from '../services/OrderHistoryService';

const MockedOrder = require('../models/Order');

describe('OrderHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrderHistory', () => {
    it('should get order history with basic functionality', async () => {
      const mockOrders = [
        {
          _id: 'order1',
          orderId: 'ORD123456',
          type: 'charging',
          amount: 50.00,
          status: 'paid',
          paymentMethod: 'balance',
          description: '充电费用',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          sessionId: null
        }
      ];

      // Mock the chain of methods
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrders)
      };

      MockedOrder.find.mockReturnValue(mockQuery);
      MockedOrder.countDocuments.mockResolvedValue(1);
      MockedOrder.aggregate.mockResolvedValue([{
        totalOrders: 1,
        totalAmount: 50.00,
        paidOrders: 1,
        paidAmount: 50.00,
        chargingOrders: 1,
        rechargeOrders: 0
      }]);

      const result = await OrderHistoryService.getOrderHistory({
        userId: 'user123',
        page: 1,
        limit: 20
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].orderId).toBe('ORD123456');
      expect(result.orders[0].type).toBe('charging');
      expect(result.orders[0].amount).toBe(50.00);
      expect(result.orders[0].status).toBe('paid');

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);

      expect(result.statistics.totalOrders).toBe(1);
      expect(result.statistics.totalAmount).toBe(50.00);
    });

    it('should handle orders with charging session', async () => {
      const mockOrders = [
        {
          _id: 'order1',
          orderId: 'ORD123456',
          type: 'charging',
          amount: 50.00,
          status: 'paid',
          paymentMethod: 'balance',
          description: '充电费用',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          sessionId: {
            sessionId: 'SESSION123',
            stationId: {
              _id: 'station1',
              name: '测试充电站'
            },
            chargerId: 'CHARGER001',
            startTime: new Date('2023-01-01T10:00:00Z'),
            endTime: new Date('2023-01-01T11:00:00Z'),
            duration: 3600,
            energyDelivered: 25.5,
            startPowerLevel: 20,
            endPowerLevel: 80
          }
        }
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrders)
      };

      MockedOrder.find.mockReturnValue(mockQuery);
      MockedOrder.countDocuments.mockResolvedValue(1);
      MockedOrder.aggregate.mockResolvedValue([{
        totalOrders: 1,
        totalAmount: 50.00,
        paidOrders: 1,
        paidAmount: 50.00,
        chargingOrders: 1,
        rechargeOrders: 0
      }]);

      const result = await OrderHistoryService.getOrderHistory({
        userId: 'user123',
        page: 1,
        limit: 20
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].session).toBeDefined();
      expect(result.orders[0].session?.sessionId).toBe('SESSION123');
      expect(result.orders[0].session?.stationName).toBe('测试充电站');
      expect(result.orders[0].session?.chargerId).toBe('CHARGER001');
      expect(result.orders[0].session?.energyDelivered).toBe(25.5);
    });

    it('should apply filters correctly', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      };

      MockedOrder.find.mockReturnValue(mockQuery);
      MockedOrder.countDocuments.mockResolvedValue(0);
      MockedOrder.aggregate.mockResolvedValue([]);

      await OrderHistoryService.getOrderHistory({
        userId: 'user123',
        type: 'charging',
        status: 'paid',
        paymentMethod: 'balance',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31'),
        keyword: 'test',
        page: 1,
        limit: 20
      });

      expect(MockedOrder.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'charging',
          status: 'paid',
          paymentMethod: 'balance',
          createdAt: {
            $gte: expect.any(Date),
            $lte: expect.any(Date)
          },
          $or: [
            { orderId: { $regex: 'test', $options: 'i' } },
            { description: { $regex: 'test', $options: 'i' } }
          ]
        })
      );
    });
  });

  describe('searchOrders', () => {
    it('should search orders by keyword', async () => {
      const mockOrders = [
        {
          _id: 'order1',
          orderId: 'ORD123456',
          type: 'charging',
          amount: 50.00,
          status: 'paid',
          paymentMethod: 'balance',
          description: '充电费用',
          createdAt: new Date(),
          updatedAt: new Date(),
          sessionId: null
        }
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrders)
      };

      MockedOrder.find.mockReturnValue(mockQuery);
      MockedOrder.countDocuments.mockResolvedValue(1);

      const result = await OrderHistoryService.searchOrders('user123', 'ORD123', 1, 20);

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].orderId).toBe('ORD123456');
      expect(result.pagination.total).toBe(1);

      expect(MockedOrder.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { orderId: { $regex: 'ORD123', $options: 'i' } },
            { description: { $regex: 'ORD123', $options: 'i' } }
          ]
        })
      );
    });
  });

  describe('exportOrders', () => {
    it('should export orders successfully', async () => {
      const mockOrders = [
        {
          _id: 'order1',
          orderId: 'ORD123456',
          type: 'charging',
          amount: 50.00,
          status: 'paid',
          paymentMethod: 'balance',
          createdAt: new Date(),
          sessionId: null
        }
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockOrders)
      };

      MockedOrder.find.mockReturnValue(mockQuery);

      const result = await OrderHistoryService.exportOrders({
        userId: 'user123',
        format: 'csv'
      });

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toBeDefined();
      expect(result.fileName).toBeDefined();
    });

    it('should handle empty order list', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      };

      MockedOrder.find.mockReturnValue(mockQuery);

      const result = await OrderHistoryService.exportOrders({
        userId: 'user123',
        format: 'csv'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('没有找到符合条件的订单数据');
    });

    it('should handle unsupported format', async () => {
      // Mock some orders first so it doesn't fail on empty list
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: 'order1', orderId: 'ORD123' }])
      };

      MockedOrder.find.mockReturnValue(mockQuery);

      const result = await OrderHistoryService.exportOrders({
        userId: 'user123',
        format: 'xml' as any
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('不支持的导出格式');
    });
  });

  describe('clearOrderCache', () => {
    it('should clear order cache successfully', async () => {
      // This test just ensures the method doesn't throw
      await expect(OrderHistoryService.clearOrderCache('user123')).resolves.not.toThrow();
    });
  });
});