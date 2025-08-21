import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { FaceRecognitionService } from './FaceRecognitionService';
import { SliderVerifyService } from './SliderVerifyService';

export interface LoginRequest {
  phone: string;
  password?: string;
  verificationToken?: string;
  faceImage?: Buffer;
  deviceInfo: {
    userAgent: string;
    platform: string;
    ip: string;
  };
}

export interface RegisterRequest {
  phone: string;
  password?: string;
  nickName?: string;
  avatarUrl?: string;
  verificationToken?: string;
  faceImage?: Buffer;
  deviceInfo: {
    userAgent: string;
    platform: string;
    ip: string;
  };
}

export interface AuthResult {
  success: boolean;
  message: string;
  data?: {
    token: string;
    refreshToken: string;
    user: {
      id: string;
      phone: string;
      nickName: string;
      balance: number;
      verificationLevel: string;
      faceEnabled: boolean;
      avatarUrl?: string;
      hasPassword: boolean;
    };
    isNewUser?: boolean;
  };
}

export interface LoginHistory {
  timestamp: Date;
  deviceInfo: {
    userAgent: string;
    platform: string;
    ip: string;
  };
  loginMethod: 'password' | 'verification' | 'face';
  success: boolean;
}

export default class UserAuthService {
  private faceRecognitionService: FaceRecognitionService;
  private sliderVerifyService: SliderVerifyService;
  private redis: import('./RedisService').RedisService;

  constructor() {
    this.faceRecognitionService = new FaceRecognitionService();
    this.sliderVerifyService = new SliderVerifyService();
    this.redis = new (require('./RedisService').RedisService)();
  }

