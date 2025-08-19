import mongoose from 'mongoose';
import User, { IUser } from '../models/User';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { RedisService } from './RedisService';

export interface UserProfile {
  id: string;
  phone: string;
  nickName: string;
  email?: string;
  avatar?: string;
  avatarUrl?: string;
  gender?: 'male' | 'female' | 'other';
  birthday?: Date;
  address?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  preferences?: {
    language: string;
    theme: 'light' | 'dark' | 'auto';
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    privacy: {
      showProfile: boolean;
      showChargingHistory: boolean;
    };
  };
  balance: number;
  vehicles: Array<{
    brand: string;
    model: string;
    licensePlate: string;
    batteryCapacity?: number;
  }>;
  lastLoginAt?: Date;
  faceEnabled: boolean;
  faceProfileCount: number;
  verificationLevel: 'basic' | 'face_verified';
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileParams {
  userId: string;
  nickName?: string;
  email?: string;
  avatarUrl?: string;
  gender?: 'male' | 'female' | 'other';
  birthday?: Date;
  address?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export interface UploadAvatarParams {
  userId: string;
  file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
  };
}

export interface PhoneVerificationParams {
  userId: string;
  newPhone: string;
  verificationCode: string;
}

export interface VehicleInfo {
  brand: string;
  model: string;
  licensePlate: string;
  batteryCapacity?: number;
}

export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  faceEnabledUsers: number;
  averageBalance: number;
  totalVehicles: number;
}

export interface ChangePasswordParams {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePreferencesParams {
  language?: string;
  theme?: 'light' | 'dark' | 'auto';
  notifications?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  };
  privacy?: {
    showProfile?: boolean;
    showChargingHistory?: boolean;
  };
}

export interface UserSecurityInfo {
  lastLoginAt?: Date;
  lastLoginIP?: string;
  loginAttempts: number;
  isLocked: boolean;
  lockedUntil?: Date;
  passwordChangedAt?: Date;
  twoFactorEnabled: boolean;
  securityQuestions?: Array<{
    question: string;
    answer: string;
  }>;
}

export class UserProfileService {
  private static redisService = new RedisService();

