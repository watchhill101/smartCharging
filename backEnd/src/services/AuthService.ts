import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { RedisService } from './RedisService';
import User, { IUser } from '../models/User';
import { logger } from '../utils/logger';

export interface LoginCredentials {
  phone?: string;
  email?: string;
  password?: string;
  verifyCode?: string;
  verifyToken?: string;
}

export interface AuthResult {
  success: boolean;
  user?: IUser;
  token?: string;
  refreshToken?: string;
  message?: string;
  isNewUser?: boolean;
}

export interface TokenPayload {
  userId: string;
  phone: string;
  verificationLevel: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  private redis: RedisService;
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly JWT_REFRESH_EXPIRES_IN: string;
  private readonly SALT_ROUNDS = 12;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_TIME = 15 * 60; // 15分钟

  constructor() {
    this.redis = new RedisService();
    
    // 强制要求JWT密钥配置
    this.JWT_SECRET = process.env.JWT_SECRET;
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
    
    if (!this.JWT_SECRET || !this.JWT_REFRESH_SECRET) {
      // 在开发环境下生成临时密钥，生产环境必须配置
      if (process.env.NODE_ENV === 'development') {
        this.JWT_SECRET = this.JWT_SECRET || this.generateSecureKey();
        this.JWT_REFRESH_SECRET = this.JWT_REFRESH_SECRET || this.generateSecureKey();
        console.warn('🔑 开发环境：使用临时生成的JWT密钥');
        console.warn('⚠️  生产环境必须设置 JWT_SECRET 和 JWT_REFRESH_SECRET 环境变量');
      } else {
        throw new Error('🚨 生产环境必须配置 JWT_SECRET 和 JWT_REFRESH_SECRET 环境变量！');
      }
    }
    
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
    this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    console.log('✅ JWT服务初始化成功');
  }

