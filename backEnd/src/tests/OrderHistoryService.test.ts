import { OrderHistoryService } from '../services/OrderHistoryService';
import Order from '../models/Order';
import ChargingSession from '../models/ChargingSession';

// Mock dependencies
jest.mock('../models/Order');
jest.mock('../models/ChargingSession');
jest.mock('../services/RedisService', () => ({
  RedisService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([])
  }))
}));

const MockedOrder = Order as jest.Mocked<typeof Order>;
const MockedChargingSession = ChargingSession as jest.Mocked<typeof ChargingSession>;

describe('OrderHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrderHistory', () => {
    it('should get order history successfully', async () => {
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

      MockedOrder.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockOrders)
              })
            })
          })
        })
      });

      MockedOrder.countDocuments = jest.fn().mockResolvedValue(1);

      // Mock aggregate for statistics
      MockedOrder.aggregate = jest.fn().mockResolvedValue([{
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
      expect(result.orders[0].session).toBeDefined();
      expect(result.orders[0].session?.sessionId).toBe('SESSION123');
      expect(result.orders[0].session?.stationName).toBe('测试充电站');

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);

      expect(result.statistics.totalOrders).toBe(1);
      expect(result.statistics.totalAmount).toBe(50.00);
    });

    it('should filter orders by type', async () => {
      MockedOrder.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
              })
            })
          })
        })
      });

      MockedOrder.countDocuments = jest.fn().mockResolvedValue(0);
      MockedOrder.aggregate = jest.fn().mockResolvedValue([]);

      await OrderHistoryService.getOrderHistory({
        userId: 'user123',
        type: 'charging',
        page: 1,
        limit: 20
      });

      expect(MockedOrder.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'charging'
        })
      );
    });

    it('should filter orders by status', async () => {
      MockedOrder.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
              })
            })
          })
        })
      });

      MockedOrder.countDocuments = jest.fn().mockResolvedValue(0);
      MockedOrder.aggregate = jest.fn().mockResolvedValue([]);

      await OrderHistoryService.getOrderHistory({
        userId: 'user123',
        status: 'paid',
        page: 1,
        limit: 20
      });

      expect(MockedOrder.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paid'
        })
      );
    });

    it('should filter orders by date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      MockedOrder.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
              })
            })
          })
        })
      });

      MockedOrder.countDocuments = jest.fn().mockResolvedValue(0);
      MockedOrder.aggregate = jest.fn().mockResolvedValue([]);

      await OrderHistoryService.getOrderHistory({
        userId: 'user123',
        startDate,
        endDate,
        page: 1,
        limit: 20
      });

      expect(MockedOrder.find).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        })
      );
    });

    it('should search orders by keyword', async () => {
      MockedOrder.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
              })
            })
          })
        })
      });

      MockedOrder.countDocuments = jest.fn().mockResolvedValue(0);
      MockedOrder.aggregate = jest.fn().mockResolvedValue([]);

      await OrderHistoryService.getOrderHistory({
        userId: 'user123',
        keyword: 'ORD123',
        page: 1,
        limit: 20
      });

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

  describe('getOrderDetail', () => {
    it('should get order detail successfully', async () => {
      const mockOrder = {
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
          _id: 'session1',
          sessionId: 'SESSION123',
          stationId: {
            _id: 'station1',
            name: '测试充电站',
            address: '测试地址'
          },
          chargerId: 'CHARGER001',
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T11:00:00Z'),
          duration: 3600,
          energyDelivered: 25.5
        }
      };

      MockedOrder.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockOrder)
        })
      });

      // Mock related orders query
      MockedOrder.find = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      });

      const result = await OrderHistoryService.getOrderDetail('user123', 'ORD123456');

      expect(result).toBeDefined();
      expect(result?.order.orderId).toBe('ORD123456');
      expect(result?.order.session).toBeDefined();
      expect(result?.order.session?.sessionId).toBe('SESSION123');
      expect(result?.order.session?.stationName).toBe('测试充电站');
    });

    it('should return null for non-existent order', async () => {
      MockedOrder.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null)
        })
      });

      const result = await OrderHistoryService.getOrderDetail('user123', 'NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should include related orders', async () => {
      const mockOrder = {
        _id: 'order1',
        orderId: 'ORD123456',
        type: 'charging',
        amount: 50.00,
        status: 'paid',
        paymentMethod: 'balance',
        createdAt: new Date(),
        updatedAt: new Date(),
        sessionId: {
          _id: 'session1',
          sessionId: 'SESSION123'
        }
      };

      const mockRelatedOrders = [
        {
          _id: 'order2',
          orderId: 'ORD123457',
          type: 'recharge',
          amount: 100.00,
          status: 'paid',
          paymentMethod: 'alipay',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      MockedOrder.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockOrder)
        })
      });

      MockedOrder.find = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRelatedOrders)
      });

      const result = await OrderHistoryService.getOrderDetail('user123', 'ORD123456');

      expect(result?.relatedOrders).toBeDefined();
      expect(result?.relatedOrders).toHaveLength(1);
      expect(result?.relatedOrders?.[0].orderId).toBe('ORD123457');
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

      MockedOrder.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockOrders)
              })
            })
          })
        })
      });

      MockedOrder.countDocuments = jest.fn().mockResolvedValue(1);

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

  describe('getOrderStatistics', () => {
    it('should get order statistics successfully', async () => {
      const mockBasicStats = {
        totalOrders: 10,
        totalAmount: 500.00,
        paidOrders: 8,
        paidAmount: 400.00,
        chargingOrders: 6,
        rechargeOrders: 4
      };

      const mockMonthlyStats = [
        { month: '2023-01', orders: 5, amount: 250.00 },
        { month: '2023-02', orders: 5, amount: 250.00 }
      ];

      const mockStatusStats = [
        { status: 'paid', count: 8, percentage: 80 },
        { status: 'pending', count: 2, percentage: 20 }
      ];

      const mockPaymentStats = [
        { method: 'balance', count: 6, percentage: 60 },
        { method: 'alipay', count: 4, percentage: 40 }
      ];

      // Mock all aggregate calls
      MockedOrder.aggregate = jest.fn()
        .mockResolvedValueOnce([mockBasicStats]) // Basic stats
        .mockResolvedValueOnce(mockMonthlyStats) // Monthly stats
        .mockResolvedValueOnce([{ _id: 'paid', count: 8 }, { _id: 'pending', count: 2 }]) // Status stats
        .mockResolvedValueOnce([{ _id: 'balance', count: 6 }, { _id: 'alipay', count: 4 }]); // Payment stats

      const result = await OrderHistoryService.getOrderStatistics('user123');

      expect(result.totalOrders).toBe(10);
      expect(result.totalAmount).toBe(500.00);
      expect(result.monthlyStats).toHaveLength(2);
      expect(result.statusDistribution).toHaveLength(2);
      expect(result.paymentMethodDistribution).toHaveLength(2);
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

      MockedOrder.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockOrders)
          })
        })
      });

      const result = await OrderHistoryService.exportOrders({
        userId: 'user123',
        format: 'csv'
      });

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toBeDefined();
      expect(result.fileName).toBeDefined();
    });

    it('should handle empty order list', async () => {
      MockedOrder.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      const result = await OrderHistoryService.exportOrders({
        userId: 'user123',
        format: 'csv'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('没有找到符合条件的订单数据');
    });

    it('should handle unsupported format', async () => {
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
      const mockRedisService = {
        keys: jest.fn().mockResolvedValue(['order_history:user123:page1', 'order_history:user123:page2']),
        del: jest.fn().mockResolvedValue(1)
      };

      // Mock the RedisService instance
      jest.spyOn(OrderHistoryService as any, 'redisService', 'get').mockReturnValue(mockRedisService);

      await OrderHistoryService.clearOrderCache('user123');

      expect(mockRedisService.keys).toHaveBeenCalledWith('order_history:user123:*');
      expect(mockRedisService.del).toHaveBeenCalledTimes(2);
    });
  });
});