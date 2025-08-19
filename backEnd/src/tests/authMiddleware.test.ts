import { Request, Response, NextFunction } from 'express';
import {
  authenticateToken,
  optionalAuth,
  requireVerificationLevel,
  requireAdmin,
  userRateLimit,
  requireOwnership,
  authErrorHandler
} from '../middleware/authMiddleware';
import UserAuthService from '../services/UserAuthService';

// Mock UserAuthService
jest.mock('../services/UserAuthService');

const MockedUserAuthService = UserAuthService as jest.MockedClass<typeof UserAuthService>;

describe('Auth Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let mockUserAuthService: jest.Mocked<UserAuthService>;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      headers: {},
      user: undefined,
      params: {},
      body: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' } as any
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    mockUserAuthService = {
      validateToken: jest.fn()
    } as any;

    MockedUserAuthService.mockImplementation(() => mockUserAuthService);
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token successfully', async () => {
      const mockUser = {
        _id: 'user123',
        phone: '13800138000',
        nickName: '测试用户',
        avatarUrl: 'avatar.jpg',
        balance: 100,
        verificationLevel: 'basic',
        faceAuthEnabled: false
      };

      req.headers!.authorization = 'Bearer valid-token';
      mockUserAuthService.validateToken.mockResolvedValue({
        valid: true,
        user: mockUser as any
      });

      await authenticateToken(req as Request, res as Response, next);

      expect(req.user).toEqual({
        userId: 'user123',
        phone: '13800138000',
        verificationLevel: 'basic',
        userData: {
          id: 'user123',
          phone: '13800138000',
          nickName: '测试用户',
          avatarUrl: 'avatar.jpg',
          balance: 100,
          verificationLevel: 'basic',
          faceAuthEnabled: false
        }
      });
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 when token is missing', async () => {
      await authenticateToken(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '访问令牌缺失',
        errorCode: 'TOKEN_MISSING'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', async () => {
      req.headers!.authorization = 'Bearer expired-token';
      mockUserAuthService.validateToken.mockResolvedValue({
        valid: false,
        expired: true,
        error: '令牌已过期'
      });

      await authenticateToken(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '令牌已过期',
        errorCode: 'TOKEN_EXPIRED'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when token is invalid', async () => {
      req.headers!.authorization = 'Bearer invalid-token';
      mockUserAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: '令牌无效'
      });

      await authenticateToken(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '令牌无效',
        errorCode: 'TOKEN_INVALID'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      req.headers!.authorization = 'Bearer valid-token';
      mockUserAuthService.validateToken.mockRejectedValue(new Error('Service error'));

      await authenticateToken(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '认证过程中出现错误',
        errorCode: 'AUTH_ERROR'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set user when valid token provided', async () => {
      const mockUser = {
        _id: 'user123',
        phone: '13800138000',
        nickName: '测试用户',
        verificationLevel: 'basic',
        faceAuthEnabled: false,
        balance: 100,
        avatarUrl: 'avatar.jpg'
      };

      req.headers!.authorization = 'Bearer valid-token';
      mockUserAuthService.validateToken.mockResolvedValue({
        valid: true,
        user: mockUser as any
      });

      await optionalAuth(req as Request, res as Response, next);

      expect(req.user).toBeDefined();
      expect(req.user!.userId).toBe('user123');
      expect(next).toHaveBeenCalled();
    });

    it('should continue without user when no token provided', async () => {
      await optionalAuth(req as Request, res as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should continue without user when token is invalid', async () => {
      req.headers!.authorization = 'Bearer invalid-token';
      mockUserAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: '令牌无效'
      });

      await optionalAuth(req as Request, res as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireVerificationLevel', () => {
    it('should allow access with sufficient verification level', () => {
      req.user = {
        userId: 'user123',
        phone: '13800138000',
        verificationLevel: 'face_verified',
        userData: {}
      };

      const middleware = requireVerificationLevel('phone_verified');
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access with insufficient verification level', () => {
      req.user = {
        userId: 'user123',
        phone: '13800138000',
        verificationLevel: 'basic',
        userData: {}
      };

      const middleware = requireVerificationLevel('face_verified');
      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '需要face_verified级别的验证',
        errorCode: 'INSUFFICIENT_VERIFICATION_LEVEL',
        data: {
          currentLevel: 'basic',
          requiredLevel: 'face_verified'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access when user not authenticated', () => {
      const middleware = requireVerificationLevel('basic');
      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '未授权访问',
        errorCode: 'UNAUTHORIZED'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should allow access for admin user', () => {
      req.user = {
        userId: 'admin123',
        phone: '13800138000',
        verificationLevel: 'premium',
        userData: {}
      };

      requireAdmin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access for non-admin user', () => {
      req.user = {
        userId: 'user123',
        phone: '13800138000',
        verificationLevel: 'basic',
        userData: {}
      };

      requireAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '需要管理员权限',
        errorCode: 'ADMIN_REQUIRED'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access when user not authenticated', () => {
      requireAdmin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '未授权访问',
        errorCode: 'UNAUTHORIZED'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireOwnership', () => {
    it('should allow access to own resources', () => {
      req.user = {
        userId: 'user123',
        phone: '13800138000',
        verificationLevel: 'basic',
        userData: {}
      };
      req.params!.userId = 'user123';

      const middleware = requireOwnership('userId');
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access to other users resources', () => {
      req.user = {
        userId: 'user123',
        phone: '13800138000',
        verificationLevel: 'basic',
        userData: {}
      };
      req.params!.userId = 'user456';

      const middleware = requireOwnership('userId');
      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '只能访问自己的资源',
        errorCode: 'OWNERSHIP_REQUIRED'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access when user not authenticated', () => {
      req.params!.userId = 'user123';

      const middleware = requireOwnership('userId');
      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '未授权访问',
        errorCode: 'UNAUTHORIZED'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('userRateLimit', () => {
    it('should allow requests within rate limit', () => {
      req.user = {
        userId: 'user123',
        phone: '13800138000',
        verificationLevel: 'basic',
        userData: {}
      };

      const middleware = userRateLimit(5, 60000); // 5 requests per minute
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip rate limiting for unauthenticated users', () => {
      const middleware = userRateLimit(5, 60000);
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('authErrorHandler', () => {
    it('should handle JWT malformed error', () => {
      const error = new Error('JWT malformed');
      error.name = 'JsonWebTokenError';

      authErrorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '令牌格式错误',
        errorCode: 'TOKEN_MALFORMED'
      });
    });

    it('should handle JWT expired error', () => {
      const error = new Error('JWT expired');
      error.name = 'TokenExpiredError';

      authErrorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '令牌已过期',
        errorCode: 'TOKEN_EXPIRED'
      });
    });

    it('should handle JWT not before error', () => {
      const error = new Error('JWT not active');
      error.name = 'NotBeforeError';

      authErrorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '令牌尚未生效',
        errorCode: 'TOKEN_NOT_ACTIVE'
      });
    });

    it('should handle generic errors', () => {
      const error = new Error('Generic error');

      authErrorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '认证服务内部错误',
        errorCode: 'AUTH_INTERNAL_ERROR'
      });
    });
  });
});