  /**
   * 用户登录
   */
  async login(request: LoginRequest): Promise<AuthResult> {
    try {
      const { phone, password, verificationToken, faceImage, deviceInfo } = request;

      // 验证滑块验证token
      if (verificationToken) {
        const isTokenValid = await this.sliderVerifyService.validateToken(verificationToken);
        if (!isTokenValid) {
          return {
            success: false,
            message: '验证令牌无效或已过期，请重新验证'
          };
        }
      }

      // 查找或创建用户（首次登录自动注册）
      let user = await User.findOne({ phone });
      let isNewUser = false;
      
      if (!user) {
        // 首次登录自动注册新用户
        user = new User({
          phone,
          nickName: `用户${phone.slice(-4)}`,
          balance: 0,
          verificationLevel: 'basic',
          faceEnabled: false,
          status: 'active',
          loginAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        await user.save();
        isNewUser = true;
        console.log('👤 首次登录，自动注册新用户:', user.phone);
      }

      let loginMethod: 'password' | 'verification' | 'face' = 'verification';

      // 验证登录方式
      if (password && user.password) {
        // 密码登录
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          await this.recordLoginHistory(user._id.toString(), deviceInfo, 'password', false);
          return {
            success: false,
            message: '密码错误'
          };
        }
        loginMethod = 'password';
      } else if (faceImage && user.faceEnabled) {
        // 人脸识别登录
        const faceVerificationResult = await this.faceRecognitionService.verifyFace(
          user._id.toString(),
          faceImage
        );
        if (!faceVerificationResult.success) {
          await this.recordLoginHistory(user._id.toString(), deviceInfo, 'face', false);
          return {
            success: false,
            message: faceVerificationResult.message || '人脸识别失败'
          };
        }
        loginMethod = 'face';
      } else if (!verificationToken) {
        return {
          success: false,
          message: '请提供有效的登录凭证'
        };
      }

      // 生成tokens
      const token = this.generateToken(user._id.toString());
      const refreshToken = this.generateRefreshToken(user._id.toString());

      // 存储refresh token到Redis
      await this.redis.setex(`refresh_token:${user._id.toString()}`, 7 * 24 * 60 * 60, refreshToken);

      // 更新最后登录时间
      user.updatedAt = new Date();
      await user.save();

      // 记录登录历史
      await this.recordLoginHistory(user._id.toString(), deviceInfo, loginMethod, true);

      return {
        success: true,
        message: isNewUser ? '欢迎新用户，注册并登录成功' : '登录成功',
        data: {
          token,
          refreshToken,
          user: {
            id: user._id.toString(),
            phone: user.phone,
            nickName: user.nickName || `用户${user.phone.slice(-4)}`,
            balance: user.balance || 0,
            verificationLevel: user.verificationLevel || 'basic',
            faceEnabled: user.faceEnabled || false,
            avatarUrl: user.avatarUrl,
            hasPassword: !!user.password
          },
          isNewUser
        }
      };
    } catch (error) {
      console.error('登录失败:', error);
      return {
        success: false,
        message: '登录过程中出现错误'
      };
    }
  }

  /**
   * 用户注册
   */
  async register(request: RegisterRequest): Promise<AuthResult> {
    try {
      const { phone, password, nickName, avatarUrl, verificationToken, faceImage, deviceInfo } = request;

      // 验证滑块验证token
      if (verificationToken) {
        const isTokenValid = await this.sliderVerifyService.validateToken(verificationToken);
        if (!isTokenValid) {
          return {
            success: false,
            message: '验证令牌无效或已过期，请重新验证'
          };
        }
      }

      // 检查用户是否已存在
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        return {
          success: false,
          message: '用户已存在'
        };
      }

      // 创建新用户
      const userData: any = {
        phone,
        nickName: nickName || `用户${phone.slice(-4)}`,
        avatarUrl,
        balance: 0,
        verificationLevel: 'basic',
        faceEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 如果提供了密码，进行加密
      if (password) {
        userData.password = await bcrypt.hash(password, 10);
      }

      const user = new User(userData);
      await user.save();

      // 如果提供了人脸图片，注册人脸
      if (faceImage) {
        const faceRegistrationResult = await this.faceRecognitionService.registerFace(
          user._id.toString(),
          faceImage
        );
        if (faceRegistrationResult.success) {
          user.faceEnabled = true;
          user.verificationLevel = 'face_verified';
          await user.save();
        }
      }

      // 生成tokens
      const token = this.generateToken(user._id.toString());
      const refreshToken = this.generateRefreshToken(user._id.toString());

      // 存储refresh token到Redis
      await this.redis.setex(`refresh_token:${user._id.toString()}`, 7 * 24 * 60 * 60, refreshToken);

      // 记录登录历史
      await this.recordLoginHistory(user._id.toString(), deviceInfo, 'verification', true);

      return {
        success: true,
        message: '注册成功',
        data: {
          token,
          refreshToken,
          user: {
            id: user._id.toString(),
            phone: user.phone,
            nickName: user.nickName,
            balance: user.balance,
            verificationLevel: user.verificationLevel,
            faceAuthEnabled: user.faceAuthEnabled,
            avatarUrl: user.avatarUrl,
            hasPassword: !!user.password
          },
          isNewUser: true
        }
      };
    } catch (error) {
      console.error('注册失败:', error);
      return {
        success: false,
        message: '注册过程中出现错误'
      };
    }
  }

  /**
   * 用户登出
   */
  async logout(userId: string, refreshToken?: string): Promise<{ success: boolean; message: string }> {
    try {
      // 从Redis移除refresh token
      await this.redis.del(`refresh_token:${userId}`);

      return {
        success: true,
        message: '登出成功'
      };
    } catch (error) {
      console.error('登出失败:', error);
      return {
        success: false,
        message: '登出过程中出现错误'
      };
    }
  }

  /**
   * 刷新token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      // 验证refresh token
      const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!jwtRefreshSecret) {
      throw new Error('JWT refresh secret not configured');
    }
    const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as any;
      const userId = decoded.userId;

      // 检查refresh token是否存在
      const storedRefreshToken = await this.redis.get(`refresh_token:${userId}`);
      if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
        return {
          success: false,
          message: 'Refresh token无效'
        };
      }

      // 查找用户
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 生成新的tokens
      const newToken = this.generateToken(userId);
      const newRefreshToken = this.generateRefreshToken(userId);

      // 更新refresh token到Redis
      await this.redis.setex(`refresh_token:${userId}`, 7 * 24 * 60 * 60, newRefreshToken);

      return {
        success: true,
        message: 'Token刷新成功',
        data: {
          token: newToken,
          refreshToken: newRefreshToken,
          user: {
            id: user._id.toString(),
            phone: user.phone,
            nickName: user.nickName,
            balance: user.balance,
            verificationLevel: user.verificationLevel || 'basic',
            faceEnabled: user.faceEnabled || false,
            avatarUrl: user.avatarUrl,
            hasPassword: !!user.password
          }
        }
      };
    } catch (error) {
      console.error('Token刷新失败:', error);
      return {
        success: false,
        message: 'Token刷新失败'
      };
    }
  }

  /**
   * 更新密码
   */
  async updatePassword(userId: string, oldPassword?: string, newPassword?: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 如果用户已有密码，需要验证旧密码
      if (user.password && oldPassword) {
        const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isOldPasswordValid) {
          return {
            success: false,
            message: '原密码错误'
          };
        }
      }

      // 加密新密码 - 使用更强的salt rounds
      if (newPassword) {
        // 验证密码强度
        if (newPassword.length < 8) {
          return {
            success: false,
            message: '密码长度至少8位'
          };
        }
        
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(newPassword)) {
          return {
            success: false,
            message: '密码必须包含大小写字母、数字和特殊字符'
          };
        }
        
        user.password = await bcrypt.hash(newPassword, 12); // 使用12 rounds更安全
        user.updatedAt = new Date();
        await user.save();
      }

