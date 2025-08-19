import { UserProfileService } from '../services/UserProfileService';

// Mock Redis service
jest.mock('../services/RedisService', () => ({
  RedisService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([])
  }))
}));

// Mock User model
jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  find: jest.fn()
}));

describe('UserProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateProfileCompleteness', () => {
    it('should validate profile completeness correctly', async () => {
      const User = require('../models/User');
      const mockUser = {
        nickName: '测试用户',
        phone: '13800138000',
        email: null,
        avatar: null,
        gender: null
      };

      User.findById.mockResolvedValue(mockUser);

      const result = await UserProfileService.validateProfileCompleteness('user123');

      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toEqual(['邮箱', '头像', '性别']);
      expect(result.completionRate).toBe(40);
    });

    it('should return complete profile', async () => {
      const User = require('../models/User');
      const mockUser = {
        nickName: '测试用户',
        phone: '13800138000',
        email: 'test@example.com',
        avatar: '/avatar.jpg',
        gender: 'male'
      };

      User.findById.mockResolvedValue(mockUser);

      const result = await UserProfileService.validateProfileCompleteness('user123');

      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toEqual([]);
      expect(result.completionRate).toBe(100);
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences successfully', async () => {
      const User = require('../models/User');
      const mockUser = {
        _id: 'user123',
        preferences: {
          language: 'zh-CN',
          theme: 'light',
          notifications: { email: true, sms: true, push: true },
          privacy: { showProfile: true, showChargingHistory: true }
        }
      };

      User.findById.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue(true);

      const result = await UserProfileService.updatePreferences('user123', {
        theme: 'dark',
        notifications: { email: false }
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('偏好设置更新成功');
    });
  });
});