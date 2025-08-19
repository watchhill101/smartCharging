import UserAuthService, { LoginRequest, RegisterRequest } from '../services/UserAuthService';
import User from '../models/User';
import FaceProfile from '../models/FaceProfile';
import FaceLoginRecord from '../models/FaceLoginRecord';

// Mock dependencies
jest.mock('../models/User');
jest.mock('../models/FaceProfile');
jest.mock('../models/FaceLoginRecord');
jest.mock('../services/RedisService');
jest.mock('../services/SliderVerifyService');
jest.mock('../services/FaceRecognitionService');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const MockedUser = User as jest.Mocked<typeof User>;
const MockedFaceProfile = FaceProfile as jest.Mocked<typeof FaceProfile>;
const MockedFaceLoginRecord = FaceLoginRecord as jest.Mocked<typeof FaceLoginRecord>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('UserAuthService', () => {
  let userAuthService: UserAuthService;
  let mockUser: any;
  let mockRedisService: any;
  let mockSliderVerifyService: any;
  let mockFaceRecognitionService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock user data
    mockUser = {
      _id: 'user123',
      phone: '13800138000',
      password: 'hashedPassword',
      nickName: '测试用户',
      avatarUrl: 'avatar.jpg',
      balance: 100,
      verificationLevel: 'basic',
      faceAuthEnabled: false,
      lastLoginAt: new Date(),
      lastLoginIP: '127.0.0.1',
      save: jest.fn().mockResolvedValue(true)
    };

    // Mock services
    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      lpush: jest.fn(),
      getClient: jest.fn().mockReturnValue({
        ltrim: jest.fn(),
        lrange: jest.fn()
      })
    };

    mockSliderVerifyService = {
      validateToken: jest.fn()
    };

    mockFaceRecognitionService = {
      detectFace: jest.fn(),
      compareFaces: jest.fn(),
      generateFaceId: jest.fn().mockReturnValue('face123')
    };

    userAuthService = new UserAuthService();
    (userAuthService as any).redis = mockRedisService;
    (userAuthService as any).sliderVerifyService = mockSliderVerifyService;
    (userAuthService as any).faceRecognitionService = mockFaceRecognitionService;
  });

  describe('login', () => {
    it('should login successfully with password', async () => {
      const loginRequest: LoginRequest = {
        phone: '13800138000',
        password: 'password123',
        deviceInfo: {
          userAgent: 'test-agent',
          platform: 'web',
          ip: '127.0.0.1'
        }
      };

      // Mock dependencies
      mockRedisService.get.mockResolvedValue(null); // No failed attempts
      MockedUser.findOne.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockedJwt.sign.mockReturnValue('mock-token');

      const result = await userAuthService.login(loginRequest);

      expect(result.success).toBe(true);
      expect(result.message).toBe('登录成功');
      expect(result.data?.token).toBe('mock-token');
      expect(result.data?.user.phone).toBe('13800138000');
      expect(result.data?.loginMethod).toBe('password');
    });

    it('should login successfully with slider verification', async () => {
      const loginRequest: LoginRequest = {
        phone: '13800138000',
        verificationToken: 'valid-token',
        deviceInfo: {
          userAgent: 'test-agent',
          platform: 'web',
          ip: '127.0.0.1'
        }
      };

      // Mock dependencies
      mockRedisService.get.mockResolvedValue(null);
      mockSliderVerifyService.validateToken.mockResolvedValue(true);
      MockedUser.findOne.mockResolvedValue(mockUser);
      mockedJwt.sign.mockReturnValue('mock-token');

      const result = await userAuthService.login(loginRequest);

      expect(result.success).toBe(true);
      expect(result.data?.loginMethod).toBe('slider');
    });

    it('should fail login with invalid password', async () => {
      const loginRequest: LoginRequest = {
        phone: '13800138000',
        password: 'wrongpassword'
      };

      mockRedisService.get.mockResolvedValue(null);
      MockedUser.findOne.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false);

      const result = await userAuthService.login(loginRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('密码错误');
    });

    it('should fail login when user not found', async () => {
      const loginRequest: LoginRequest = {
        phone: '13800138000',
        password: 'password123'
      };

      mockRedisService.get.mockResolvedValue(null);
      MockedUser.findOne.mockResolvedValue(null);

      const result = await userAuthService.login(loginRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('用户不存在');
    });

    it('should fail login when account is locked', async () => {
      const loginRequest: LoginRequest = {
        phone: '13800138000',
        password: 'password123'
      };

      mockRedisService.get.mockResolvedValue('5'); // Max attempts reached

      const result = await userAuthService.login(loginRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('登录尝试次数过多，请15分钟后再试');
    });

    it('should fail login with invalid verification token', async () => {
      const loginRequest: LoginRequest = {
        phone: '13800138000',
        verificationToken: 'invalid-token'
      };

      mockRedisService.get.mockResolvedValue(null);
      mockSliderVerifyService.validateToken.mockResolvedValue(false);

      const result = await userAuthService.login(loginRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('验证令牌无效或已过期，请重新验证');
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const registerRequest: RegisterRequest = {
        phone: '13800138001',
        password: 'password123',
        nickName: '新用户',
        verificationToken: 'valid-token',
        deviceInfo: {
          userAgent: 'test-agent',
          platform: 'web',
          ip: '127.0.0.1'
        }
      };

      mockSliderVerifyService.validateToken.mockResolvedValue(true);
      MockedUser.findOne.mockResolvedValue(null); // User doesn't exist
      mockedBcrypt.hash.mockResolvedValue('hashedPassword');
      mockedJwt.sign.mockReturnValue('mock-token');

      // Mock User constructor and save
      const mockNewUser = {
        ...mockUser,
        phone: '13800138001',
        nickName: '新用户',
        save: jest.fn().mockResolvedValue(true)
      };
      MockedUser.mockImplementation(() => mockNewUser as any);

      const result = await userAuthService.register(registerRequest);

      expect(result.success).toBe(true);
      expect(result.message).toBe('注册成功');
      expect(result.data?.isNewUser).toBe(true);
    });

    it('should fail registration when user already exists', async () => {
      const registerRequest: RegisterRequest = {
        phone: '13800138000',
        verificationToken: 'valid-token'
      };

      mockSliderVerifyService.validateToken.mockResolvedValue(true);
      MockedUser.findOne.mockResolvedValue(mockUser); // User exists

      const result = await userAuthService.register(registerRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('该手机号已注册');
    });

    it('should fail registration with invalid verification token', async () => {
      const registerRequest: RegisterRequest = {
        phone: '13800138001',
        verificationToken: 'invalid-token'
      };

      mockSliderVerifyService.validateToken.mockResolvedValue(false);

      const result = await userAuthService.register(registerRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('验证令牌无效或已过期，请重新验证');
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const token = 'valid-token';
      const decodedPayload = { userId: 'user123' };

      mockedJwt.verify.mockReturnValue(decodedPayload as any);
      MockedUser.findById.mockResolvedValue(mockUser);

      const result = await userAuthService.validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.user).toBe(mockUser);
    });

    it('should fail validation for expired token', async () => {
      const token = 'expired-token';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';

      mockedJwt.verify.mockImplementation(() => {
        throw error;
      });

      const result = await userAuthService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
      expect(result.error).toBe('令牌已过期');
    });

    it('should fail validation for invalid token', async () => {
      const token = 'invalid-token';
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';

      mockedJwt.verify.mockImplementation(() => {
        throw error;
      });

      const result = await userAuthService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('令牌无效');
    });

    it('should fail validation when user not found', async () => {
      const token = 'valid-token';
      const decodedPayload = { userId: 'nonexistent' };

      mockedJwt.verify.mockReturnValue(decodedPayload as any);
      MockedUser.findById.mockResolvedValue(null);

      const result = await userAuthService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('用户不存在');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const decodedPayload = { userId: 'user123' };

      mockedJwt.verify.mockReturnValue(decodedPayload as any);
      mockRedisService.get.mockResolvedValue(refreshToken);
      MockedUser.findById.mockResolvedValue(mockUser);
      mockedJwt.sign.mockReturnValue('new-token');

      const result = await userAuthService.refreshToken(refreshToken);

      expect(result.success).toBe(true);
      expect(result.data?.accessToken).toBe('new-token');
    });

    it('should fail refresh when token not in Redis', async () => {
      const refreshToken = 'invalid-refresh-token';
      const decodedPayload = { userId: 'user123' };

      mockedJwt.verify.mockReturnValue(decodedPayload as any);
      mockRedisService.get.mockResolvedValue('different-token');

      const result = await userAuthService.refreshToken(refreshToken);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Refresh token无效');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const userId = 'user123';
      const refreshToken = 'refresh-token';

      mockRedisService.del.mockResolvedValue(1);
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await userAuthService.logout(userId, refreshToken);

      expect(result.success).toBe(true);
      expect(result.message).toBe('登出成功');
      expect(mockRedisService.del).toHaveBeenCalledWith(`refresh_token:${userId}`);
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      const userId = 'user123';
      const oldPassword = 'oldpassword';
      const newPassword = 'newpassword';

      MockedUser.findById.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockedBcrypt.hash.mockResolvedValue('newHashedPassword');

      const result = await userAuthService.updatePassword(userId, oldPassword, newPassword);

      expect(result.success).toBe(true);
      expect(result.message).toBe('密码更新成功');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should fail update with wrong old password', async () => {
      const userId = 'user123';
      const oldPassword = 'wrongpassword';
      const newPassword = 'newpassword';

      MockedUser.findById.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false);

      const result = await userAuthService.updatePassword(userId, oldPassword, newPassword);

      expect(result.success).toBe(false);
      expect(result.message).toBe('原密码错误');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const phone = '13800138000';
      const newPassword = 'newpassword';
      const verificationToken = 'valid-token';

      mockSliderVerifyService.validateToken.mockResolvedValue(true);
      MockedUser.findOne.mockResolvedValue(mockUser);
      mockedBcrypt.hash.mockResolvedValue('newHashedPassword');

      const result = await userAuthService.resetPassword(phone, newPassword, verificationToken);

      expect(result.success).toBe(true);
      expect(result.message).toBe('密码重置成功');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should fail reset with invalid verification token', async () => {
      const phone = '13800138000';
      const newPassword = 'newpassword';
      const verificationToken = 'invalid-token';

      mockSliderVerifyService.validateToken.mockResolvedValue(false);

      const result = await userAuthService.resetPassword(phone, newPassword, verificationToken);

      expect(result.success).toBe(false);
      expect(result.message).toBe('验证令牌无效或已过期');
    });
  });

  describe('getLoginHistory', () => {
    it('should get login history successfully', async () => {
      const userId = 'user123';
      const mockHistory = [
        JSON.stringify({
          timestamp: Date.now(),
          method: 'password',
          ip: '127.0.0.1',
          userAgent: 'test-agent'
        })
      ];

      mockRedisService.getClient().lrange.mockResolvedValue(mockHistory);

      const result = await userAuthService.getLoginHistory(userId, 10);

      expect(result).toHaveLength(1);
      expect(result[0].method).toBe('password');
    });

    it('should handle empty login history', async () => {
      const userId = 'user123';

      mockRedisService.getClient().lrange.mockResolvedValue([]);

      const result = await userAuthService.getLoginHistory(userId, 10);

      expect(result).toHaveLength(0);
    });
  });
});