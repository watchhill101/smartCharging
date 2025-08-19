import request from 'supertest';
import { app } from '../app';
import { RedisService } from '../services/RedisService';
import { ChargingService } from '../services/ChargingService';
import { ChargingSessionService } from '../services/ChargingSessionService';
import { WebSocketService } from '../services/WebSocketService';

// Mock services
jest.mock('../services/RedisService');
jest.mock('../services/ChargingService');
jest.mock('../services/ChargingSessionService');
jest.mock('../services/WebSocketService');

describe('Charging Control API', () => {
  let mockRedisService: jest.Mocked<RedisService>;
  let mockChargingService: jest.Mocked<ChargingService>;
  let mockSessionService: jest.Mocked<ChargingSessionService>;
  let mockWebSocketService: jest.Mocked<WebSocketService>;
  let authToken: string;

  beforeAll(async () => {
    // 初始化mock服务
    mockRedisService = new RedisService({} as any) as jest.Mocked<RedisService>;
    mockChargingService = new ChargingService(mockRedisService) as jest.Mocked<ChargingService>;
    mockSessionService = new ChargingSessionService(mockRedisService, mockChargingService) as jest.Mocked<ChargingSessionService>;
    mockWebSocketService = {} as jest.Mocked<WebSocketService>;

    // 获取测试用的认证token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        phone: '13800138000',
        password: 'test123456'
      });
    
    authToken = loginResponse.body.data.token;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PUT /api/charging/control/settings/:sessionId', () => {
    const sessionId = 'test_session_123';
    const mockSession = {
      sessionId,
      userId: 'test_user_123',
      status: 'charging',
      pileId: 'pile_001',
      pileName: 'A001',
      stationId: 'station_001',
      stationName: '测试充电站',
      currentPower: 45.5,
      maxPower: 60,
      energyDelivered: 22.5,
      cost: 33.75,
      pricePerKwh: 1.5,
      duration: 1800,
      startTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    it('应该成功更新充电设置', async () => {
      mockChargingService.getChargingStatus.mockResolvedValue(mockSession as any);
      mockRedisService.setex.mockResolvedValue('OK');
      mockWebSocketService.sendNotificationToSession = jest.fn();

      const settings = {
        targetSoc: 85,
        maxEnergy: 50,
        maxCost: 75,
        powerLimit: 55,
        autoStop: true
      };

      const response = await request(app)
        .put(`/api/charging/control/settings/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(settings)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.settings).toEqual(settings);
      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `session:${sessionId}:settings`,
        3600,
        JSON.stringify(settings)
      );
    });

    it('应该拒绝无效的设置参数', async () => {
      const invalidSettings = {
        targetSoc: 150, // 超出范围
        maxEnergy: -10, // 负数
        autoStop: 'yes' // 非布尔值
      };

      const response = await request(app)
        .put(`/api/charging/control/settings/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidSettings)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('应该拒绝不存在的会话', async () => {
      mockChargingService.getChargingStatus.mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/charging/control/settings/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetSoc: 80 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    });

    it('应该拒绝已完成的会话', async () => {
      const completedSession = { ...mockSession, status: 'completed' };
      mockChargingService.getChargingStatus.mockResolvedValue(completedSession as any);

      const response = await request(app)
        .put(`/api/charging/control/settings/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetSoc: 80 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_SESSION_STATUS');
    });
  });

  describe('POST /api/charging/control/emergency-stop', () => {
    const sessionId = 'test_session_123';
    const mockSession = {
      sessionId,
      userId: 'test_user_123',
      status: 'charging'
    };

    it('应该成功执行紧急停止', async () => {
      mockChargingService.getChargingStatus.mockResolvedValue(mockSession as any);
      mockChargingService.stopChargingSession.mockResolvedValue({
        sessionId,
        endTime: new Date().toISOString(),
        duration: 1800,
        energyDelivered: 22.5,
        totalCost: 33.75
      });
      mockRedisService.lpush.mockResolvedValue(1);
      mockRedisService.ltrim.mockResolvedValue('OK');
      mockSessionService.sendChargingNotification.mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/charging/control/emergency-stop')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId,
          reason: 'user_emergency'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(mockChargingService.stopChargingSession).toHaveBeenCalledWith({
        sessionId,
        userId: 'test_user_123',
        reason: 'emergency_stop'
      });
    });

    it('应该拒绝已结束的会话', async () => {
      const endedSession = { ...mockSession, status: 'completed' };
      mockChargingService.getChargingStatus.mockResolvedValue(endedSession as any);

      const response = await request(app)
        .post('/api/charging/control/emergency-stop')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sessionId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('SESSION_ALREADY_ENDED');
    });
  });

  describe('GET /api/charging/control/anomalies/:sessionId', () => {
    const sessionId = 'test_session_123';
    const mockSession = {
      sessionId,
      userId: 'test_user_123',
      status: 'charging'
    };

    it('应该成功获取异常检测结果', async () => {
      const mockAnomalies = [
        {
          sessionId,
          anomalies: [
            {
              type: 'temperature_high',
              severity: 'medium',
              message: '充电桩温度偏高',
              timestamp: new Date().toISOString(),
              value: 65,
              threshold: 60
            }
          ],
          riskLevel: 'warning',
          autoStopRecommended: false
        }
      ];

      mockChargingService.getChargingStatus.mockResolvedValue(mockSession as any);
      mockSessionService.getSessionAnomalies.mockResolvedValue(mockAnomalies);

      const response = await request(app)
        .get(`/api/charging/control/anomalies/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.anomalies).toEqual(mockAnomalies);
      expect(mockSessionService.getSessionAnomalies).toHaveBeenCalledWith(sessionId, 20);
    });

    it('应该支持自定义限制数量', async () => {
      mockChargingService.getChargingStatus.mockResolvedValue(mockSession as any);
      mockSessionService.getSessionAnomalies.mockResolvedValue([]);

      await request(app)
        .get(`/api/charging/control/anomalies/${sessionId}?limit=50`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockSessionService.getSessionAnomalies).toHaveBeenCalledWith(sessionId, 50);
    });
  });

  describe('GET /api/charging/control/order/:sessionId', () => {
    const sessionId = 'test_session_123';
    const orderId = 'order_123';
    const mockSession = {
      sessionId,
      userId: 'test_user_123',
      status: 'charging'
    };
    const mockOrder = {
      orderId,
      sessionId,
      userId: 'test_user_123',
      status: 'processing',
      totalCost: 33.75,
      energyDelivered: 22.5,
      createdAt: new Date().toISOString()
    };

    it('应该成功获取充电订单', async () => {
      mockChargingService.getChargingStatus.mockResolvedValue(mockSession as any);
      mockRedisService.get
        .mockResolvedValueOnce(orderId) // session:sessionId:order
        .mockResolvedValueOnce(JSON.stringify(mockOrder)); // order:orderId

      const response = await request(app)
        .get(`/api/charging/control/order/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockOrder);
    });

    it('应该处理订单不存在的情况', async () => {
      mockChargingService.getChargingStatus.mockResolvedValue(mockSession as any);
      mockRedisService.get.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/charging/control/order/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('GET /api/charging/control/notifications', () => {
    it('应该成功获取用户通知', async () => {
      const mockNotifications = [
        {
          id: 'notif_1',
          userId: 'test_user_123',
          type: 'charging_completed',
          title: '充电完成',
          message: '充电已完成',
          priority: 'normal',
          sent: true,
          createdAt: new Date().toISOString()
        }
      ];

      mockSessionService.getUserNotifications.mockResolvedValue(mockNotifications);

      const response = await request(app)
        .get('/api/charging/control/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toEqual(mockNotifications);
      expect(mockSessionService.getUserNotifications).toHaveBeenCalledWith('test_user_123', 50);
    });
  });

  describe('GET /api/charging/control/orders', () => {
    it('应该成功获取用户订单历史', async () => {
      const mockOrderHistory = {
        orders: [
          {
            orderId: 'order_1',
            sessionId: 'session_1',
            status: 'completed',
            totalCost: 33.75,
            createdAt: new Date().toISOString()
          }
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      mockSessionService.getUserOrders.mockResolvedValue(mockOrderHistory);

      const response = await request(app)
        .get('/api/charging/control/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockOrderHistory);
      expect(mockSessionService.getUserOrders).toHaveBeenCalledWith('test_user_123', 1, 20);
    });

    it('应该支持分页参数', async () => {
      mockSessionService.getUserOrders.mockResolvedValue({
        orders: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0
      });

      await request(app)
        .get('/api/charging/control/orders?page=2&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockSessionService.getUserOrders).toHaveBeenCalledWith('test_user_123', 2, 10);
    });
  });

  describe('POST /api/charging/control/auto-stop/:sessionId', () => {
    const sessionId = 'test_session_123';
    const mockSession = {
      sessionId,
      userId: 'test_user_123',
      status: 'charging'
    };

    it('应该成功设置自动停止', async () => {
      mockChargingService.getChargingStatus.mockResolvedValue(mockSession as any);
      mockRedisService.setex.mockResolvedValue('OK');

      const autoStopConfig = {
        enabled: true,
        conditions: {
          targetSoc: 90,
          maxCost: 100
        }
      };

      const response = await request(app)
        .post(`/api/charging/control/auto-stop/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(autoStopConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.autoStop.enabled).toBe(true);
      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `session:${sessionId}:auto_stop`,
        3600,
        expect.stringContaining('"enabled":true')
      );
    });

    it('应该拒绝无效的启用状态', async () => {
      const response = await request(app)
        .post(`/api/charging/control/auto-stop/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ enabled: 'yes' }) // 非布尔值
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('认证和权限测试', () => {
    it('应该拒绝未认证的请求', async () => {
      const response = await request(app)
        .put('/api/charging/control/settings/test_session')
        .send({ targetSoc: 80 })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('应该拒绝无效的token', async () => {
      const response = await request(app)
        .put('/api/charging/control/settings/test_session')
        .set('Authorization', 'Bearer invalid_token')
        .send({ targetSoc: 80 })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('错误处理测试', () => {
    it('应该处理服务异常', async () => {
      mockChargingService.getChargingStatus.mockRejectedValue(new Error('数据库连接失败'));

      const response = await request(app)
        .put('/api/charging/control/settings/test_session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetSoc: 80 })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('数据库连接失败');
    });

    it('应该处理Redis异常', async () => {
      const mockSession = {
        sessionId: 'test_session',
        userId: 'test_user_123',
        status: 'charging'
      };

      mockChargingService.getChargingStatus.mockResolvedValue(mockSession as any);
      mockRedisService.setex.mockRejectedValue(new Error('Redis连接失败'));

      const response = await request(app)
        .put('/api/charging/control/settings/test_session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetSoc: 80 })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});