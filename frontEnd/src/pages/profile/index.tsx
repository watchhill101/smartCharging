import { View, Text, Button, Image } from '@tarojs/components';
import { useState, useEffect } from 'react';
import {
  useLoad,
  getStorageSync as taroGetStorageSync,
  setStorageSync as taroSetStorageSync,
  showToast,
  navigateTo
} from '@tarojs/taro';

import request from '../../utils/request';
import { STORAGE_KEYS } from '../../utils/constants';
import './index.scss';

interface UserProfile {
  id: string;
  phone: string;
  nickName: string;
  balance: number;
  verificationLevel: 'basic' | 'face_verified';
  vehicles: any[];
  avatarUrl?: string;
  chargingCount?: number;
  points?: number;
}



export default function Profile() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);


  useLoad(() => {
    console.log('🏠 个人中心页面加载');
    loadUserProfile();
  });

  // 页面每次显示时都重新加载用户信息
  useEffect(() => {
    const handleShow = () => {
      console.log('📱 页面显示，重新加载用户信息');
      loadUserProfile();
    };

    // 立即执行一次
    handleShow();
  }, []);

  const loadUserProfile = async () => {
    try {
      console.log('🔄 开始加载用户信息...');

      // 首先尝试从存储中获取用户信息
      let storedUserInfo = null;
      let token = null;

      try {
        storedUserInfo = taroGetStorageSync(STORAGE_KEYS.USER_INFO);
        token = taroGetStorageSync(STORAGE_KEYS.USER_TOKEN);
      } catch (error) {
        console.error('❌ 读取存储失败:', error);
      }

      console.log('📦 存储信息检查:', {
        hasUserInfo: !!storedUserInfo,
        hasToken: !!token,
        userInfo: storedUserInfo
      });

      if (storedUserInfo && typeof storedUserInfo === 'object') {
        console.log('✅ 从存储加载用户信息:', storedUserInfo);
        const userInfo = storedUserInfo as UserProfile;
        const profileData = {
          ...userInfo,
          nickName: userInfo.nickName || `用户${userInfo.phone?.slice(-4) || ''}`,
          chargingCount: userInfo.chargingCount || 0,
          points: userInfo.points || 0
        };
        console.log('📋 设置用户配置:', profileData);
        setUserProfile(profileData);
        return;
      }

      if (!token) {
        console.log('❌ 未找到用户token，使用默认信息');
        // 使用模拟数据而不是直接跳转登录
        setUserProfile({
          id: 'demo_user',
          phone: '17728203358',
          nickName: '用户3358',
          balance: 0.00,
          verificationLevel: 'basic',
          vehicles: [],
          chargingCount: 0,
          points: 0
        });
        return;
      }

      const response = await request({
        url: '/auth/me',
        method: 'GET'
      });

      if (response.data.success && response.data.data?.user) {
        const userInfo = response.data.data.user;
        setUserProfile(userInfo);
        // 更新存储的用户信息
        taroSetStorageSync(STORAGE_KEYS.USER_INFO, userInfo);
      } else {
        throw new Error(response.data.message || '获取用户信息失败');
      }
    } catch (error: any) {
      console.error('加载用户信息失败:', error);

      // 尝试使用存储的用户信息作为后备
      let storedUserInfo = null;
      try {
        storedUserInfo = taroGetStorageSync(STORAGE_KEYS.USER_INFO);
      } catch (error) {
        console.error('❌ 读取存储失败:', error);
      }

      if (storedUserInfo && typeof storedUserInfo === 'object') {
        console.log('🔄 使用存储的用户信息作为后备:', storedUserInfo);
        const userInfo = storedUserInfo as UserProfile;
        setUserProfile({
          ...userInfo,
          chargingCount: userInfo.chargingCount || 0,
          points: userInfo.points || 0
        });
      } else {
        console.log('📱 使用默认用户信息');
        // 使用模拟数据作为最后的后备
        setUserProfile({
          id: 'demo_user',
          phone: '17728203358',
          nickName: '用户3358',
          balance: 0.00,
          verificationLevel: 'basic',
          vehicles: [],
          chargingCount: 0,
          points: 0
        });
      }
    }
  };





  const navigateToFunction = (functionName: string) => {
    console.log('🚀 尝试跳转功能:', functionName);
    
    if (functionName === '我的订单') {
      console.log('📋 跳转到我的订单页面');
      navigateTo({
        url: '/pages/orders/index',
        success: () => console.log('✅ 跳转成功'),
        fail: (error) => console.error('❌ 跳转失败:', error)
      });
      return;
    }
    
    
    if (functionName === '我的车辆') {
      console.log('🛵 跳转到我的车辆页面');
      navigateTo({
        url: '/pages/vehicles/index',
        success: () => console.log('✅ 跳转成功'),
        fail: (error) => console.error('❌ 跳转失败:', error)
      });
      return;
    }
    
    
    if (functionName === '钱包' || functionName === '我的钱包') {
      console.log('💰 跳转到钱包页面');
      navigateTo({
        url: '/pages/wallet/index',
        success: () => console.log('✅ 跳转成功'),
        fail: (error) => console.error('❌ 跳转失败:', error)
      });
      return;
    }
    
    if (functionName === '我的卡券') {
      console.log('🎫 跳转到我的卡券页面');
      navigateTo({
        url: '/pages/profile/coupons',
        success: () => console.log('✅ 跳转成功'),
        fail: (error) => console.error('❌ 跳转失败:', error)
      });
      return;
    }
    
    // 其他功能跳转到"功能开发中"页面
    console.log('🚧 尝试跳转到功能开发中页面:', functionName);
    
    // 先显示Toast提示，然后尝试跳转
    showToast({
      title: `${functionName}功能开发中`,
      icon: 'none',
      duration: 1500
    });
    
    // 延迟跳转，让用户看到Toast提示
    setTimeout(() => {
      navigateTo({
        url: `/pages/under-development/index?functionName=${encodeURIComponent(functionName)}`,
        success: () => {
          console.log('✅ 跳转到功能开发中页面成功');
        },
        fail: (error) => {
          console.error('❌ 跳转到功能开发中页面失败:', error);
          console.log('🔄 尝试跳转到测试页面...');
          
          // 如果跳转失败，跳转到测试页面
          navigateTo({
            url: '/pages/test-jump/index',
            success: () => {
              console.log('✅ 跳转到测试页面成功');
            },
            fail: (testError) => {
              console.error('❌ 跳转到测试页面也失败了:', testError);
            }
          });
        }
      });
    }, 1500);
  };
  return (
    <View className='profile-page'>
      {/* 头部区域 */}
      <View className='profile-header'>
        <View className='header-bg'></View>
        <View className='header-content'>
          {/* 用户信息区域 */}
          <View className='user-info-section'>
            <View className='user-basic-info'>
              <View className='user-avatar'>
                {userProfile?.avatarUrl ? (
                  <Image src={userProfile.avatarUrl} className='avatar-image' />
                ) : (
                  <View className='avatar-default'>
                    <Text className='avatar-icon'>👤</Text>
                  </View>
                )}
              </View>
              <View className='user-details'>
                <Text className='user-name'>
                  {userProfile?.nickName || `用户${userProfile?.phone?.slice(-4) || '3358'}`}
                </Text>
                <View className='user-id-section'>
                  <Text className='user-id-label'>ID</Text>
                  <Text className='user-id'>{userProfile?.phone || '17728203358'}</Text>
                  <Text className='user-type'>汽车充电</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 完善资料提示 */}
          <View className='info-tip'>
            <Text className='tip-text'>您的资料还未完善，完善后可获得7天头像挂件</Text>
            <Text className='complete-link' onClick={() => navigateToFunction('完善资料')}>去完善 {'>'}</Text>
          </View>
        </View>
      </View>

      {/* 统计数据区域 */}
      <View className='stats-section'>
        <View className='stat-item'>
          <Text className='stat-number'>{userProfile?.chargingCount || 0}</Text>
          <Text className='stat-label'>充电中</Text>
        </View>
        <View className='stat-divider'></View>
        <View className='stat-item'>
          <Text className='stat-number'>{userProfile?.points || 0}</Text>
          <Text className='stat-label'>积分</Text>
        </View>
        <View className='stat-divider'></View>
        <View className='stat-item' onClick={() => navigateToFunction('钱包')}>
          <Text className='stat-number'>{userProfile?.balance?.toFixed(2) || '0.00'}</Text>
          <Text className='stat-label'>我的余额</Text>
        </View>
        <View className='stat-divider'></View>
        <View className='stat-item' onClick={() => navigateToFunction('我的卡券')}>
          <Text className='stat-number'>0</Text>
          <Text className='stat-label'>我的卡券</Text>
        </View>
      </View>

      {/* 安心充电服务 */}
      <View className='service-section'>
        <View className='service-content'>
          <View className='service-info'>
            <Text className='service-title'>安心充电服务</Text>
            <Text className='service-desc'>服务升级，守护您的每次充电</Text>
          </View>
          <Button className='service-button' onClick={() => navigateToFunction('安心充电服务')}>
            <Text className='button-text'>立即实时防护</Text>
            <View className='button-icon'>
              <Text className='arrow-icon'>→</Text>
            </View>
          </Button>
        </View>
      </View>

      {/* 常用功能 */}
      <View className='functions-section'>
        <Text className='section-title'>常用功能</Text>
        <View className='functions-grid'>
          <View className='function-item' onClick={() => navigateToFunction('我的订单')}>
            <View className='function-icon order-icon'>
              <View className='order-box'>
                <View className='order-lid'></View>
                <View className='order-lightning'>⚡</View>
              </View>
            </View>
            <Text className='function-label'>我的订单</Text>
          </View>
          <View className='function-item' onClick={() => navigateToFunction('我的电卡')}>
            <View className='function-icon card-icon'>
              <View className='card-tag'>
                <View className='card-hole'></View>
                <View className='card-lightning'>⚡</View>
                <View className='card-shadow'></View>
              </View>
            </View>
            <Text className='function-label'>我的电卡</Text>
          </View>
          <View className='function-item' onClick={() => navigateToFunction('包月套餐')}>
            <View className='function-icon package-icon'>
              <View className='package-tag'>
                <View className='package-crescent'></View>
                <Text className='package-number'>30</Text>
                <View className='package-flap'></View>
              </View>
            </View>
            <Text className='function-label'>包月套餐</Text>
          </View>


          <View className='function-item' onClick={() => navigateToFunction('我的车辆')}>
            <View className='function-icon vehicle-icon'>🛵</View>
            <Text className='function-label'>我的车辆</Text>
          </View>
          <View className='function-item' onClick={() => navigateToFunction('常用设置')}>
            <View className='function-icon settings-icon'>⚙️</View>
            <Text className='function-label'>常用设置</Text>
          </View>
          <View className='function-item' onClick={() => navigateToFunction('AI客服')}>
            <View className='function-icon ai-icon'>
              <View className='ai-bubble'>
                <Text className='ai-text'>Ai</Text>
              </View>
            </View>
            <Text className='function-label'>AI客服</Text>
          </View>
          <View className='function-item' onClick={() => navigateToFunction('头像装扮')}>
            <View className='function-icon avatar-icon'>
              <View className='shirt-container'>
                <View className='shirt-outline'>
                  <View className='shirt-pocket'></View>
                </View>
              </View>
            </View>
            <Text className='function-label'>头像装扮</Text>
          </View>
          <View className='function-item' onClick={() => navigateToFunction('电池报告')}>
            <View className='function-icon battery-icon'>
              <View className='battery-container'>
                <View className='battery-outline'>
                  <View className='battery-wave'></View>
                </View>
                <View className='new-badge'>NEW</View>
              </View>
            </View>
            <Text className='function-label'>电池报告</Text>
          </View>
        </View>
      </View>



    </View>
  );
}