  /**
   * 用户注册
   */
  async register(userData: {
    phone: string;
    password?: string;
    nickName?: string;
    verifyCode?: string;
  }): Promise<AuthResult> {
    const { phone, password, nickName, verifyCode } = userData;

    try {
      // 验证手机号格式
      if (!this.validatePhone(phone)) {
        return {
          success: false,
          message: '手机号格式不正确'
        };
      }

      // 检查用户是否已存在
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        return {
          success: false,
          message: '该手机号已注册'
        };
      }

      // 验证验证码（如果提供）
      if (verifyCode) {
        const isCodeValid = await this.verifyCode(phone, verifyCode);
        if (!isCodeValid) {
          return {
            success: false,
            message: '验证码错误或已过期'
          };
        }
      }

      // 创建新用户
      const hashedPassword = password ? await this.hashPassword(password) : undefined;
      
      const newUser = new User({
        phone,
        password: hashedPassword,
        nickName: nickName || `用户${phone.slice(-4)}`,
        balance: 0,
        verificationLevel: 'basic'
      });

      await newUser.save();

      // 生成令牌
      const { token, refreshToken } = await this.generateTokens(newUser);

      // 清除验证码
      if (verifyCode) {
        await this.clearVerificationCode(phone);
      }

      console.log(`✅ 用户注册成功: ${phone}`);

      return {
        success: true,
        user: newUser,
        token,
        refreshToken,
        message: '注册成功',
        isNewUser: true
      };

    } catch (error) {
      logger.error('User registration failed', { phone, error: error.message }, error.stack);
      return {
        success: false,
        message: '注册失败，请稍后重试'
      };
    }
  }

  /**
   * 用户登录
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const { phone, password, verifyCode, verifyToken } = credentials;

    try {
      if (!phone) {
        return {
          success: false,
          message: '手机号不能为空'
        };
      }

      // 检查账户锁定状态
      const isLocked = await this.isAccountLocked(phone);
      if (isLocked) {
        return {
          success: false,
          message: '账户已被锁定，请15分钟后重试'
        };
      }

      // 查找用户
      const user = await User.findOne({ phone });
      if (!user) {
        await this.recordFailedAttempt(phone);
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 验证码登录
      if (verifyCode) {
        return await this.loginWithVerifyCode(user, verifyCode, verifyToken);
      }

      // 密码登录
      if (password) {
        return await this.loginWithPassword(user, password);
      }

      return {
        success: false,
        message: '请提供验证码或密码'
      };

    } catch (error) {
      logger.error('User login failed', { phone, error: error.message }, error.stack);
      return {
        success: false,
        message: '登录失败，请稍后重试'
      };
    }
  }

  /**
   * 验证码登录
   */
  private async loginWithVerifyCode(
    user: IUser, 
    verifyCode: string, 
    verifyToken?: string
  ): Promise<AuthResult> {
    // 验证滑块验证令牌
    if (verifyToken) {
      const isTokenValid = await this.validateSliderToken(verifyToken);
      if (!isTokenValid) {
        await this.recordFailedAttempt(user.phone);
        return {
          success: false,
          message: '安全验证失败，请重新验证'
        };
      }
    }

    // 验证验证码
    const isCodeValid = await this.verifyCode(user.phone, verifyCode);
    if (!isCodeValid) {
      await this.recordFailedAttempt(user.phone);
      return {
        success: false,
        message: '验证码错误或已过期'
      };
    }

    // 登录成功
    return await this.successfulLogin(user);
  }

  /**
   * 密码登录
   */
  private async loginWithPassword(user: IUser, password: string): Promise<AuthResult> {
    if (!user.password) {
      return {
        success: false,
        message: '该账户未设置密码，请使用验证码登录'
      };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(user.phone);
      return {
        success: false,
        message: '密码错误'
      };
    }

    // 登录成功
    return await this.successfulLogin(user);
  }

  /**
   * 成功登录处理
   */
  private async successfulLogin(user: IUser): Promise<AuthResult> {
    // 清除失败尝试记录
    await this.clearFailedAttempts(user.phone);

    // 更新最后登录时间
    user.lastLoginAt = new Date();
    await user.save();

    // 生成令牌
    const { token, refreshToken } = await this.generateTokens(user);

    // 清除验证码
    await this.clearVerificationCode(user.phone);

    console.log(`✅ 用户登录成功: ${user.phone}`);

    return {
      success: true,
      user,
      token,
      refreshToken,
      message: '登录成功'
    };
  }

  /**
   * 刷新令牌
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      // 验证刷新令牌
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as RefreshTokenPayload;
      
      // 检查令牌是否在黑名单中
      const isBlacklisted = await this.redis.exists(`blacklist:refresh:${decoded.tokenId}`);
      if (isBlacklisted) {
        return {
          success: false,
          message: '刷新令牌已失效'
        };
      }

      // 查找用户
      const user = await User.findById(decoded.userId);
      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 将旧的刷新令牌加入黑名单
      await this.blacklistRefreshToken(decoded.tokenId);

      // 生成新的令牌对
      const tokens = await this.generateTokens(user);

      return {
        success: true,
        user,
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        message: '令牌刷新成功'
      };

    } catch (error) {
      logger.error('Token refresh failed', { refreshToken, error: error.message }, error.stack);
      return {
        success: false,
        message: '刷新令牌无效或已过期'
      };
    }
  }

  /**
   * 用户登出
   */
  async logout(token: string, refreshToken?: string): Promise<{ success: boolean; message: string }> {
    try {
      // 将访问令牌加入黑名单
      const decoded = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      const tokenId = this.generateTokenId(decoded);
      await this.blacklistToken(tokenId, decoded.exp);

      // 将刷新令牌加入黑名单
      if (refreshToken) {
        const refreshDecoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as RefreshTokenPayload;
        await this.blacklistRefreshToken(refreshDecoded.tokenId);
      }

      return {
        success: true,
        message: '登出成功'
      };

    } catch (error) {
      logger.error('User logout failed', { token, error: error.message }, error.stack);
      return {
        success: false,
        message: '登出失败'
      };
    }
  }

  /**
   * 验证访问令牌
   */
  async validateToken(token: string): Promise<{ valid: boolean; user?: IUser; payload?: TokenPayload }> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      
      // 检查令牌是否在黑名单中
      const tokenId = this.generateTokenId(decoded);
      const isBlacklisted = await this.redis.exists(`blacklist:token:${tokenId}`);
      if (isBlacklisted) {
        return { valid: false };
      }

      // 查找用户
      const user = await User.findById(decoded.userId);
      if (!user) {
        return { valid: false };
      }

      return {
        valid: true,
        user,
        payload: decoded
      };

    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * 生成令牌对
   */
  private async generateTokens(user: IUser): Promise<{ token: string; refreshToken: string }> {
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId: user._id.toString(),
      phone: user.phone,
      verificationLevel: user.verificationLevel || 'basic'
    };

    const token = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
      issuer: 'smart-charging-app'
    });

    const refreshTokenId = crypto.randomBytes(16).toString('hex');
    const refreshPayload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      userId: user._id.toString(),
      tokenId: refreshTokenId
    };

    const refreshToken = jwt.sign(refreshPayload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.JWT_REFRESH_EXPIRES_IN,
      issuer: 'smart-charging-app'
    });

    return { token, refreshToken };
  }

  /**
   * 验证验证码
   */
  private async verifyCode(phone: string, code: string): Promise<boolean> {
    try {
      const storedCode = await this.redis.get(`verify_code:${phone}`);
      return storedCode === code;
    } catch (error) {
      logger.error('Verification code validation failed', { phone, error: error.message }, error.stack);
      return false;
    }
  }

  /**
   * 清除验证码
   */
  private async clearVerificationCode(phone: string): Promise<void> {
    try {
      await this.redis.del(`verify_code:${phone}`);
    } catch (error) {
      logger.error('Clear verification code failed', { phone, error: error.message }, error.stack);
    }
  }

  /**
   * 验证滑块验证令牌
   */
  private async validateSliderToken(token: string): Promise<boolean> {
    try {
      const tokenData = await this.redis.get(`verify_token:${token}`);
      return tokenData !== null;
    } catch (error) {
      logger.error('Slider token validation failed', { token, error: error.message }, error.stack);
      return false;
    }
  }

  /**
   * 记录失败尝试
   */
  private async recordFailedAttempt(phone: string): Promise<void> {
    try {
      const key = `login_attempts:${phone}`;
      const attempts = await this.redis.incr(key);
      await this.redis.expire(key, this.LOCKOUT_TIME);

      if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
        await this.redis.setex(`account_locked:${phone}`, this.LOCKOUT_TIME, '1');
        console.warn(`🔒 账户已锁定: ${phone} (${attempts}次失败尝试)`);
      }
    } catch (error) {
      logger.error('Record failed attempt failed', { phone, error: error.message }, error.stack);
    }
  }

  /**
   * 清除失败尝试记录
   */
  private async clearFailedAttempts(phone: string): Promise<void> {
    try {
      await this.redis.del(`login_attempts:${phone}`);
      await this.redis.del(`account_locked:${phone}`);
    } catch (error) {
      logger.error('Clear failed attempts failed', { phone, error: error.message }, error.stack);
    }
  }

  /**
   * 检查账户是否被锁定
   */
  private async isAccountLocked(phone: string): Promise<boolean> {
    try {
      const locked = await this.redis.exists(`account_locked:${phone}`);
      return locked === 1;
    } catch (error) {
      logger.error('Check account lock status failed', { phone, error: error.message }, error.stack);
      return false;
    }
  }

  /**
   * 将令牌加入黑名单
   */
  private async blacklistToken(tokenId: string, exp?: number): Promise<void> {
    try {
      const ttl = exp ? exp - Math.floor(Date.now() / 1000) : 24 * 60 * 60; // 默认24小时
      if (ttl > 0) {
        await this.redis.setex(`blacklist:token:${tokenId}`, ttl, '1');
      }
    } catch (error) {
      logger.error('Token blacklist add failed', { tokenId, error: error.message }, error.stack);
    }
  }

  /**
   * 将刷新令牌加入黑名单
   */
  private async blacklistRefreshToken(tokenId: string): Promise<void> {
    try {
      const ttl = 7 * 24 * 60 * 60; // 7天
      await this.redis.setex(`blacklist:refresh:${tokenId}`, ttl, '1');
    } catch (error) {
      logger.error('Refresh token blacklist add failed', { tokenId, error: error.message }, error.stack);
    }
  }

  /**
   * 生成令牌ID
   */
  private generateTokenId(payload: TokenPayload): string {
    return crypto
      .createHash('sha256')
      .update(`${payload.userId}:${payload.iat}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * 哈希密码
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * 验证手机号格式
   */
  private validatePhone(phone: string): boolean {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 验证邮箱格式
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 生成安全密钥
   */
  private generateSecureKey(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * 获取用户登录统计
   */
  async getLoginStats(userId: string): Promise<{
    totalLogins: number;
    lastLoginAt?: Date;
    loginDevices: string[];
    failedAttempts: number;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 这里可以从日志系统或数据库获取更详细的统计信息
      // 目前返回基础信息
      return {
        totalLogins: 0, // 需要从日志系统获取
        lastLoginAt: user.lastLoginAt,
        loginDevices: [], // 需要从登录记录获取
        failedAttempts: 0 // 需要从Redis获取
      };

    } catch (error) {
      logger.error('Get login stats failed', { userId, error: error.message }, error.stack);
      throw error;
    }
  }

  /**
   * 更改密码
   */
  async changePassword(
    userId: string, 
    oldPassword: string, 
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 验证旧密码
      if (user.password) {
        const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isOldPasswordValid) {
          return {
            success: false,
            message: '原密码错误'
          };
        }
      }

      // 设置新密码
      user.password = await this.hashPassword(newPassword);
      await user.save();

      console.log(`✅ 用户 ${user.phone} 密码修改成功`);

      return {
        success: true,
        message: '密码修改成功'
      };

    } catch (error) {
      logger.error('Password change failed', { userId, error: error.message }, error.stack);
      return {
        success: false,
        message: '密码修改失败，请稍后重试'
      };
    }
  }
}

export default AuthService;