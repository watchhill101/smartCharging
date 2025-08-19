import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import User, { IUser } from '../models/User';

// 扩展Request接口
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// JWT认证中间件
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('Access token is required', 401, 'TOKEN_REQUIRED');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new AppError('JWT secret not configured', 500, 'JWT_SECRET_MISSING');
    }

    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    } else {
      next(error);
    }
  }
};

// 可选认证中间件（用于可选登录的接口）
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret) {
        const decoded = jwt.verify(token, jwtSecret) as { userId: string };
        const user = await User.findById(decoded.userId);
        if (user) {
          req.user = user;
        }
      }
    }

    next();
  } catch (error) {
    // 可选认证失败时不抛出错误，继续执行
    next();
  }
};

// 验证等级检查中间件
export const requireVerificationLevel = (level: 'basic') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }

    const levelHierarchy = { basic: 0 };
    const userLevel = levelHierarchy['basic']; // 现在只有basic级别
    const requiredLevel = levelHierarchy[level];

    if (userLevel < requiredLevel) {
      return next(new AppError(
        `Verification level '${level}' required`,
        403,
        'INSUFFICIENT_VERIFICATION_LEVEL'
      ));
    }

    next();
  };
};

// 生成JWT令牌
export const generateToken = (userId: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError('JWT secret not configured', 500, 'JWT_SECRET_MISSING');
  }

  return jwt.sign(
    { userId },
    jwtSecret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'smart-charging-app'
    }
  );
};

// 验证令牌
export const verifyToken = (token: string): { userId: string } => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError('JWT secret not configured', 500, 'JWT_SECRET_MISSING');
  }

  return jwt.verify(token, jwtSecret) as { userId: string };
};

// 速率限制中间件
export const userRateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientData = requests.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      requests.set(clientId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return next(new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED'));
    }
    
    clientData.count++;
    next();
  };
};

// 所有权检查中间件
export const requireOwnership = (resourceIdField: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    
    const resourceId = req.params[resourceIdField] || req.body[resourceIdField];
    const userId = req.user._id.toString();
    
    if (resourceId && resourceId !== userId) {
      return next(new AppError('Access denied', 403, 'ACCESS_DENIED'));
    }
    
    next();
  };
};

// API访问日志中间件
export const logApiAccess = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

// 别名导出，保持向后兼容
export const authenticateToken = authenticate;