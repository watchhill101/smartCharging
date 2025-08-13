import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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