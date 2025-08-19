import mongoose from 'mongoose';
import { UserProfileService } from '../services/UserProfileService';
import User from '../models/User';

/**
 * 用户信息管理功能简单演示
 */

async function connectDatabase() {
  try {
    await mongoose.connect('mongodb://localhost:27017/smartCharging');
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
}

async function createTestUser(): Promise<string> {
  console.log('\n📝 创建测试用户...');
  
  // 删除可能存在的测试用户
  await User.deleteOne({ phone: '13800138888' });
  
  const testUser = new User({
    phone: '13800138888',
    nickName: '演示用户',
    email: 'demo@example.com',
    gender: 'male',
    birthday: new Date('1990-01-01'),
    address: '北京市朝阳区演示街道123号',
    emergencyContact: {
      name: '紧急联系人',
      phone: '13900139999',
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
    balance: 100.50,
    totalLogins: 25,
    lastLoginAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1天前
  });
  
  const savedUser = await testUser.save();
  console.log(`✅ 测试用户创建成功，ID: ${savedUser._id}`);
  
  return savedUser._id.toString();
}

async function demonstrateGetUserProfile(userId: string) {
  console.log('\n👤 获取用户资料...');
  
  try {
    const profile = await UserProfileService.getUserProfile(userId);
    
    if (profile) {
      console.log('✅ 用户资料获取成功:');
      console.log(`   昵称: ${profile.nickName}`);
      console.log(`   手机: ${profile.phone}`);
      console.log(`   邮箱: ${profile.email}`);
      console.log(`   性别: ${profile.gender}`);
      console.log(`   生日: ${profile.birthday?.toLocaleDateString()}`);
      console.log(`   地址: ${profile.address}`);
      console.log(`   紧急联系人: ${profile.emergencyContact?.name} (${profile.emergencyContact?.phone})`);
      console.log(`   主题偏好: ${profile.preferences?.theme}`);
      console.log(`   语言偏好: ${profile.preferences?.language}`);
    } else {
      console.log('❌ 用户不存在');
    }
  } catch (error) {
    console.error('❌ 获取用户资料失败:', error);
  }
}

async function demonstrateUpdateProfile(userId: string) {
  console.log('\n✏️ 更新用户资料...');
  
  try {
    const result = await UserProfileService.updateUserProfile({
      userId,
      nickName: '更新后的昵称',
      email: 'updated@example.com',
      address: '上海市浦东新区更新街道456号',
      emergencyContact: {
        name: '新紧急联系人',
        phone: '13700137777',
        relationship: '朋友'
      }
    });
    
    if (result.success) {
      console.log('✅ 用户资料更新成功');
      console.log(`   新昵称: ${result.profile?.nickName}`);
      console.log(`   新邮箱: ${result.profile?.email}`);
      console.log(`   新地址: ${result.profile?.address}`);
    } else {
      console.log(`❌ 更新失败: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ 更新用户资料失败:', error);
  }
}

async function demonstrateUpdatePreferences(userId: string) {
  console.log('\n⚙️ 更新偏好设置...');
  
  try {
    const result = await UserProfileService.updatePreferences(userId, {
      theme: 'dark',
      language: 'en-US',
      notifications: {
        email: false,
        sms: true,
        push: true
      },
      privacy: {
        showProfile: false,
        showChargingHistory: true
      }
    });
    
    if (result.success) {
      console.log('✅ 偏好设置更新成功');
      console.log('   主题: 深色模式');
      console.log('   语言: 英语');
      console.log('   邮件通知: 关闭');
      console.log('   资料可见性: 隐藏');
    } else {
      console.log(`❌ 偏好设置更新失败: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ 更新偏好设置失败:', error);
  }
}

async function demonstrateProfileCompleteness(userId: string) {
  console.log('\n📊 验证资料完整性...');
  
  try {
    const completeness = await UserProfileService.validateProfileCompleteness(userId);
    
    console.log(`✅ 资料完整性验证完成:`);
    console.log(`   完整度: ${completeness.completionRate}%`);
    console.log(`   是否完整: ${completeness.isComplete ? '是' : '否'}`);
    
    if (completeness.missingFields.length > 0) {
      console.log(`   缺失字段: ${completeness.missingFields.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ 验证资料完整性失败:', error);
  }
}

async function demonstrateSecurityInfo(userId: string) {
  console.log('\n🔒 获取安全信息...');
  
  try {
    const securityInfo = await UserProfileService.getUserSecurityInfo(userId);
    
    if (securityInfo) {
      console.log('✅ 用户安全信息:');
      console.log(`   最后登录时间: ${securityInfo.lastLoginAt?.toLocaleString() || '未知'}`);
      console.log(`   最后登录IP: ${securityInfo.lastLoginIP || '未知'}`);
      console.log(`   登录尝试次数: ${securityInfo.loginAttempts}`);
      console.log(`   账户是否锁定: ${securityInfo.isLocked ? '是' : '否'}`);
      console.log(`   密码修改时间: ${securityInfo.passwordChangedAt?.toLocaleString() || '未知'}`);
      console.log(`   双因子认证: ${securityInfo.twoFactorEnabled ? '已启用' : '未启用'}`);
      console.log(`   安全问题数量: ${securityInfo.securityQuestions?.length || 0}`);
    } else {
      console.log('❌ 用户不存在');
    }
  } catch (error) {
    console.error('❌ 获取安全信息失败:', error);
  }
}

async function cleanupTestData(userId: string) {
  console.log('\n🧹 清理测试数据...');
  
  try {
    await User.findByIdAndDelete(userId);
    console.log('✅ 测试数据清理完成');
  } catch (error) {
    console.error('❌ 清理测试数据失败:', error);
  }
}

async function runUserProfileDemo() {
  console.log('🚀 开始用户信息管理功能演示\n');
  
  await connectDatabase();
  
  let userId: string;
  
  try {
    // 1. 创建测试用户
    userId = await createTestUser();
    
    // 2. 获取用户资料
    await demonstrateGetUserProfile(userId);
    
    // 3. 更新用户资料
    await demonstrateUpdateProfile(userId);
    
    // 4. 更新偏好设置
    await demonstrateUpdatePreferences(userId);
    
    // 5. 验证资料完整性
    await demonstrateProfileCompleteness(userId);
    
    // 6. 获取安全信息
    await demonstrateSecurityInfo(userId);
    
    console.log('\n🎉 用户信息管理功能演示完成！');
    
  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error);
  } finally {
    // 清理测试数据
    if (userId!) {
      await cleanupTestData(userId);
    }
    
    // 关闭数据库连接
    await mongoose.connection.close();
    console.log('📝 数据库连接已关闭');
  }
}

// 如果直接运行此文件，则执行演示
if (require.main === module) {
  runUserProfileDemo().catch(console.error);
}

export { runUserProfileDemo };