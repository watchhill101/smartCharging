import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import authRoutes from '../routes/auth';
import User from '../models/User';
import SliderVerifyService from '../services/SliderVerifyService';

// Mock services
jest.mock('../services/SliderVerifyService');
jest.mock('../services/RedisService');
jest.mock('../services/FaceRecognitionService');

const MockedSliderVerifyService = SliderVerifyService as jest.MockedClass<typeof SliderVerifyService>;

describe('Auth Integration Tests', () => {
  let app: express.Application;
  let mongoServer: MongoMemoryServer;
  let mockSliderVerifyService: jest.Mocked<SliderVerifyService>;

  beforeAll(async () => {
    // 启动内存MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // 设置Express应用
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);

    // Mock滑块验证服务
    mockSliderVerifyService = {
      validateToken: jest.fn(),
      generateChallenge: jest.fn(),
      verifySlider: jest.fn()
    } as any;

    MockedSliderVerifyService.mockImplementation(() => mockSliderVerifyService);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // 清理数据库
    await User.deleteMany({});
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      mockSliderVerifyService.validateToken.mockResolvedValue(true);

      const registerData = {
        phone: '13800138000',
        password: 'password123',
        nickName: '测试用户',
        verifyToken: 'valid-token'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(registerData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('注册成功');
      expect(response.body.data.user.phone).toBe('13800138000');
      expect(response.body.data.isNewUser).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // 验证用户已保存到数据库
      const user = await User.findOne({ phone: '13800138000' });
      expect(user).toBeTruthy();
      expect(user!.nickName).toBe('测试用户');
    });

    it('should fail registration with invalid verification token', async () => {
      mockSliderVerifyService.validateToken.mockResolvedValue(false);

      const registerData = {
        phone: '13800138000',
        password: 'password123',
        verifyToken: 'invalid-token'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(registerData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('验证令牌无效或已过期，请重新验证');
    });

    it('should fail registration when user already exists', async () => {
      // 先创建用户
      await User.create({
        phone: '13800138000',
        nickName: '已存在用户',
        balance: 0,
        verificationLevel: 'basic'
      });

      mockSliderVerifyService.validateToken.mockResolvedValue(true);

      const registerData = {
        phone: '13800138000',
        password: 'password123',
        verifyToken: 'valid-token'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(registerData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('该手机号已注册');
    });
  });

  describe('POST /auth/login', () => {
    let existingUser: any;

    beforeEach(async () => {
      // 创建测试用户
      existingUser = await User.create({
        phone: '13800138000',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.hl.vHm', // password123
        nickName: '测试用户',
        balance: 100,
        verificationLevel: 'basic',
        faceAuthEnabled: false
      });
    });

    it('should login with password successfully', async () => {
      const loginData = {
        phone: '13800138000',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('登录成功');
      expect(response.body.data.user.phone).toBe('13800138000');
      expect(response.body.data.loginMethod).toBe('password');
      expect(response.body.data.token).toBeDefined();
    });

    it('should login with slider verification successfully', async () => {
      mockSliderVerifyService.validateToken.mockResolvedValue(true);

      const loginData = {
        phone: '13800138000',
        verifyToken: 'valid-token'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.loginMethod).toBe('slider');
    });

    it('should fail login with wrong password', async () => {
      const loginData = {
        phone: '13800138000',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('密码错误');
    });

    it('should fail login for non-existent user', async () => {
      const loginData = {
        phone: '13800138999',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('用户不存在');
    });
  });

  describe('GET /auth/me', () => {
    let authToken: string;
    let existingUser: any;

    beforeEach(async () => {
      // 创建用户并获取token
      existingUser = await User.create({
        phone: '13800138000',
        nickName: '测试用户',
        balance: 100,
        verificationLevel: 'basic',
        faceAuthEnabled: false
      });

      mockSliderVerifyService.validateToken.mockResolvedValue(true);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          phone: '13800138000',
          verifyToken: 'valid-token'
        });

      authToken = loginResponse.body.data.token;
    });

    it('should get user info successfully with valid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.phone).toBe('13800138000');
      expect(response.body.data.user.nickName).toBe('测试用户');
    });

    it('should fail without authorization token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('TOKEN_INVALID');
    });
  });

  describe('POST /auth/logout', () => {
    let authToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // 创建用户并登录
      await User.create({
        phone: '13800138000',
        nickName: '测试用户',
        balance: 100,
        verificationLevel: 'basic'
      });

      mockSliderVerifyService.validateToken.mockResolvedValue(true);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          phone: '13800138000',
          verifyToken: 'valid-token'
        });

      authToken = loginResponse.body.data.token;
      refreshToken = loginResponse.body.data.refreshToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('登出成功');
    });

    it('should fail logout without authentication', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('TOKEN_MISSING');
    });
  });

  describe('POST /auth/update-password', () => {
    let authToken: string;
    let existingUser: any;

    beforeEach(async () => {
      // 创建有密码的用户
      existingUser = await User.create({
        phone: '13800138000',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.hl.vHm', // password123
        nickName: '测试用户',
        balance: 100,
        verificationLevel: 'basic'
      });

      // 登录获取token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          phone: '13800138000',
          password: 'password123'
        });

      authToken = loginResponse.body.data.token;
    });

    it('should update password successfully', async () => {
      const response = await request(app)
        .post('/auth/update-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          oldPassword: 'password123',
          newPassword: 'newpassword123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('密码更新成功');
    });

    it('should fail with wrong old password', async () => {
      const response = await request(app)
        .post('/auth/update-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          oldPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('原密码错误');
    });

    it('should fail with short new password', async () => {
      const response = await request(app)
        .post('/auth/update-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          oldPassword: 'password123',
          newPassword: '123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('新密码长度至少6位');
    });
  });

  describe('POST /auth/reset-password', () => {
    beforeEach(async () => {
      // 创建测试用户
      await User.create({
        phone: '13800138000',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/hL.hl.vHm',
        nickName: '测试用户',
        balance: 100,
        verificationLevel: 'basic'
      });
    });

    it('should reset password successfully', async () => {
      mockSliderVerifyService.validateToken.mockResolvedValue(true);

      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          phone: '13800138000',
          newPassword: 'newpassword123',
          verifyToken: 'valid-token'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('密码重置成功');
    });

    it('should fail with invalid verification token', async () => {
      mockSliderVerifyService.validateToken.mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          phone: '13800138000',
          newPassword: 'newpassword123',
          verifyToken: 'invalid-token'
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('验证令牌无效或已过期');
    });
  });

  describe('POST /auth/refresh-token', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // 创建用户并登录获取refresh token
      await User.create({
        phone: '13800138000',
        nickName: '测试用户',
        balance: 100,
        verificationLevel: 'basic'
      });

      mockSliderVerifyService.validateToken.mockResolvedValue(true);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          phone: '13800138000',
          verifyToken: 'valid-token'
        });

      refreshToken = loginResponse.body.data.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should fail without refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh-token')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Refresh token不能为空');
    });
  });
});