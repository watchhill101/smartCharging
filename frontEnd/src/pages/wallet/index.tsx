import { View, Text, Button, ScrollView } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro, { useLoad, getStorageSync as taroGetStorageSync } from '@tarojs/taro';
import request from '../../utils/request';
import { STORAGE_KEYS } from '../../utils/constants';
import './index.scss';

interface WalletData {
  balance: number;
  coupons: number;
  chargingFunds: number;
  cards: number;
  points: number;
  tasks: TaskItem[];
}

interface TaskItem {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  points: number;
  icon: string;
  buttonText: string;
  type: 'charging' | 'video' | 'purchase';
}

export default function Wallet() {
  const [walletData, setWalletData] = useState<WalletData>({
    balance: 0,
    coupons: 0,
    chargingFunds: 0,
    cards: 0,
    points: 0,
    tasks: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showProtectionAlert, setShowProtectionAlert] = useState(true);

  useLoad(() => {
    console.log('💰 钱包页面加载');
    loadWalletData();
  });

  const loadWalletData = async () => {
    try {
      setIsLoading(true);
      
      // 从存储获取用户信息
      const userInfo = taroGetStorageSync(STORAGE_KEYS.USER_INFO);
      const balance = userInfo?.balance || 0;

      // 模拟钱包数据
      const mockWalletData: WalletData = {
        balance: balance,
        coupons: 0,
        chargingFunds: 0,
        cards: 0,
        points: 0,
        tasks: [
          {
            id: 'charging',
            title: '充电',
            description: 'APP端充电可得积分\n为你的爱车充一次电吧',
            current: 0,
            target: 2,
            points: 5,
            icon: '🔌',
            buttonText: '去充电',
            type: 'charging'
          },
          {
            id: 'video',
            title: '看视频赚积分',
            description: '做会小任务，轻松得积分',
            current: 0,
            target: 10,
            points: 20,
            icon: '📺',
            buttonText: '看视频',
            type: 'video'
          },
          {
            id: 'purchase',
            title: '购买安心充电年卡',
            description: '全年无忧，充电更放心',
            current: 0,
            target: 1,
            points: 500,
            icon: '🛡️',
            buttonText: '去购买',
            type: 'purchase'
          }
        ]
      };

      setWalletData(mockWalletData);

      // 尝试从API获取实际钱包数据
      try {
        const token = taroGetStorageSync(STORAGE_KEYS.USER_TOKEN);
        if (token) {
          const response = await request({
            url: '/v1_0/auth/api/users/balance',
            method: 'GET',
            showError: false
          });

          if (response && response.success && response.data) {
            setWalletData(prev => ({
              ...prev,
              balance: response.data.balance || prev.balance
            }));
          }
        }
      } catch (apiError) {
        console.log('API获取钱包数据失败，使用模拟数据');
      }

    } catch (error: any) {
      console.error('❌ 加载钱包数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskAction = (task: TaskItem) => {
    switch (task.type) {
      case 'charging':
        Taro.switchTab({
          url: '/pages/charging/index'
        });
        break;
      case 'video':
        Taro.showToast({
          title: '看视频功能开发中',
          icon: 'none',
          duration: 2000
        });
        break;
      case 'purchase':
        Taro.showToast({
          title: '购买功能开发中',
          icon: 'none',
          duration: 2000
        });
        break;
      default:
        Taro.showToast({
          title: '功能开发中',
          icon: 'none',
          duration: 2000
        });
    }
  };

  const handleBuyCard = () => {
    Taro.showToast({
      title: '购卡功能开发中',
      icon: 'none',
      duration: 2000
    });
  };

  const handleProtectionClaim = () => {
    setShowProtectionAlert(false);
    Taro.showToast({
      title: '领取成功',
      icon: 'success',
      duration: 2000
    });
  };

  const navigateBack = () => {
    try {
      Taro.switchTab({
        url: '/pages/profile/index'
      });
    } catch (error) {
      console.error('返回个人中心失败:', error);
      try {
        Taro.navigateBack();
      } catch (backError) {
        console.error('返回失败:', backError);
      }
    }
  };

  return (
    <View className='wallet-page'>
      {/* 头部导航 */}
      <View className='wallet-header'>
        <View className='header-nav'>
          <Button className='back-button' onClick={navigateBack}>
            ← 返回
          </Button>
          <Text className='page-title'>钱包</Text>
          <View className='header-placeholder'></View>
        </View>
      </View>

      <ScrollView className='wallet-content' scrollY>
        {/* 充电防护待领取通知 */}
        {showProtectionAlert && (
          <View className='protection-alert'>
            <View className='alert-icon'>🛡️</View>
            <Text className='alert-text'>您有一份充电防护待领取</Text>
            <Button className='claim-button' onClick={handleProtectionClaim}>
              去领取 &gt;
            </Button>
            <View className='close-button' onClick={() => setShowProtectionAlert(false)}>
              ✕
            </View>
          </View>
        )}

        {/* 账户余额区域 */}
        <View className='balance-section'>
          <View className='account-protection'>
            <View className='protection-icon'>🛡️</View>
            <Text className='protection-text'>账户保障中</Text>
          </View>
          
          <View className='balance-display'>
            <Text className='balance-label'>账户余额(元)</Text>
            <Text className='balance-amount'>{walletData.balance.toFixed(2)}</Text>
          </View>

          <View className='wallet-stats'>
            <View className='stat-item'>
              <Text className='stat-number'>{walletData.coupons}</Text>
              <Text className='stat-label'>优惠券(张)</Text>
            </View>
            <View className='stat-item'>
              <Text className='stat-number'>{walletData.chargingFunds}</Text>
              <Text className='stat-label'>充电金(元)</Text>
            </View>
            <View className='stat-item'>
              <Text className='stat-number'>{walletData.cards}</Text>
              <Text className='stat-label'>电卡(张)</Text>
            </View>
          </View>
        </View>

        {/* 电子充电卡 */}
        <View className='charging-card-section'>
          <View >
            <Text className='card-title'>电子充电卡·购卡充电更便捷</Text>
          </View>
          <Button className='buy-card-button' onClick={handleBuyCard}>
            去购卡
          </Button>
        </View>

        {/* 积分任务系统 */}
        <View className='points-section'>
          <View className='points-header'>
            <Text className='points-title'>做任务赚积分</Text>
            <Text className='points-subtitle'>积分好礼随心兑</Text>
            <Text className='more-link'>更多 &gt;</Text>
          </View>

          <View className='tasks-list'>
            {walletData.tasks.map((task) => (
              <View key={task.id} className='task-item'>
                <View className='task-icon'>{task.icon}</View>
                <View className='task-content'>
                  <View className='task-header'>
                    <Text className='task-title'>
                      {task.title}({task.current}/{task.target}) 
                      <Text className='task-points'>+{task.points}</Text>
                    </Text>
                    <Text className='task-badge'>APP端充电可得积分</Text>
                  </View>
                  <Text className='task-description'>{task.description}</Text>
                </View>
                <Button 
                  className='task-button'
                  onClick={() => handleTaskAction(task)}
                >
                  {task.buttonText}
                </Button>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
} 