      return {
        success: true,
        message: '密码更新成功'
      };
    } catch (error) {
      console.error('更新密码失败:', error);
      return {
        success: false,
        message: '更新密码过程中出现错误'
      };
    }
  }

  /**
   * 重置密码
   */
  async resetPassword(phone: string, newPassword: string, verificationToken: string): Promise<{ success: boolean; message: string }> {
    try {
      // 验证滑块验证token
      const isTokenValid = await this.sliderVerifyService.validateToken(verificationToken);
      if (!isTokenValid) {
        return {
          success: false,
          message: '验证令牌无效或已过期'
        };
      }

      const user = await User.findOne({ phone });
      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 加密新密码
      user.password = await bcrypt.hash(newPassword, 10);
      user.updatedAt = new Date();
      await user.save();

      // 清除该用户的refresh token
      await this.redis.del(`refresh_token:${user._id.toString()}`);

      return {
        success: true,
        message: '密码重置成功'
      };
    } catch (error) {
      console.error('重置密码失败:', error);
      return {
        success: false,
        message: '重置密码过程中出现错误'
      };
    }
  }

  /**
   * 获取登录历史
   */
  async getLoginHistory(userId: string, limit = 10): Promise<LoginHistory[]> {
    try {
      // 这里应该从数据库获取登录历史
      // 目前返回空数组，实际应该实现数据库存储
      return [];
    } catch (error) {
      console.error('获取登录历史失败:', error);
      return [];
    }
  }

  /**
   * 生成JWT token
   */
  private generateToken(userId: string): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT secret not configured');
    }
    return jwt.sign(
      { userId },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
  }

  /**
   * 生成refresh token
   */
  private generateRefreshToken(userId: string): string {
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!jwtRefreshSecret) {
      throw new Error('JWT refresh secret not configured');
    }
    return jwt.sign(
      { userId },
      jwtRefreshSecret,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );
  }

  /**
   * 记录登录历史
   */
  private async recordLoginHistory(
    userId: string,
    deviceInfo: { userAgent: string; platform: string; ip: string },
    loginMethod: 'password' | 'verification' | 'face',
    success: boolean
  ): Promise<void> {
    try {
      // 这里应该将登录历史存储到数据库
      // 目前只是日志记录
      console.log(`登录历史记录: 用户${userId}, 方式${loginMethod}, 成功${success}`);
    } catch (error) {
      console.error('记录登录历史失败:', error);
    }
  }
}