import { View, Text, Button, Image } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro, { useLoad } from '@tarojs/taro';
import FaceVerification from '../../components/FaceVerification';
import VerificationHistory from '../../components/VerificationHistory';
import request from '../../utils/request';
import './index.scss';

interface UserProfile {
  id: string;
  phone: string;
  nickName: string;
  balance: number;
  verificationLevel: 'basic' | 'face_verified';
  vehicles: any[];
  avatarUrl?: string;
}

interface FaceVerificationResult {
  success: boolean;
  message: string;
  data: {
    verified: boolean;
    confidence: number;
    faceDetected: boolean;
    faceCount: number;
    token?: string;
    details?: any;
  };
}

export default function Profile() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [showVerificationHistory, setShowVerificationHistory] = useState(false);
  const [faceVerificationStatus, setFaceVerificationStatus] = useState<'none' | 'pending' | 'success' | 'failed'>('none');

  useLoad(() => {
    console.log('个人中心页面加载');
    loadUserProfile();
  });

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      const token = Taro.getStorageSync('token');

      if (!token) {
        Taro.showToast({ title: '请先登录', icon: 'error' });
        Taro.redirectTo({ url: '/pages/login/login' });
        return;
      }

      const response = await request({
        url: '/auth/me',
        method: 'GET'
      });

      if (response.data.success && response.data.data?.user) {
        setUserProfile(response.data.data.user);
      } else {
        throw new Error(response.data.message || '获取用户信息失败');
      }
    } catch (error: any) {
      console.error('加载用户信息失败:', error);
      Taro.showToast({ title: error.message || '加载失败', icon: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceVerificationSuccess = async (result: FaceVerificationResult) => {
    console.log('人脸验证成功:', result);
    setFaceVerificationStatus('success');
    setShowFaceVerification(false);

    try {
      // 更新用户验证级别
      if (result.data.token && userProfile) {
        const response = await request({
          url: '/users/update-verification',
          method: 'POST',
          data: {
            userId: userProfile.id,
            verificationToken: result.data.token,
            verificationType: 'face'
          }
        });

        if (response.data.success) {
          // 重新加载用户信息
          await loadUserProfile();
          Taro.showToast({
            title: '人脸验证成功，验证级别已提升',
            icon: 'success',
            duration: 3000
          });
        }
      }
    } catch (error: any) {
      console.error('更新验证级别失败:', error);
      Taro.showToast({ title: '验证成功但级别更新失败', icon: 'none' });
    }
  };

  const handleFaceVerificationError = (error: string) => {
    console.error('人脸验证失败:', error);
    setFaceVerificationStatus('failed');
    setShowFaceVerification(false);
    Taro.showToast({ title: error, icon: 'error' });
  };

  const startFaceVerification = () => {
    setFaceVerificationStatus('pending');
    setShowFaceVerification(true);
  };

  const getVerificationLevelText = (level: string) => {
    switch (level) {
      case 'basic':
        return '基础验证';
      case 'face_verified':
        return '人脸验证';
      default:
        return '未验证';
    }
  };

  const getVerificationLevelColor = (level: string) => {
    switch (level) {
      case 'basic':
        return '#f39c12';
      case 'face_verified':
        return '#27ae60';
      default:
        return '#95a5a6';
    }
  };

  const logout = async () => {
    try {
      const result = await Taro.showModal({
        title: '确认退出',
        content: '是否确定要退出登录？'
      });

      if (result.confirm) {
        // 清除本地存储的token
        Taro.removeStorageSync('token');
        Taro.removeStorageSync('refreshToken');
        Taro.removeStorageSync('userInfo');

        // 调用退出API（可选）
        try {
          await request({
            url: '/auth/logout',
            method: 'POST'
          });
        } catch (error) {
          // 忽略退出API错误，本地清除已足够
        }

        Taro.showToast({ title: '退出成功', icon: 'success' });
        Taro.reLaunch({ url: '/pages/login/login' });
      }
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  };

  if (showFaceVerification) {
    return (
      <FaceVerification
        mode="verify"
        userId={userProfile?.id}
        title="身份验证"
        description="请进行人脸识别以提升账户安全级别"
        onSuccess={handleFaceVerificationSuccess}
        onError={handleFaceVerificationError}
      />
    );
  }

  if (showVerificationHistory) {
    return (
      <VerificationHistory
        userId={userProfile?.id}
        onClose={() => setShowVerificationHistory(false)}
        showHeader={true}
      />
    );
  }

  return (
    <View className='profile-page'>
      {isLoading ? (
        <View className='loading-container'>
          <Text>加载中...</Text>
        </View>
      ) : userProfile ? (
        <View className='profile-container'>
          {/* 用户基本信息 */}
          <View className='user-info-card'>
            <View className='user-avatar'>
              {userProfile.avatarUrl ? (
                <Image src={userProfile.avatarUrl} className='avatar-image' />
              ) : (
                <View className='avatar-default'>
                  <Text className='avatar-text'>
                    {userProfile.nickName?.charAt(0) || '用'}
                  </Text>
                </View>
              )}
            </View>
            <View className='user-details'>
              <Text className='user-name'>{userProfile.nickName}</Text>
              <Text className='user-phone'>{userProfile.phone}</Text>
              <View className='verification-badge'>
                <Text
                  className='verification-level'
                  style={{ color: getVerificationLevelColor(userProfile.verificationLevel) }}
                >
                  {getVerificationLevelText(userProfile.verificationLevel)}
                </Text>
              </View>
            </View>
          </View>

          {/* 账户余额 */}
          <View className='balance-card'>
            <Text className='balance-label'>账户余额</Text>
            <Text className='balance-amount'>¥{userProfile.balance.toFixed(2)}</Text>
          </View>

          {/* 验证功能 */}
          <View className='verification-section'>
            <View className='section-header'>
              <Text className='section-title'>安全验证</Text>
              {userProfile.verificationLevel === 'face_verified' && (
                <Button
                  className='history-button'
                  onClick={() => setShowVerificationHistory(true)}
                >
                  📋 验证记录
                </Button>
              )}
            </View>

            <View className='verification-item'>
              <View className='verification-info'>
                <Text className='verification-name'>🎭 人脸识别验证</Text>
                <Text className='verification-desc'>
                  {userProfile.verificationLevel === 'face_verified'
                    ? '已完成人脸验证，账户安全级别较高'
                    : '完成人脸验证可提升账户安全级别'
                  }
                </Text>
                {faceVerificationStatus === 'success' && (
                  <Text className='verification-success-tip'>
                    🎉 恭喜！您已成功完成人脸验证
                  </Text>
                )}
                {faceVerificationStatus === 'failed' && (
                  <Text className='verification-failed-tip'>
                    ❌ 验证失败，请重试或检查网络连接
                  </Text>
                )}
              </View>
              <View className='verification-action'>
                {userProfile.verificationLevel === 'face_verified' ? (
                  <View className='verified-status'>
                    <Text className='verified-text'>✅ 已验证</Text>
                    <Button
                      className='reverify-button'
                      onClick={startFaceVerification}
                      disabled={faceVerificationStatus === 'pending'}
                    >
                      🔄 重新验证
                    </Button>
                  </View>
                ) : (
                  <Button
                    className='verify-button'
                    onClick={startFaceVerification}
                    disabled={faceVerificationStatus === 'pending'}
                  >
                    {faceVerificationStatus === 'pending' ? '验证中...' : '🎯 开始验证'}
                  </Button>
                )}
              </View>
            </View>

            {/* 验证状态进度条 */}
            {faceVerificationStatus === 'pending' && (
              <View className='verification-progress'>
                <View className='progress-bar'>
                  <View className='progress-fill'></View>
                </View>
                <Text className='progress-text'>正在进行人脸验证，请耐心等待...</Text>
              </View>
            )}

            {/* 验证级别说明 */}
            <View className='verification-levels'>
              <Text className='levels-title'>验证级别说明</Text>
              <View className='level-item'>
                <Text className='level-badge basic'>基础</Text>
                <Text className='level-desc'>手机号验证，基本身份确认</Text>
              </View>
              <View className='level-item'>
                <Text className='level-badge face'>人脸</Text>
                <Text className='level-desc'>生物识别验证，高级安全保护</Text>
              </View>
            </View>
          </View>

          {/* 车辆信息 */}
          <View className='vehicles-section'>
            <Text className='section-title'>我的车辆</Text>
            {userProfile.vehicles && userProfile.vehicles.length > 0 ? (
              userProfile.vehicles.map((vehicle, index) => (
                <View key={index} className='vehicle-item'>
                  <Text className='vehicle-name'>{vehicle.brand} {vehicle.model}</Text>
                  <Text className='vehicle-plate'>{vehicle.licensePlate}</Text>
                </View>
              ))
            ) : (
              <View className='empty-vehicles'>
                <Text className='empty-text'>暂无车辆信息</Text>
                <Button className='add-vehicle-button'>添加车辆</Button>
              </View>
            )}
          </View>

          {/* 操作按钮 */}
          <View className='actions-section'>
            <Button className='action-button secondary' onClick={loadUserProfile}>
              刷新信息
            </Button>
            <Button className='action-button danger' onClick={logout}>
              退出登录
            </Button>
          </View>
        </View>
      ) : (
        <View className='error-container'>
          <Text className='error-text'>加载用户信息失败</Text>
          <Button className='retry-button' onClick={loadUserProfile}>
            重试
          </Button>
        </View>
      )}
    </View>
  );
}