  /**
   * 获取用户档案信息
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // 先从缓存获取
      const cacheKey = `user_profile:${userId}`;
      const cachedProfile = await this.redisService.get(cacheKey);
      
      if (cachedProfile) {
        return JSON.parse(cachedProfile);
      }

      // 从数据库获取
      const user = await User.findById(userId);
      if (!user) {
        return null;
      }

      const profile: UserProfile = {
        id: user._id.toString(),
        phone: user.phone,
        nickName: user.nickName || `用户${user.phone.slice(-4)}`,
        email: user.email,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        gender: user.gender,
        birthday: user.birthday,
        address: user.address,
        emergencyContact: user.emergencyContact,
        preferences: user.preferences || {
          language: 'zh-CN',
          theme: 'light',
          notifications: {
            email: true,
            sms: true,
            push: true
          },
          privacy: {
            showProfile: true,
            showChargingHistory: true
          }
        },
        balance: user.balance,
        vehicles: user.vehicles,
        lastLoginAt: user.lastLoginAt,
        faceEnabled: user.faceEnabled,
        faceProfileCount: user.faceProfileCount,
        verificationLevel: user.verificationLevel || 'basic',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      // 缓存用户档案（1小时）
      await this.redisService.set(cacheKey, JSON.stringify(profile));

      return profile;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取用户档案失败');
    }
  }

  /**
   * 更新用户档案信息
   */
  static async updateUserProfile(params: UpdateProfileParams): Promise<{
    success: boolean;
    message?: string;
    profile?: UserProfile;
  }> {
    const { userId, nickName, email, avatarUrl, gender, birthday, address, emergencyContact } = params;

    try {
      const updateData: any = {};
      
      if (nickName !== undefined) {
        // 验证昵称
        if (nickName.length < 2 || nickName.length > 20) {
          return { success: false, message: '昵称长度必须在2-20字符之间' };
        }
        updateData.nickName = nickName;
      }

      if (email !== undefined) {
        // 验证邮箱格式
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return { success: false, message: '邮箱格式不正确' };
        }
        
        // 检查邮箱是否已被其他用户使用
        if (email) {
          const existingUser = await User.findOne({ 
            email: email, 
            _id: { $ne: userId } 
          });
          if (existingUser) {
            return { success: false, message: '该邮箱已被其他用户使用' };
          }
        }
        updateData.email = email;
      }

      if (avatarUrl !== undefined) {
        updateData.avatarUrl = avatarUrl;
      }

      if (gender !== undefined) {
        updateData.gender = gender;
      }

      if (birthday !== undefined) {
        updateData.birthday = birthday;
      }

      if (address !== undefined) {
        updateData.address = address;
      }

      if (emergencyContact !== undefined) {
        updateData.emergencyContact = emergencyContact;
      }

      updateData.updatedAt = new Date();

      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true }
      );

      if (!user) {
        return { success: false, message: '用户不存在' };
      }

      // 清除缓存
      await this.clearUserCache(userId);

      // 获取更新后的档案
      const profile = await this.getUserProfile(userId);

      return {
        success: true,
        message: '用户档案更新成功',
        profile: profile!
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '更新用户档案失败'
      };
    }
  }

  /**
   * 上传用户头像
   */
  static async uploadAvatar(params: UploadAvatarParams): Promise<{
    success: boolean;
    message?: string;
    avatarUrl?: string;
  }> {
    const { userId, file } = params;

    try {
      // 验证文件类型
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        return { success: false, message: '只支持 JPG、PNG、GIF 格式的图片' };
      }

      // 验证文件大小（5MB）
      if (file.buffer.length > 5 * 1024 * 1024) {
        return { success: false, message: '图片大小不能超过5MB' };
      }

      // 生成文件名
      const fileExt = path.extname(file.originalname) || '.jpg';
      const fileName = `avatar_${userId}_${Date.now()}${fileExt}`;
      const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
      const filePath = path.join(uploadDir, fileName);

      // 确保目录存在
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // 保存文件
      fs.writeFileSync(filePath, file.buffer);

      // 生成访问URL
      const avatarUrl = `/api/uploads/avatars/${fileName}`;

      // 更新用户头像
      const result = await this.updateUserProfile({
        userId,
        avatarUrl
      });

      if (result.success) {
        return {
          success: true,
          message: '头像上传成功',
          avatarUrl
        };
      } else {
        // 删除已上传的文件
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return result;
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '头像上传失败'
      };
    }
  }

  /**
   * 发送手机号验证码
   */
  static async sendPhoneVerificationCode(userId: string, newPhone: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      // 验证手机号格式
      if (!/^1[3-9]\d{9}$/.test(newPhone)) {
        return { success: false, message: '手机号格式不正确' };
      }

      // 检查手机号是否已被使用
      const existingUser = await User.findOne({ phone: newPhone });
      if (existingUser && existingUser._id.toString() !== userId) {
        return { success: false, message: '该手机号已被其他用户使用' };
      }

      // 生成验证码
      const verificationCode = Math.random().toString().slice(2, 8);
      
      // 缓存验证码（5分钟有效）
      const cacheKey = `phone_verification:${userId}:${newPhone}`;
      await this.redisService.set(cacheKey, verificationCode);

      // 这里应该调用短信服务发送验证码
      // 为了演示，我们只是记录日志
      console.log(`发送验证码到 ${newPhone}: ${verificationCode}`);

      return {
        success: true,
        message: '验证码已发送，请查收短信'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '发送验证码失败'
      };
    }
  }

  /**
   * 验证并更新手机号
   */
  static async verifyAndUpdatePhone(params: PhoneVerificationParams): Promise<{
    success: boolean;
    message?: string;
  }> {
    const { userId, newPhone, verificationCode } = params;

    try {
      // 获取缓存的验证码
      const cacheKey = `phone_verification:${userId}:${newPhone}`;
      const cachedCode = await this.redisService.get(cacheKey);

      if (!cachedCode) {
        return { success: false, message: '验证码已过期，请重新获取' };
      }

      if (cachedCode !== verificationCode) {
        return { success: false, message: '验证码不正确' };
      }

      // 再次检查手机号是否已被使用
      const existingUser = await User.findOne({ phone: newPhone });
      if (existingUser && existingUser._id.toString() !== userId) {
        return { success: false, message: '该手机号已被其他用户使用' };
      }

      // 更新手机号
      await User.findByIdAndUpdate(userId, { phone: newPhone });

      // 清除验证码缓存
      await this.redisService.del(cacheKey);

      // 清除用户缓存
      await this.clearUserCache(userId);

      return {
        success: true,
        message: '手机号更新成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '手机号更新失败'
      };
    }
  }

  /**
   * 添加车辆信息
   */
  static async addVehicle(userId: string, vehicleInfo: VehicleInfo): Promise<{
    success: boolean;
    message?: string;
    vehicle?: VehicleInfo;
  }> {
    try {
      // 验证车辆信息
      const validation = this.validateVehicleInfo(vehicleInfo);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: '用户不存在' };
      }

      // 检查车牌号是否已存在
      const existingVehicle = user.vehicles.find(v => v.licensePlate === vehicleInfo.licensePlate);
      if (existingVehicle) {
        return { success: false, message: '该车牌号已存在' };
      }

      // 添加车辆
      user.vehicles.push(vehicleInfo);
      await user.save();

      // 清除缓存
      await this.clearUserCache(userId);

      return {
        success: true,
        message: '车辆添加成功',
        vehicle: vehicleInfo
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '添加车辆失败'
      };
    }
  }

  /**
   * 更新车辆信息
   */
  static async updateVehicle(userId: string, licensePlate: string, vehicleInfo: Partial<VehicleInfo>): Promise<{
    success: boolean;
    message?: string;
    vehicle?: VehicleInfo;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: '用户不存在' };
      }

      const vehicleIndex = user.vehicles.findIndex(v => v.licensePlate === licensePlate);
      if (vehicleIndex === -1) {
        return { success: false, message: '车辆不存在' };
      }

      // 更新车辆信息
      const updatedVehicle = { ...user.vehicles[vehicleIndex], ...vehicleInfo };
      
      // 验证更新后的车辆信息
      const validation = this.validateVehicleInfo(updatedVehicle);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      user.vehicles[vehicleIndex] = updatedVehicle;
      await user.save();

      // 清除缓存
      await this.clearUserCache(userId);

      return {
        success: true,
        message: '车辆信息更新成功',
        vehicle: updatedVehicle
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '更新车辆信息失败'
      };
    }
  }

  /**
   * 删除车辆信息
   */
  static async removeVehicle(userId: string, licensePlate: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: '用户不存在' };
      }

      const vehicleIndex = user.vehicles.findIndex(v => v.licensePlate === licensePlate);
      if (vehicleIndex === -1) {
        return { success: false, message: '车辆不存在' };
      }

      // 删除车辆
      user.vehicles.splice(vehicleIndex, 1);
      await user.save();

      // 清除缓存
      await this.clearUserCache(userId);

      return {
        success: true,
        message: '车辆删除成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '删除车辆失败'
      };
    }
  }

  /**
   * 更新最后登录时间
   */
  static async updateLastLoginTime(userId: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, { lastLoginAt: new Date() });
      // 清除缓存
      await this.clearUserCache(userId);
    } catch (error) {
      console.error('更新最后登录时间失败:', error);
    }
  }

  /**
   * 获取用户统计信息
   */
  static async getUserStatistics(): Promise<UserStatistics> {
    try {
      const [
        totalUsers,
        activeUsers,
        verifiedUsers,
        faceEnabledUsers,
        balanceStats,
        vehicleStats
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
        User.countDocuments({ verificationLevel: 'face_verified' }),
        User.countDocuments({ faceEnabled: true }),
        User.aggregate([
          { $group: { _id: null, averageBalance: { $avg: '$balance' } } }
        ]),
        User.aggregate([
          { $unwind: '$vehicles' },
          { $count: 'totalVehicles' }
        ])
      ]);

      return {
        totalUsers,
        activeUsers,
        verifiedUsers,
        faceEnabledUsers,
        averageBalance: balanceStats[0]?.averageBalance || 0,
        totalVehicles: vehicleStats[0]?.totalVehicles || 0
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取用户统计失败');
    }
  }

  /**
   * 搜索用户
   */
  static async searchUsers(query: string, page: number = 1, limit: number = 20): Promise<{
    users: UserProfile[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const searchRegex = new RegExp(query, 'i');
      const searchQuery = {
        $or: [
          { phone: searchRegex },
          { nickName: searchRegex }
        ]
      };

      const [users, total] = await Promise.all([
        User.find(searchQuery)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        User.countDocuments(searchQuery)
      ]);

      const userProfiles: UserProfile[] = users.map(user => ({
        id: user._id.toString(),
        phone: user.phone,
        nickName: user.nickName || `用户${user.phone.slice(-4)}`,
        avatarUrl: user.avatarUrl,
        balance: user.balance,
        vehicles: user.vehicles,
        lastLoginAt: user.lastLoginAt,
        faceEnabled: user.faceEnabled,
        faceProfileCount: user.faceProfileCount,
        verificationLevel: user.verificationLevel || 'basic',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));

      return {
        users: userProfiles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '搜索用户失败');
    }
  }

  /**
   * 验证车辆信息
   */
  private static validateVehicleInfo(vehicleInfo: VehicleInfo): { valid: boolean; message?: string } {
    if (!vehicleInfo.brand || vehicleInfo.brand.trim().length === 0) {
      return { valid: false, message: '车辆品牌不能为空' };
    }

    if (!vehicleInfo.model || vehicleInfo.model.trim().length === 0) {
      return { valid: false, message: '车辆型号不能为空' };
    }

    if (!vehicleInfo.licensePlate || vehicleInfo.licensePlate.trim().length === 0) {
      return { valid: false, message: '车牌号不能为空' };
    }

    // 简单的车牌号格式验证
    const licensePlateRegex = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-Z0-9]{4}[A-Z0-9挂学警港澳]{1}$/;
    if (!licensePlateRegex.test(vehicleInfo.licensePlate)) {
      return { valid: false, message: '车牌号格式不正确' };
    }

    if (vehicleInfo.batteryCapacity && (vehicleInfo.batteryCapacity < 10 || vehicleInfo.batteryCapacity > 200)) {
      return { valid: false, message: '电池容量必须在10-200kWh之间' };
    }

    return { valid: true };
  }

  /**
   * 清除用户缓存
   */
  private static async clearUserCache(userId: string): Promise<void> {
    try {
      const cacheKey = `user_profile:${userId}`;
      await this.redisService.del(cacheKey);
    } catch (error) {
      console.error('清除用户缓存失败:', error);
    }
  }

  /**
   * 批量清除用户缓存
   */
  static async clearAllUserCache(): Promise<void> {
    try {
      const pattern = 'user_profile:*';
      const keys = await this.redisService.keys(pattern);
      if (keys.length > 0) {
        for (const key of keys) {
          await this.redisService.del(key);
        }
      }
    } catch (error) {
      console.error('批量清除用户缓存失败:', error);
    }
  }

  /**
   * 生成用户头像默认URL
   */
  static generateDefaultAvatarUrl(userId: string): string {
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`;
  }

  /**
   * 验证用户权限
   */
  static async validateUserPermission(userId: string, requiredLevel: 'basic' | 'face_verified' = 'basic'): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }

      if (requiredLevel === 'face_verified') {
        return user.verificationLevel === 'face_verified';
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 修改密码
   */
  static async changePassword(params: ChangePasswordParams): Promise<{
    success: boolean;
    message?: string;
  }> {
    const { userId, currentPassword, newPassword } = params;

    try {
      // 获取用户信息
      const user = await User.findById(userId);
      if (!user || !user.password) {
        return { success: false, message: '用户不存在或未设置密码' };
      }

      // 验证当前密码
      const bcrypt = require('bcrypt');
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return { success: false, message: '当前密码不正确' };
      }

      // 验证新密码强度
      if (newPassword.length < 6) {
        return { success: false, message: '新密码长度至少6位' };
      }

      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        return { success: false, message: '新密码必须包含大小写字母和数字' };
      }

      // 检查新密码是否与当前密码相同
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return { success: false, message: '新密码不能与当前密码相同' };
      }

      // 加密新密码
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // 更新密码
      await User.findByIdAndUpdate(userId, {
        password: hashedNewPassword,
        passwordChangedAt: new Date(),
        updatedAt: new Date()
      });

      // 清除缓存
      await this.clearUserCache(userId);

      return {
        success: true,
        message: '密码修改成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '密码修改失败'
      };
    }
  }

  /**
   * 更新用户偏好设置
   */
  static async updatePreferences(userId: string, preferences: UpdatePreferencesParams): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: '用户不存在' };
      }

      // 合并偏好设置
      const currentPreferences = user.preferences || {
        language: 'zh-CN',
        theme: 'light',
        notifications: { email: true, sms: true, push: true },
        privacy: { showProfile: true, showChargingHistory: true }
      };

      const updatedPreferences = {
        ...currentPreferences,
        ...preferences,
        notifications: {
          ...currentPreferences.notifications,
          ...preferences.notifications
        },
        privacy: {
          ...currentPreferences.privacy,
          ...preferences.privacy
        }
      };

      await User.findByIdAndUpdate(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date()
      });

      // 清除缓存
      await this.clearUserCache(userId);

      return {
        success: true,
        message: '偏好设置更新成功'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '偏好设置更新失败'
      };
    }
  }

  /**
   * 获取用户安全信息
   */
  static async getUserSecurityInfo(userId: string): Promise<UserSecurityInfo | null> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return null;
      }

      return {
        lastLoginAt: user.lastLoginAt,
        lastLoginIP: user.lastLoginIP,
        loginAttempts: user.loginAttempts || 0,
        isLocked: user.isLocked || false,
        lockedUntil: user.lockedUntil,
        passwordChangedAt: user.passwordChangedAt,
        twoFactorEnabled: user.twoFactorEnabled || false,
        securityQuestions: user.securityQuestions || []
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '获取安全信息失败');
    }
  }

  /**
   * 验证资料完整性
   */
  static async validateProfileCompleteness(userId: string): Promise<{
    isComplete: boolean;
    missingFields: string[];
    completionRate: number;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      const requiredFields = [
        { field: 'nickName', label: '昵称' },
        { field: 'phone', label: '手机号' },
        { field: 'email', label: '邮箱' },
        { field: 'avatar', label: '头像' },
        { field: 'gender', label: '性别' }
      ];

      const missingFields: string[] = [];
      let completedFields = 0;

      requiredFields.forEach(({ field, label }) => {
        if (user[field as keyof IUser]) {
          completedFields++;
        } else {
          missingFields.push(label);
        }
      });

      const completionRate = Math.round((completedFields / requiredFields.length) * 100);
      const isComplete = missingFields.length === 0;

      return {
        isComplete,
        missingFields,
        completionRate
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '验证资料完整性失败');
    }
  }
}