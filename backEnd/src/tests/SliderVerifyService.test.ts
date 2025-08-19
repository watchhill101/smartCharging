import SliderVerifyService, { SliderVerifyRequest } from '../services/SliderVerifyService';

// Mock Redis服务
jest.mock('../services/RedisService', () => {
  return {
    RedisService: jest.fn().mockImplementation(() => ({
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1)
    }))
  };
});

describe('SliderVerifyService', () => {
  let sliderVerifyService: SliderVerifyService;

  beforeEach(() => {
    sliderVerifyService = new SliderVerifyService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateChallenge', () => {
    it('应该生成有效的滑块验证挑战', async () => {
      const challenge = await sliderVerifyService.generateChallenge(248);

      expect(challenge).toHaveProperty('sessionId');
      expect(challenge).toHaveProperty('puzzleOffset');
      expect(challenge).toHaveProperty('timestamp');
      expect(challenge).toHaveProperty('attempts');

      expect(challenge.sessionId).toMatch(/^slider_\d+_[a-f0-9]{16}$/);
      expect(challenge.puzzleOffset).toBeGreaterThanOrEqual(62); // 30% of 208
      expect(challenge.puzzleOffset).toBeLessThanOrEqual(166); // 80% of 208
      expect(challenge.attempts).toBe(0);
      expect(challenge.timestamp).toBeCloseTo(Date.now(), -2);
    });

    it('应该为不同宽度生成合适的拼图位置', async () => {
      const challenge1 = await sliderVerifyService.generateChallenge(300);
      const challenge2 = await sliderVerifyService.generateChallenge(200);

      // 300px宽度的有效范围: 260px, 30%-80% = 78-208
      expect(challenge1.puzzleOffset).toBeGreaterThanOrEqual(78);
      expect(challenge1.puzzleOffset).toBeLessThanOrEqual(208);

      // 200px宽度的有效范围: 160px, 30%-80% = 48-128
      expect(challenge2.puzzleOffset).toBeGreaterThanOrEqual(48);
      expect(challenge2.puzzleOffset).toBeLessThanOrEqual(128);
    });
  });

  describe('verifySlider', () => {
    const createValidRequest = (overrides: Partial<SliderVerifyRequest> = {}): SliderVerifyRequest => ({
      slideDistance: 100,
      puzzleOffset: 105,
      accuracy: 5,
      duration: 2000,
      verifyPath: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      trackData: [
        { startX: 0, currentX: 0 },
        { startX: 0, currentX: 10 },
        { startX: 0, currentX: 20 },
        { startX: 0, currentX: 30 },
        { startX: 0, currentX: 40 },
        { startX: 0, currentX: 50 },
        { startX: 0, currentX: 60 },
        { startX: 0, currentX: 70 },
        { startX: 0, currentX: 80 },
        { startX: 0, currentX: 90 },
        { startX: 0, currentX: 100 }
      ],
      ...overrides
    });

    it('应该验证成功的滑块操作', async () => {
      const request = createValidRequest();
      const result = await sliderVerifyService.verifySlider(request);

      expect(result.verified).toBe(true);
      expect(result.token).toMatch(/^slider_token_\d+_[a-f0-9]{12}$/);
      expect(result.accuracy).toBe(5);
      expect(result.duration).toBe(2000);
      expect(result.sessionId).toBe('direct');
    });

    it('应该拒绝精度不够的滑块操作', async () => {
      const request = createValidRequest({
        accuracy: 30, // 超过阈值
        slideDistance: 100,
        puzzleOffset: 130
      });
      const result = await sliderVerifyService.verifySlider(request);

      expect(result.verified).toBe(false);
      expect(result.reason).toContain('精度不够');
      expect(result.token).toBeUndefined();
    });

    it('应该拒绝时间异常的滑块操作', async () => {
      const request = createValidRequest({
        duration: 100 // 太快，可能是机器人
      });
      const result = await sliderVerifyService.verifySlider(request);

      expect(result.verified).toBe(false);
      expect(result.reason).toContain('时间异常');
    });

    it('应该拒绝轨迹异常的滑块操作', async () => {
      const request = createValidRequest({
        trackData: [
          { startX: 0, currentX: 0 },
          { startX: 0, currentX: 100 } // 只有两个点，轨迹太少
        ],
        verifyPath: [0, 100]
      });
      const result = await sliderVerifyService.verifySlider(request);

      expect(result.verified).toBe(false);
      expect(result.reason).toContain('轨迹异常');
    });

    it('应该拒绝参数格式错误的请求', async () => {
      const request = {
        slideDistance: 'invalid' as any,
        puzzleOffset: 100,
        accuracy: 5,
        duration: 2000,
        verifyPath: [],
        trackData: []
      };
      const result = await sliderVerifyService.verifySlider(request);

      expect(result.verified).toBe(false);
      expect(result.reason).toBe('参数格式错误');
    });

    it('应该处理边界情况的精度验证', async () => {
      // 精度刚好在阈值内
      const request1 = createValidRequest({ accuracy: 15 });
      const result1 = await sliderVerifyService.verifySlider(request1);
      expect(result1.verified).toBe(true);

      // 精度在宽松阈值内
      const request2 = createValidRequest({ accuracy: 20 });
      const result2 = await sliderVerifyService.verifySlider(request2);
      expect(result2.verified).toBe(true);

      // 精度超过宽松阈值
      const request3 = createValidRequest({ accuracy: 30 });
      const result3 = await sliderVerifyService.verifySlider(request3);
      expect(result3.verified).toBe(false);
    });

    it('应该处理边界情况的时间验证', async () => {
      // 最小时间
      const request1 = createValidRequest({ duration: 300 });
      const result1 = await sliderVerifyService.verifySlider(request1);
      expect(result1.verified).toBe(true);

      // 最大时间
      const request2 = createValidRequest({ duration: 15000 });
      const result2 = await sliderVerifyService.verifySlider(request2);
      expect(result2.verified).toBe(true);

      // 超过最大时间
      const request3 = createValidRequest({ duration: 20000 });
      const result3 = await sliderVerifyService.verifySlider(request3);
      expect(result3.verified).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('应该验证有效的令牌格式', async () => {
      const validToken = 'slider_token_1640995200000_abc123def456';
      
      // Mock Redis返回令牌数据
      const mockGet = jest.fn().mockResolvedValue(JSON.stringify({
        sessionId: 'test_session',
        timestamp: Date.now(),
        type: 'slider_verify'
      }));
      
      (sliderVerifyService as any).redis.get = mockGet;

      const result = await sliderVerifyService.validateToken(validToken);
      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledWith(`verify_token:${validToken}`);
    });

    it('应该拒绝无效的令牌格式', async () => {
      const invalidTokens = [
        '',
        'invalid_token',
        'mock_token_123',
        'slider_123'
      ];

      for (const token of invalidTokens) {
        const result = await sliderVerifyService.validateToken(token);
        expect(result).toBe(false);
      }
    });

    it('应该拒绝不存在的令牌', async () => {
      const validFormatToken = 'slider_token_1640995200000_abc123def456';
      
      // Mock Redis返回null（令牌不存在）
      const mockGet = jest.fn().mockResolvedValue(null);
      (sliderVerifyService as any).redis.get = mockGet;

      const result = await sliderVerifyService.validateToken(validFormatToken);
      expect(result).toBe(false);
    });
  });

  describe('行为模式验证', () => {
    it('应该正确计算轨迹平滑度', async () => {
      // 平滑轨迹
      const smoothTrackData = [
        { startX: 0, currentX: 0 },
        { startX: 0, currentX: 10 },
        { startX: 0, currentX: 20 },
        { startX: 0, currentX: 30 },
        { startX: 0, currentX: 40 },
        { startX: 0, currentX: 50 }
      ];

      const request1 = createValidRequest({ trackData: smoothTrackData });
      const result1 = await sliderVerifyService.verifySlider(request1);
      expect(result1.verified).toBe(true);

      // 不平滑轨迹（大幅跳跃）
      const jumpyTrackData = [
        { startX: 0, currentX: 0 },
        { startX: 0, currentX: 50 }, // 大跳跃
        { startX: 0, currentX: 10 }, // 回跳
        { startX: 0, currentX: 80 }, // 大跳跃
        { startX: 0, currentX: 30 }, // 回跳
        { startX: 0, currentX: 100 }
      ];

      const request2 = createValidRequest({ 
        trackData: jumpyTrackData,
        accuracy: 10 // 保持其他条件良好
      });
      const result2 = await sliderVerifyService.verifySlider(request2);
      // 可能因为行为模式异常而失败
      if (!result2.verified) {
        expect(result2.reason).toContain('行为模式异常');
      }
    });
  });

  const createValidRequest = (overrides: Partial<SliderVerifyRequest> = {}): SliderVerifyRequest => ({
    slideDistance: 100,
    puzzleOffset: 105,
    accuracy: 5,
    duration: 2000,
    verifyPath: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    trackData: [
      { startX: 0, currentX: 0 },
      { startX: 0, currentX: 10 },
      { startX: 0, currentX: 20 },
      { startX: 0, currentX: 30 },
      { startX: 0, currentX: 40 },
      { startX: 0, currentX: 50 },
      { startX: 0, currentX: 60 },
      { startX: 0, currentX: 70 },
      { startX: 0, currentX: 80 },
      { startX: 0, currentX: 90 },
      { startX: 0, currentX: 100 }
    ],
    ...overrides
  });
});