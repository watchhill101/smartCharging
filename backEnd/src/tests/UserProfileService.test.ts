import { UserProfileService } from '../services/UserProfileService';
import User from '../models/User';

// Mock dependencies
jest.mock('../models/User');
jest.mock('../services/RedisService');

const MockedUser = User as jest.Mocked<typeof User>;

describe('UserProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      const mockUser = {
        _id: 'user123',
        nickName: '测试用户',
        phone: '13800138000',
        email: 'test@example.com',
        avatar: '/api/users/avatar/avatar_user123_test.jpg',
        gender: 'male',
        birthday: new Date('1990-01-01'),
        address: '北京市朝阳区',
        emergencyContact: {
          name: '紧急联系人',
          phone: '13900139000',
          relationship: '家人'
        },
        preferences: {
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
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02')
      };

      MockedUser.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await UserProfileService.getUserProfile('user123');

      expect(result).toEqual({
        id: 'user123',
        nickName: '测试用户',
        phone: '13800138000',
        email: 'test@example.com',
        avatar: '/api/users/avatar/avatar_user123_test.jpg',
        gender: 'male',
        birthday: new Date('1990-01-01'),
        address: '北京市朝阳区',
        emergencyContact: {
          name: '紧急联系人',
          phone: '13900139000',
          relationship: '家人'
        },
        preferences: {
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
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02')
      });
    });

    it('should return null if user not found', async () => {
      MockedUser.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      const result = await UserProfileService.getUserProfile('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      const mockUpdatedUser = {
        _id: 'user123',
        nickName: '新昵称',
        email: 'new@example.com',
        updatedAt: new Date()
      };

      MockedUser.findOne = jest.fn().mockResolvedValue(null); // 邮箱未被使用
      MockedUser.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUpdatedUser);
      
      // Mock getUserProfile
      jest.spyOn(UserProfileService, 'getUserProfile').mockResolvedValue({
        id: 'user123',
        nickName: '新昵称',
        phone: '13800138000',
        email: 'new@example.com',
        preferences: {
          language: 'zh-CN',
          theme: 'light',
          notifications: { email: true, sms: true, push: true },
          privacy: { showProfile: true, showChargingHistory: true }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await UserProfileService.updateUserProfile('user123', {
        nickName: '新昵称',
        email: 'new@example.com'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('用户资料更新成功');
      expect(result.user?.nickName).toBe('新昵称');
      expect(result.user?.email).toBe('new@example.com');
    });

    it('should reject invalid email format', async () => {
      const result = await UserProfileService.updateUserProfile('user123', {
        email: 'invalid-email'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('邮箱格式不正确');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        _id: 'user123',
        password: 'hashed-old-password'
      };

      MockedUser.findById = jest.fn().mockResolvedValue(mockUser);
      MockedUser.findByIdAndUpdate = jest.fn().mockResolvedValue(true);
      mockedBcrypt.compare = jest.fn()
        .mockResolvedValueOnce(true)  // 当前密码正确
        .mockResolvedValueOnce(false); // 新密码与当前密码不同
      mockedBcrypt.hash = jest.fn().mockResolvedValue('hashed-new-password');

      const result = await UserProfileService.changePassword({
        userId: 'user123',
        currentPassword: 'oldPassword123',
        newPassword: 'NewPassword123'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('密码修改成功');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('NewPassword123', 12);
    });

    it('should reject incorrect current password', async () => {
      const mockUser = {
        _id: 'user123',
        password: 'hashed-old-password'
      };

      MockedUser.findById = jest.fn().mockResolvedValue(mockUser);
      mockedBcrypt.compare = jest.fn().mockResolvedValue(false);

      const result = await UserProfileService.changePassword({
        userId: 'user123',
        currentPassword: 'wrongPassword',
        newPassword: 'NewPassword123'
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('当前密码不正确');
    });
  });

  describe('uploadAvatar', () => {
    const mockFile = {
      originalname: 'avatar.jpg',
      mimetype: 'image/jpeg',
      size: 1024 * 1024, // 1MB
      buffer: Buffer.from('fake-image-data')
    } as Express.Multer.File;

    it('should upload avatar successfully', async () => {
      const mockUser = {
        _id: 'user123',
        avatar: null
      };

      MockedUser.findById = jest.fn().mockResolvedValue(mockUser);
      MockedUser.findByIdAndUpdate = jest.fn().mockResolvedValue(true);
      mockedFs.existsSync = jest.fn().mockReturnValue(true);
      mockedFs.mkdirSync = jest.fn();
      mockedFs.writeFileSync = jest.fn();

      const result = await UserProfileService.uploadAvatar('user123', mockFile);

      expect(result.success).toBe(true);
      expect(result.message).toBe('头像上传成功');
      expect(result.avatarUrl).toMatch(/^\/api\/users\/avatar\/avatar_user123_/);
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });

    it('should reject unsupported file type', async () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'text/plain'
      };

      const result = await UserProfileService.uploadAvatar('user123', invalidFile);

      expect(result.success).toBe(false);
      expect(result.message).toBe('不支持的文件类型，请上传 JPEG、PNG、GIF 或 WebP 格式的图片');
    });
  });
});