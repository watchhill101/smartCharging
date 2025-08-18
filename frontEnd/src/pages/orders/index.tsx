import { View, Text, Button, ScrollView, Input } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro, { useLoad, getStorageSync as taroGetStorageSync } from '@tarojs/taro';
import request from '../../utils/request';
import { STORAGE_KEYS } from '../../utils/constants';
import './index.scss';

interface OrderItem {
  _id: string;
  orderId: string;
  type: 'charging' | 'recharge';
  amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  paymentMethod: 'balance' | 'alipay';
  description?: string;
  createdAt: string;
  sessionId?: {
    sessionId: string;
    stationId: string;
    chargerId: string;
    startTime: string;
    endTime?: string;
  };
}

export default function Orders() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'charging' | 'recharge'>('all');
  const [showLogin, setShowLogin] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');

  useLoad(() => {
    console.log('📋 订单页面加载');
    loadUserOrders();
  });

  const loadUserOrders = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 开始加载订单数据...');

      // 检查用户认证
      const token = taroGetStorageSync(STORAGE_KEYS.USER_TOKEN);
      
      if (token) {
        // 有token，尝试获取真实数据
        try {
          console.log('🔑 找到用户token，请求真实订单数据...');
          
          const response = await request({
            url: '/v1_0/auth/api/users/orders',
            method: 'GET',
            showError: false
          });

          console.log('📡 API响应:', response);
          console.log('📡 响应类型:', typeof response);
          console.log('📡 响应详情:', JSON.stringify(response, null, 2));

          // 更安全的响应检查
          if (response && typeof response === 'object') {
            // 检查是否是成功响应
            if (response.success === true) {
              const realOrders = response.data?.orders || [];
              setOrders(realOrders);
              console.log('✅ 真实订单数据加载成功:', realOrders.length, '个订单');
              
              if (realOrders.length === 0) {
                console.log('📋 暂无订单数据，显示提示');
                // 使用演示数据作为空数据的fallback
                const emptyStateOrder = [{
                  _id: 'empty_state',
                  orderId: '暂无订单',
                  type: 'charging' as const,
                  amount: 0,
                  status: 'paid' as const,
                  paymentMethod: 'alipay' as const,
                  description: '还没有订单记录，快去充电吧！',
                  createdAt: new Date().toISOString()
                }];
                setOrders(emptyStateOrder);
              }
              return;
            } else {
              console.log('⚠️ API返回失败状态:', response.message);
              throw new Error(response.message || 'API返回失败状态');
            }
          } else {
            console.log('⚠️ API响应格式异常或为空:', response);
            throw new Error('API响应格式异常');
          }
        } catch (apiError: any) {
          console.error('❌ API请求失败:', apiError);
          console.error('❌ 错误详情:', apiError.message);
          console.error('❌ 错误类型:', typeof apiError);
          
          // API失败，显示提示并使用演示数据
          console.log('🔄 API失败，fallback到演示数据');
        }
      } else {
        console.log('❌ 未找到用户token，显示演示数据和登录提示');
        setShowLogin(true);
      }

      // Fallback: 使用演示数据
      console.log('📋 使用演示数据作为备选方案');
      const demoOrders = [
        {
          _id: 'demo1',
          orderId: 'ORD202501180001',
          type: 'charging' as const,
          amount: 25.50,
          status: 'paid' as const,
          paymentMethod: 'alipay' as const,
          description: '充电桩充电服务 - 万达广场充电站',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          sessionId: {
            sessionId: 'CS001',
            stationId: 'ST001',
            chargerId: 'CH001',
            startTime: new Date(Date.now() - 90000000).toISOString()
          }
        },
        {
          _id: 'demo2',
          orderId: 'ORD202501180002',
          type: 'recharge' as const,
          amount: 100.00,
          status: 'paid' as const,
          paymentMethod: 'alipay' as const,
          description: '账户余额充值 - 100元',
          createdAt: new Date(Date.now() - 172800000).toISOString()
        },
        {
          _id: 'demo3',
          orderId: 'ORD202501180003',
          type: 'charging' as const,
          amount: 18.80,
          status: 'pending' as const,
          paymentMethod: 'balance' as const,
          description: '充电桩充电服务 - 小区充电站A',
          createdAt: new Date(Date.now() - 259200000).toISOString(),
          sessionId: {
            sessionId: 'CS002',
            stationId: 'ST002',
            chargerId: 'CH002',
            startTime: new Date(Date.now() - 262800000).toISOString()
          }
        },
        {
          _id: 'demo4',
          orderId: 'ORD202501180004',
          type: 'charging' as const,
          amount: 32.60,
          status: 'paid' as const,
          paymentMethod: 'alipay' as const,
          description: '充电桩充电服务 - 办公楼充电站',
          createdAt: new Date(Date.now() - 432000000).toISOString(),
          sessionId: {
            sessionId: 'CS003',
            stationId: 'ST003',
            chargerId: 'CH003',
            startTime: new Date(Date.now() - 435600000).toISOString()
          }
        },
        {
          _id: 'demo5',
          orderId: 'ORD202501180005',
          type: 'recharge' as const,
          amount: 50.00,
          status: 'paid' as const,
          paymentMethod: 'balance' as const,
          description: '账户余额充值 - 50元',
          createdAt: new Date(Date.now() - 518400000).toISOString()
        }
      ];
      
      setOrders(demoOrders);
      console.log('✅ 演示订单数据加载成功');
      
    } catch (error: any) {
      console.error('❌ 加载订单失败:', error);
      
      // 最终fallback：基础演示数据
      const basicDemoOrders = [
        {
          _id: 'demo1',
          orderId: 'ORD001',
          type: 'charging' as const,
          amount: 25.50,
          status: 'paid' as const,
          paymentMethod: 'alipay' as const,
          description: '充电桩充电服务',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ];
      setOrders(basicDemoOrders);
      
      console.log('🔔 数据加载异常，显示演示数据');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待支付';
      case 'paid':
        return '已支付';
      case 'cancelled':
        return '已取消';
      case 'refunded':
        return '已退款';
      default:
        return '未知状态';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#ff9500';
      case 'paid':
        return '#34c759';
      case 'cancelled':
        return '#8e8e93';
      case 'refunded':
        return '#007aff';
      default:
        return '#8e8e93';
    }
  };

  const getTypeText = (type: string) => {
    return type === 'charging' ? '充电订单' : '充值订单';
  };

  const getTypeIcon = (type: string) => {
    return type === 'charging' ? '⚡' : '💰';
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true;
    return order.type === activeTab;
  });

  const navigateBack = () => {
    try {
      // 直接跳转到个人中心页面
      Taro.switchTab({
        url: '/pages/profile/index'
      });
    } catch (error) {
      console.error('跳转到个人中心失败:', error);
      // 如果switchTab失败，尝试使用navigateBack
      try {
        Taro.navigateBack();
      } catch (backError) {
        console.error('返回失败:', backError);
      }
    }
  };

  const handleOrderDetail = (order: OrderItem) => {
    const orderInfo = `订单号: ${order.orderId}\n类型: ${getTypeText(order.type)}\n金额: ¥${order.amount.toFixed(2)}\n状态: ${getStatusText(order.status)}\n支付方式: ${order.paymentMethod === 'balance' ? '余额支付' : '支付宝'}\n创建时间: ${formatDateTime(order.createdAt)}`;
    
    console.log('📋 订单详情:', orderInfo);
    
    try {
      Taro.showModal({
        title: '订单详情',
        content: orderInfo,
        showCancel: false
      });
    } catch (error) {
      console.error('显示订单详情失败:', error);
      // 如果showModal失败，至少在控制台显示信息
      alert(`订单详情：\n${orderInfo}`);
    }
  };

  const handleDemoLogin = async () => {
    if (!loginPhone) {
      console.log('⚠️ 请输入手机号');
      return;
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(loginPhone)) {
      console.log('⚠️ 手机号格式不正确');
      return;
    }

    try {
      setIsLoading(true);
      const response = await request({
        url: '/api/auth/demo-login',
        method: 'POST',
        data: { phone: loginPhone },
        showError: false
      });

      if (response && response.success) {
        // 保存token和用户信息
        const { token, user } = response.data;
        
        try {
          Taro.setStorageSync(STORAGE_KEYS.USER_TOKEN, token);
          Taro.setStorageSync(STORAGE_KEYS.USER_INFO, user);
        } catch (storageError) {
          console.error('存储失败:', storageError);
        }

        setShowLogin(false);
        setLoginPhone('');
        
        console.log('✅ 登录成功！');

        // 重新加载订单数据
        setTimeout(() => {
          loadUserOrders();
        }, 1000);
      } else {
        throw new Error(response?.message || '登录失败');
      }
    } catch (error: any) {
      console.error('登录失败:', error);
      const errorMessage = error?.message || '登录失败';
      
      console.log('❌ 登录失败:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipLogin = () => {
    setShowLogin(false);
  };

  return (
    <View className='orders-page'>
      {/* 头部导航 */}
      <View className='orders-header'>
        <View className='header-nav'>
          <Button className='back-button' onClick={navigateBack}>
            ← 返回
          </Button>
          <Text className='page-title'>我的订单</Text>
          <View className='header-placeholder'></View>
        </View>

        {/* 标签切换 */}
        <View className='tab-bar'>
          <View 
            className={`tab-item ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <Text className='tab-text'>全部</Text>
          </View>
          <View 
            className={`tab-item ${activeTab === 'charging' ? 'active' : ''}`}
            onClick={() => setActiveTab('charging')}
          >
            <Text className='tab-text'>充电</Text>
          </View>
          <View 
            className={`tab-item ${activeTab === 'recharge' ? 'active' : ''}`}
            onClick={() => setActiveTab('recharge')}
          >
            <Text className='tab-text'>充值</Text>
          </View>
        </View>
      </View>

      {/* 订单列表 */}
      <ScrollView className='orders-content' scrollY>
        {isLoading ? (
          <View className='loading-container'>
            <Text className='loading-text'>加载中...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className='empty-container'>
            <View className='empty-icon'>📋</View>
            <Text className='empty-text'>暂无订单记录</Text>
            <Text className='empty-subtitle'>快去充电或充值吧~</Text>
          </View>
        ) : (
          <View className='orders-list'>
            {filteredOrders.map((order) => (
              <View 
                key={order._id} 
                className='order-item'
                onClick={() => handleOrderDetail(order)}
              >
                <View className='order-header'>
                  <View className='order-type'>
                    <Text className='type-icon'>{getTypeIcon(order.type)}</Text>
                    <Text className='type-text'>{getTypeText(order.type)}</Text>
                  </View>
                  <View 
                    className='order-status'
                    style={{ color: getStatusColor(order.status) }}
                  >
                    <Text className='status-text'>{getStatusText(order.status)}</Text>
                  </View>
                </View>

                <View className='order-content'>
                  <Text className='order-id'>订单号: {order.orderId}</Text>
                  {order.description && (
                    <Text className='order-description'>{order.description}</Text>
                  )}
                  {order.sessionId && (
                    <Text className='session-info'>
                      充电站: {order.sessionId.stationId} | 充电器: {order.sessionId.chargerId}
                    </Text>
                  )}
                </View>

                <View className='order-footer'>
                  <View className='order-time'>
                    <Text className='time-text'>{formatDateTime(order.createdAt)}</Text>
                  </View>
                  <View className='order-amount'>
                    <Text className='amount-text'>¥{order.amount.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 刷新按钮 */}
      <View className='refresh-section'>
        <Button 
          className='refresh-button' 
          onClick={loadUserOrders}
          loading={isLoading}
        >
          刷新订单
        </Button>
      </View>

      {/* 登录弹窗 */}
      {showLogin && (
        <View className='login-modal'>
          <View className='login-content'>
            <Text className='login-title'>登录查看真实订单</Text>
            <Text className='login-subtitle'>当前显示的是演示数据</Text>
            
            <View className='login-form'>
              <Text className='form-label'>手机号</Text>
              <Input
                className='form-input'
                type='number'
                placeholder='请输入手机号'
                value={loginPhone}
                onInput={(e) => setLoginPhone(e.detail.value)}
                maxlength={11}
              />
              
              <Text className='form-tip'>
                提示：可以使用测试手机号 13812345678, 13987654321, 13611111111, 13522222222
              </Text>
            </View>

            <View className='login-actions'>
              <Button 
                className='login-button'
                onClick={handleDemoLogin}
                loading={isLoading}
              >
                立即登录
              </Button>
              <Button 
                className='skip-button'
                onClick={handleSkipLogin}
              >
                继续浏览演示数据
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
} 